import { db, schema } from '../db/index.js';
import { sql, eq, and, gte, lte, count, desc } from 'drizzle-orm';
import type { TimeSeriesData, TableRow, SankeyData, MediaUpgradePath, UpgradeStep, Resolution, QualitySource, MediaItem } from '@countarr/shared';

export interface UpgradeStatsParams {
  startDate: string;
  endDate: string;
}

export async function getUpgradesPerDay(params: UpgradeStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      date: sql<string>`date(${schema.downloadEvents.timestamp})`.as('date'),
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'upgraded')
      )
    )
    .groupBy(sql`date(${schema.downloadEvents.timestamp})`)
    .orderBy(sql`date(${schema.downloadEvents.timestamp})`);

  return [{
    label: 'Upgrades',
    data: results.map(row => ({
      timestamp: row.date,
      value: Number(row.count),
    })),
    color: '#9b59b6',
  }];
}

export async function getMostUpgradedItems(params: UpgradeStatsParams, limit = 20): Promise<TableRow[]> {
  const { startDate, endDate } = params;

  // For movies: group by mediaItemId
  // For episodes: group by episodeId and show "Series - SxxExx" format
  const results = await db
    .select({
      mediaItemId: schema.downloadEvents.mediaItemId,
      episodeId: schema.downloadEvents.episodeId,
      seriesTitle: schema.mediaItems.title,
      type: schema.mediaItems.type,
      episodeSeason: schema.episodes.season,
      episodeNumber: schema.episodes.episode,
      episodeTitle: schema.episodes.title,
      upgradeCount: count(),
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .leftJoin(schema.episodes, eq(schema.downloadEvents.episodeId, schema.episodes.id))
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'upgraded')
      )
    )
    .groupBy(
      schema.downloadEvents.mediaItemId, 
      schema.downloadEvents.episodeId,
      schema.mediaItems.title, 
      schema.mediaItems.type,
      schema.episodes.season,
      schema.episodes.episode,
      schema.episodes.title
    )
    .orderBy(sql`count(*) DESC`)
    .limit(limit);

  return results.map((row, index) => {
    // For episodes, format as "Series - S01E01 - Episode Title"
    let title = row.seriesTitle;
    if (row.episodeId && row.episodeSeason !== null && row.episodeNumber !== null) {
      const seasonStr = String(row.episodeSeason).padStart(2, '0');
      const epStr = String(row.episodeNumber).padStart(2, '0');
      title = `${row.seriesTitle} - S${seasonStr}E${epStr}`;
      if (row.episodeTitle) {
        title += ` - ${row.episodeTitle}`;
      }
    }
    
    return {
      rank: index + 1,
      id: row.episodeId ?? row.mediaItemId,
      title,
      type: row.episodeId ? 'episode' : row.type,
      upgradeCount: Number(row.upgradeCount),
    };
  });
}

export async function getUpgradeFlows(params: UpgradeStatsParams): Promise<SankeyData> {
  const { startDate, endDate } = params;

  // Get all upgrade events with their previous quality
  // We'll track resolution transitions
  // For Sonarr (episodes), we group by episodeId to track per-episode upgrades
  // For Radarr (movies), we group by mediaItemId
  const results = await db
    .select({
      mediaItemId: schema.downloadEvents.mediaItemId,
      episodeId: schema.downloadEvents.episodeId,
      resolution: schema.downloadEvents.resolution,
      timestamp: schema.downloadEvents.timestamp,
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded')
      )
    )
    .orderBy(schema.downloadEvents.mediaItemId, schema.downloadEvents.episodeId, schema.downloadEvents.timestamp);

  // Build transition counts
  const transitions: Map<string, number> = new Map();
  const resolutions = new Set<string>();

  // Track by composite key: episodeId if present (Sonarr), else mediaItemId (Radarr)
  let currentKey: string | null = null;
  let previousRes: string | null = null;

  for (const row of results) {
    const res = row.resolution ?? 'unknown';
    resolutions.add(res);

    // Use episodeId for Sonarr (per-episode tracking), mediaItemId for Radarr (per-movie)
    const key = row.episodeId ? `ep:${row.episodeId}` : `media:${row.mediaItemId}`;

    if (currentKey === key && previousRes && previousRes !== res) {
      // This is an upgrade/transition
      const transitionKey = `${previousRes}→${res}`;
      transitions.set(transitionKey, (transitions.get(transitionKey) ?? 0) + 1);
    }

    currentKey = key;
    previousRes = res;
  }

  // Build Sankey nodes and links
  // Resolution order determines the DAG direction - only allow transitions to HIGHER indices
  const resOrder = ['480p', '576p', '720p', '1080p', '2160p', 'unknown'];
  const resRank = new Map(resOrder.map((r, i) => [r, i]));
  const orderedRes = resOrder.filter(r => resolutions.has(r));

  // If no valid resolutions, return empty
  if (orderedRes.length === 0) {
    return { nodes: [], links: [] };
  }

  const nodes: { name: string }[] = orderedRes.map(name => ({ name }));
  const nodeIndex = new Map(orderedRes.map((name, i) => [name, i]));

  const links: { source: number; target: number; value: number }[] = [];

  for (const [key, value] of transitions) {
    const parts = key.split('→');
    if (parts.length !== 2) continue;
    
    const [from, to] = parts;
    const sourceIdx = nodeIndex.get(from);
    const targetIdx = nodeIndex.get(to);
    const fromRank = resRank.get(from) ?? -1;
    const toRank = resRank.get(to) ?? -1;

    // Only include "upgrade" transitions (lower quality -> higher quality)
    // This ensures the Sankey is a proper DAG with no cycles
    // Skip: self-loops, downgrades, and unknown -> unknown
    if (
      sourceIdx !== undefined && 
      targetIdx !== undefined && 
      sourceIdx !== targetIdx && 
      toRank > fromRank &&  // Only forward (upgrade) transitions
      value > 0
    ) {
      links.push({
        source: sourceIdx,
        target: targetIdx,
        value,
      });
    }
  }

  // If no valid links, return empty to avoid rendering issues
  if (links.length === 0) {
    return { nodes: [], links: [] };
  }

  return { nodes, links };
}

