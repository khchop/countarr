import { db, schema } from '../db/index.js';
import { sql, eq, and, gte, lte, count, sum, avg, desc } from 'drizzle-orm';
import type { PieChartData, TableRow, TimeSeriesData } from '@countarr/shared';
import {
  getBaseOverviewStats,
  getDownloadsByDay,
  getReleaseGroups,
  getQualityDistribution,
  getGenreDistribution,
  getDecadeDistribution,
  parseMetadata,
  type StatsParams,
} from './helpers.js';

export type TVStatsParams = StatsParams;

export interface TVOverviewStats {
  totalSeries: number;
  totalEpisodes: number;
  totalSizeBytes: number;
  downloadedCount: number;
  upgradedCount: number;
  avgQualityScore: number | null;
}

export interface EpisodeRuntimeStats {
  shortestMinutes: number | null;
  shortestTitle: string | null;
  longestMinutes: number | null;
  longestTitle: string | null;
  averageMinutes: number | null;
  totalWatchTimeMinutes: number;
}

// Get overview stats for TV shows
export async function getTVOverviewStats(params: TVStatsParams): Promise<TVOverviewStats> {
  // Get base stats from shared helper
  const baseStats = await getBaseOverviewStats(params, 'sonarr');

  // TV-specific: Total series in library
  const seriesResult = await db
    .select({ count: count() })
    .from(schema.mediaItems)
    .where(eq(schema.mediaItems.source, 'sonarr'));
  const totalSeries = Number(seriesResult[0]?.count ?? 0);

  // TV-specific: Total episodes
  const episodeResult = await db
    .select({ count: count() })
    .from(schema.episodes);
  const totalEpisodes = Number(episodeResult[0]?.count ?? 0);

  return {
    totalSeries,
    totalEpisodes,
    ...baseStats,
  };
}

// Get episode downloads by day
export async function getEpisodeDownloadsByDay(params: TVStatsParams): Promise<TimeSeriesData[]> {
  return getDownloadsByDay(params, 'sonarr', 'Episodes', '#3498db');
}

// Get top release groups for TV
export async function getTVReleaseGroups(params: TVStatsParams, limit = 10): Promise<TableRow[]> {
  return getReleaseGroups(params, 'sonarr', limit);
}

// Get quality distribution for TV
export async function getTVQualityDistribution(params: TVStatsParams): Promise<{
  resolution: PieChartData[];
  source: PieChartData[];
  codec: PieChartData[];
}> {
  return getQualityDistribution(params, 'sonarr');
}

// Get genre distribution for TV shows
export async function getTVGenreDistribution(params: TVStatsParams): Promise<PieChartData[]> {
  return getGenreDistribution(params, 'sonarr');
}

// Get network distribution (HBO, Netflix, etc.) based on downloads in time range
export async function getNetworkDistribution(params: TVStatsParams, limit = 10): Promise<PieChartData[]> {
  const { startDate, endDate } = params;
  
  // Get distinct media items downloaded in the time range
  const results = await db
    .select({
      metadata: schema.mediaItems.metadata,
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.sourceApp, 'sonarr'),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate)
      )
    )
    .groupBy(schema.mediaItems.id); // Count each series once per time range

  const networkCounts: Record<string, number> = {};
  for (const row of results) {
    const metadata = parseMetadata<{ network?: string }>(row.metadata);
    if (metadata?.network) {
      networkCounts[metadata.network] = (networkCounts[metadata.network] ?? 0) + 1;
    }
  }

  return Object.entries(networkCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

// Get most active series (most downloads)
export async function getMostActiveSeries(params: TVStatsParams, limit = 10): Promise<TableRow[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      mediaItemId: schema.downloadEvents.mediaItemId,
      title: schema.mediaItems.title,
      downloadCount: count(),
      totalSize: sum(schema.downloadEvents.sizeBytes),
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.sourceApp, 'sonarr'),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate)
      )
    )
    .groupBy(schema.downloadEvents.mediaItemId, schema.mediaItems.title)
    .orderBy(sql`count(*) DESC`)
    .limit(limit);

  return results.map((row, index) => ({
    rank: index + 1,
    id: row.mediaItemId,
    title: row.title,
    downloadCount: Number(row.downloadCount),
    totalSize: Number(row.totalSize ?? 0),
  }));
}