export async function getAvgTimeBetweenUpgrades(params: UpgradeStatsParams): Promise<number> {
  const { startDate, endDate } = params;

  // Get upgrade events grouped by media item or episode
  // For Sonarr, group by episodeId; for Radarr, group by mediaItemId
  const results = await db
    .select({
      mediaItemId: schema.downloadEvents.mediaItemId,
      episodeId: schema.downloadEvents.episodeId,
      timestamp: schema.downloadEvents.timestamp,
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded')
      )
    )
    .orderBy(schema.downloadEvents.mediaItemId, schema.downloadEvents.episodeId, schema.downloadEvents.timestamp);

  const gaps: number[] = [];
  // Track by composite key: episodeId if present (Sonarr), else mediaItemId (Radarr)
  let currentKey: string | null = null;
  let previousTime: Date | null = null;

  for (const row of results) {
    const key = row.episodeId ? `ep:${row.episodeId}` : `media:${row.mediaItemId}`;
    
    if (currentKey === key && previousTime) {
      const current = new Date(row.timestamp);
      const diffHours = (current.getTime() - previousTime.getTime()) / (1000 * 60 * 60);
      if (diffHours > 0) {
        gaps.push(diffHours);
      }
    }

    currentKey = key;
    previousTime = new Date(row.timestamp);
  }

  if (gaps.length === 0) return 0;

  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return Math.round(avg);
}

export async function getTotalUpgrades(params: UpgradeStatsParams): Promise<number> {
  const { startDate, endDate } = params;

  const result = await db
    .select({
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        eq(schema.downloadEvents.isUpgrade, true)
      )
    );

  return Number(result[0]?.count ?? 0);
}

export async function getMediaUpgradePath(mediaItemId: number, episodeId?: number): Promise<MediaUpgradePath | null> {
  const mediaItem = await db.query.mediaItems.findFirst({
    where: eq(schema.mediaItems.id, mediaItemId),
  });

  if (!mediaItem) return null;

  // If episodeId is provided, get upgrade path for that specific episode
  // Otherwise, get upgrade path for the media item (movie or all episodes of a series)
  const whereClause = episodeId
    ? and(
        eq(schema.downloadEvents.episodeId, episodeId),
        eq(schema.downloadEvents.eventType, 'downloaded')
      )
    : and(
        eq(schema.downloadEvents.mediaItemId, mediaItemId),
        eq(schema.downloadEvents.eventType, 'downloaded')
      );

  // Join with episodes table to get episode info for series
  const events = await db
    .select({
      id: schema.downloadEvents.id,
      timestamp: schema.downloadEvents.timestamp,
      quality: schema.downloadEvents.quality,
      resolution: schema.downloadEvents.resolution,
      qualitySource: schema.downloadEvents.qualitySource,
      releaseGroup: schema.downloadEvents.releaseGroup,
      sizeBytes: schema.downloadEvents.sizeBytes,
      qualityScore: schema.downloadEvents.qualityScore,
      episodeId: schema.downloadEvents.episodeId,
      // Episode details from join
      season: schema.episodes.season,
      episode: schema.episodes.episode,
      episodeTitle: schema.episodes.title,
    })
    .from(schema.downloadEvents)
    .leftJoin(schema.episodes, eq(schema.downloadEvents.episodeId, schema.episodes.id))
    .where(whereClause)
    .orderBy(schema.downloadEvents.timestamp);

  const upgrades: UpgradeStep[] = events.map(event => ({
    timestamp: event.timestamp,
    quality: event.quality ?? 'Unknown',
    resolution: (event.resolution as Resolution) ?? null,
    source: (event.qualitySource as QualitySource) ?? null,
    releaseGroup: event.releaseGroup,
    sizeBytes: event.sizeBytes,
    qualityScore: event.qualityScore,
    // Episode info for series
    episodeId: event.episodeId,
    season: event.season,
    episode: event.episode,
    episodeTitle: event.episodeTitle,
  }));

  const totalSizeDownloaded = events.reduce((sum, e) => sum + e.sizeBytes, 0);
  const currentQualityScore = events.length > 0 ? events[events.length - 1].qualityScore : null;

  // Convert DB mediaItem to shared type
  const sharedMediaItem: MediaItem = {
    id: mediaItem.id,
    externalId: mediaItem.externalId,
    source: mediaItem.source as MediaItem['source'],
    type: mediaItem.type as MediaItem['type'],
    title: mediaItem.title,
    year: mediaItem.year,
    tmdbId: mediaItem.tmdbId,
    imdbId: mediaItem.imdbId,
    tvdbId: mediaItem.tvdbId,
    runtimeMinutes: mediaItem.runtimeMinutes,
    addedAt: mediaItem.addedAt,
    sizeBytes: mediaItem.sizeBytes,
    quality: mediaItem.quality,
    posterUrl: mediaItem.posterUrl,
    genres: typeof mediaItem.genres === 'string' ? JSON.parse(mediaItem.genres) : (mediaItem.genres ?? []),
    metadata: typeof mediaItem.metadata === 'string' ? JSON.parse(mediaItem.metadata) : (mediaItem.metadata ?? {}),
  };

  return {
    mediaItem: sharedMediaItem,
    upgrades,
    totalSizeDownloaded,
    upgradeCount: Math.max(0, events.length - 1),
    currentQualityScore,
  };
}