// Get series with most episode downloads in time range
export async function getSeriesWithMostEpisodes(params: TVStatsParams, limit = 10): Promise<TableRow[]> {
  const { startDate, endDate } = params;
  
  const results = await db
    .select({
      mediaItemId: schema.downloadEvents.mediaItemId,
      title: schema.mediaItems.title,
      episodeCount: count(),
      totalSize: sum(schema.downloadEvents.sizeBytes),
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.sourceApp, 'sonarr'),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate)
      )
    )
    .groupBy(schema.downloadEvents.mediaItemId, schema.mediaItems.title)
    .orderBy(sql`count(*) DESC`)
    .limit(limit);

  return results.map((row, index) => ({
    rank: index + 1,
    id: row.mediaItemId,
    title: row.title,
    episodeCount: Number(row.episodeCount),
    totalSize: Number(row.totalSize ?? 0),
  }));
}

// Get decade distribution for TV series (count unique series, not episodes)
export async function getTVDecadeDistribution(params: TVStatsParams): Promise<{ decade: string; count: number }[]> {
  return getDecadeDistribution(params, 'sonarr');
}

// Get episode runtime stats
export async function getEpisodeRuntimeStats(): Promise<EpisodeRuntimeStats> {
  // Get shortest series runtime (per episode avg)
  const shortest = await db.query.mediaItems.findFirst({
    where: and(
      eq(schema.mediaItems.source, 'sonarr'),
      sql`${schema.mediaItems.runtimeMinutes} IS NOT NULL`,
      sql`${schema.mediaItems.runtimeMinutes} > 0`
    ),
    orderBy: [schema.mediaItems.runtimeMinutes],
  });

  // Get longest series runtime (per episode avg)
  const longest = await db.query.mediaItems.findFirst({
    where: and(
      eq(schema.mediaItems.source, 'sonarr'),
      sql`${schema.mediaItems.runtimeMinutes} IS NOT NULL`
    ),
    orderBy: [desc(schema.mediaItems.runtimeMinutes)],
  });

  // Get average episode runtime
  const stats = await db
    .select({
      avg: avg(schema.mediaItems.runtimeMinutes),
    })
    .from(schema.mediaItems)
    .where(
      and(
        eq(schema.mediaItems.source, 'sonarr'),
        sql`${schema.mediaItems.runtimeMinutes} IS NOT NULL`
      )
    );

  // Calculate total watch time (episode count * avg runtime)
  const episodeCount = await db
    .select({ count: count() })
    .from(schema.episodes);
  
  const avgRuntime = stats[0]?.avg ? Number(stats[0].avg) : 0;
  const totalEpisodes = Number(episodeCount[0]?.count ?? 0);
  const totalWatchTimeMinutes = Math.round(avgRuntime * totalEpisodes);

  return {
    shortestMinutes: shortest?.runtimeMinutes ?? null,
    shortestTitle: shortest?.title ?? null,
    longestMinutes: longest?.runtimeMinutes ?? null,
    longestTitle: longest?.title ?? null,
    averageMinutes: avgRuntime ? Math.round(avgRuntime) : null,
    totalWatchTimeMinutes,
  };
}

// Get TV networks table
export async function getTVNetworks(limit = 10): Promise<TableRow[]> {
  const results = await db
    .select({
      metadata: schema.mediaItems.metadata,
    })
    .from(schema.mediaItems)
    .where(eq(schema.mediaItems.source, 'sonarr'));

  const networkCounts: Record<string, number> = {};
  for (const row of results) {
    const metadata = parseMetadata<{ network?: string }>(row.metadata);
    if (metadata?.network) {
      networkCounts[metadata.network] = (networkCounts[metadata.network] ?? 0) + 1;
    }
  }

  return Object.entries(networkCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([network, count], index) => ({
      rank: index + 1,
      network,
      count,
    }));
}
