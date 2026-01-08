import { db, rawDb, schema } from '../db/index.js';
import { sql, eq, and, gte, lte, count, sum, avg, isNotNull, inArray, desc, asc } from 'drizzle-orm';
import type { TableRow, PieChartData, TimeSeriesData } from '@countarr/shared';
import { getColorByIndex } from '../utils/colors.js';

export interface ReleaseGroupStatsParams {
  startDate: string;
  endDate: string;
  favoriteGroups?: string[];
}

export interface ReleaseGroupListItem {
  releaseGroup: string;
  totalDownloads: number;
  totalSizeBytes: number;
  avgQualityScore: number | null;
  firstSeen: string;
  lastSeen: string;
  movieCount: number;
  tvCount: number;
  upgradeCount: number;
}

export interface ReleaseGroupDetails {
  releaseGroup: string;
  totalDownloads: number;
  totalSizeBytes: number;
  avgQualityScore: number | null;
  firstSeen: string;
  lastSeen: string;
  movieCount: number;
  tvCount: number;
  upgradeCount: number;
  resolutionBreakdown: PieChartData[];
  sourceBreakdown: PieChartData[];
  codecBreakdown: PieChartData[];
  topIndexers: { indexer: string; count: number }[];
  recentDownloads: { title: string; date: string; resolution: string | null; sizeBytes: number }[];
}

export interface PulseDataPoint {
  period: string;
  count: number;
  sizeBytes: number;
}

export interface RankingDataPoint {
  period: string;
  rank: number;
  count: number;
}

export interface ReleaseGroupComparison {
  releaseGroup: string;
  downloads: number;
  sizeBytes: number;
  avgQuality: number | null;
}

export async function getTopReleaseGroupsByCount(params: ReleaseGroupStatsParams, limit = 20): Promise<TableRow[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      releaseGroup: schema.downloadEvents.releaseGroup,
      count: count(),
      totalBytes: sum(schema.downloadEvents.sizeBytes),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        isNotNull(schema.downloadEvents.releaseGroup)
      )
    )
    .groupBy(schema.downloadEvents.releaseGroup)
    .orderBy(sql`count(*) DESC`)
    .limit(limit);

  return results.map((row, index) => ({
    rank: index + 1,
    releaseGroup: row.releaseGroup ?? 'Unknown',
    downloads: Number(row.count),
    totalSize: Number(row.totalBytes ?? 0),
  }));
}

export async function getTopReleaseGroupsBySize(params: ReleaseGroupStatsParams, limit = 20): Promise<TableRow[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      releaseGroup: schema.downloadEvents.releaseGroup,
      count: count(),
      totalBytes: sum(schema.downloadEvents.sizeBytes),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        isNotNull(schema.downloadEvents.releaseGroup)
      )
    )
    .groupBy(schema.downloadEvents.releaseGroup)
    .orderBy(sql`sum(${schema.downloadEvents.sizeBytes}) DESC`)
    .limit(limit);

  return results.map((row, index) => ({
    rank: index + 1,
    releaseGroup: row.releaseGroup ?? 'Unknown',
    downloads: Number(row.count),
    totalSize: Number(row.totalBytes ?? 0),
  }));
}

export async function getReleaseGroupQualityDistribution(
  params: ReleaseGroupStatsParams,
  releaseGroup: string
): Promise<PieChartData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      resolution: schema.downloadEvents.resolution,
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        eq(schema.downloadEvents.releaseGroup, releaseGroup)
      )
    )
    .groupBy(schema.downloadEvents.resolution)
    .orderBy(sql`count(*) DESC`);

  const colors: Record<string, string> = {
    '2160p': '#9b59b6',
    '1080p': '#3498db',
    '720p': '#2ecc71',
    '576p': '#f1c40f',
    '480p': '#e67e22',
  };

  return results.map(row => ({
    label: row.resolution ?? 'Unknown',
    value: Number(row.count),
    color: colors[row.resolution ?? ''] ?? '#888',
  }));
}

export async function getFavoriteGroupsStats(params: ReleaseGroupStatsParams): Promise<TableRow[]> {
  const { startDate, endDate, favoriteGroups } = params;

  if (!favoriteGroups || favoriteGroups.length === 0) {
    return [];
  }

  const results = await db
    .select({
      releaseGroup: schema.downloadEvents.releaseGroup,
      count: count(),
      totalBytes: sum(schema.downloadEvents.sizeBytes),
      avgQualityScore: sql<number>`avg(${schema.downloadEvents.qualityScore})`,
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        inArray(schema.downloadEvents.releaseGroup, favoriteGroups)
      )
    )
    .groupBy(schema.downloadEvents.releaseGroup)
    .orderBy(sql`count(*) DESC`);

  return results.map((row, index) => ({
    rank: index + 1,
    releaseGroup: row.releaseGroup ?? 'Unknown',
    downloads: Number(row.count),
    totalSize: Number(row.totalBytes ?? 0),
    avgQualityScore: Math.round(Number(row.avgQualityScore ?? 0)),
    isFavorite: true,
  }));
}

export async function getReleaseGroupLoyalty(params: ReleaseGroupStatsParams): Promise<{
  topGroups: string[];
  loyaltyPercent: number;
  totalDownloads: number;
}> {
  const { startDate, endDate } = params;

  // Get total downloads with release groups
  const totalResult = await db
    .select({
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        isNotNull(schema.downloadEvents.releaseGroup)
      )
    );

  const totalDownloads = Number(totalResult[0]?.count ?? 0);

  // Get top 5 release groups
  const topGroups = await db
    .select({
      releaseGroup: schema.downloadEvents.releaseGroup,
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        isNotNull(schema.downloadEvents.releaseGroup)
      )
    )
    .groupBy(schema.downloadEvents.releaseGroup)
    .orderBy(sql`count(*) DESC`)
    .limit(5);

  const top5Downloads = topGroups.reduce((sum, g) => sum + Number(g.count), 0);
  const loyaltyPercent = totalDownloads > 0 ? (top5Downloads / totalDownloads) * 100 : 0;

  return {
    topGroups: topGroups.map(g => g.releaseGroup ?? 'Unknown'),
    loyaltyPercent: Math.round(loyaltyPercent * 10) / 10,
    totalDownloads,
  };
}

// ============================================
// NEW: Release Group List with comprehensive stats
// ============================================
export async function getReleaseGroupsList(
  params: ReleaseGroupStatsParams,
  limit = 50,
  offset = 0,
  sortBy: 'downloads' | 'size' | 'quality' | 'recent' = 'downloads'
): Promise<{ groups: ReleaseGroupListItem[]; total: number }> {
  const { startDate, endDate } = params;

  // Get total count of unique release groups
  const totalResult = rawDb.prepare(`
    SELECT COUNT(DISTINCT release_group) as total
    FROM download_events
    WHERE event_type = 'downloaded'
      AND release_group IS NOT NULL
      AND timestamp >= ?
      AND timestamp <= ?
  `).get(startDate, endDate) as { total: number };

  const orderBy = {
    downloads: 'total_downloads DESC',
    size: 'total_size DESC',
    quality: 'avg_quality DESC',
    recent: 'last_seen DESC',
  }[sortBy];

  const results = rawDb.prepare(`
    SELECT 
      d.release_group,
      COUNT(*) as total_downloads,
      SUM(d.size_bytes) as total_size,
      AVG(d.quality_score) as avg_quality,
      MIN(d.timestamp) as first_seen,
      MAX(d.timestamp) as last_seen,
      SUM(CASE WHEN d.source_app = 'radarr' THEN 1 ELSE 0 END) as movie_count,
      SUM(CASE WHEN d.source_app = 'sonarr' THEN 1 ELSE 0 END) as tv_count,
      SUM(CASE WHEN d.is_upgrade = 1 THEN 1 ELSE 0 END) as upgrade_count
    FROM download_events d
    WHERE d.event_type = 'downloaded'
      AND d.release_group IS NOT NULL
      AND d.timestamp >= ?
      AND d.timestamp <= ?
    GROUP BY d.release_group
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(startDate, endDate, limit, offset) as Array<{
    release_group: string;
    total_downloads: number;
    total_size: number;
    avg_quality: number | null;
    first_seen: string;
    last_seen: string;
    movie_count: number;
    tv_count: number;
    upgrade_count: number;
  }>;

  return {
    groups: results.map(row => ({
      releaseGroup: row.release_group,
      totalDownloads: row.total_downloads,
      totalSizeBytes: row.total_size,
      avgQualityScore: row.avg_quality ? Math.round(row.avg_quality) : null,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      movieCount: row.movie_count,
      tvCount: row.tv_count,
      upgradeCount: row.upgrade_count,
    })),
    total: totalResult.total,
  };
}

// ============================================
// NEW: Single release group details
// ============================================
export async function getReleaseGroupDetails(
  releaseGroup: string,
  params?: { startDate?: string; endDate?: string }
): Promise<ReleaseGroupDetails | null> {
  const startDate = params?.startDate ?? '1970-01-01';
  const endDate = params?.endDate ?? '2100-01-01';

  // Main stats
  const mainStats = rawDb.prepare(`
    SELECT 
      COUNT(*) as total_downloads,
      SUM(size_bytes) as total_size,
      AVG(quality_score) as avg_quality,
      MIN(timestamp) as first_seen,
      MAX(timestamp) as last_seen,
      SUM(CASE WHEN source_app = 'radarr' THEN 1 ELSE 0 END) as movie_count,
      SUM(CASE WHEN source_app = 'sonarr' THEN 1 ELSE 0 END) as tv_count,
      SUM(CASE WHEN is_upgrade = 1 THEN 1 ELSE 0 END) as upgrade_count
    FROM download_events
    WHERE event_type = 'downloaded'
      AND release_group = ?
      AND timestamp >= ?
      AND timestamp <= ?
  `).get(releaseGroup, startDate, endDate) as {
    total_downloads: number;
    total_size: number;
    avg_quality: number | null;
    first_seen: string | null;
    last_seen: string | null;
    movie_count: number;
    tv_count: number;
    upgrade_count: number;
  } | undefined;

  if (!mainStats || mainStats.total_downloads === 0) {
    return null;
  }

  // Resolution breakdown
  const resolutionResults = rawDb.prepare(`
    SELECT resolution, COUNT(*) as count
    FROM download_events
    WHERE event_type = 'downloaded' AND release_group = ?
      AND timestamp >= ? AND timestamp <= ?
      AND resolution IS NOT NULL
    GROUP BY resolution
    ORDER BY count DESC
  `).all(releaseGroup, startDate, endDate) as Array<{ resolution: string; count: number }>;

  // Source breakdown
  const sourceResults = rawDb.prepare(`
    SELECT quality_source as source, COUNT(*) as count
    FROM download_events
    WHERE event_type = 'downloaded' AND release_group = ?
      AND timestamp >= ? AND timestamp <= ?
      AND quality_source IS NOT NULL
    GROUP BY quality_source
    ORDER BY count DESC
  `).all(releaseGroup, startDate, endDate) as Array<{ source: string; count: number }>;

  // Codec breakdown
  const codecResults = rawDb.prepare(`
    SELECT video_codec as codec, COUNT(*) as count
    FROM download_events
    WHERE event_type = 'downloaded' AND release_group = ?
      AND timestamp >= ? AND timestamp <= ?
      AND video_codec IS NOT NULL
    GROUP BY video_codec
    ORDER BY count DESC
  `).all(releaseGroup, startDate, endDate) as Array<{ codec: string; count: number }>;

  // Top indexers
  const indexerResults = rawDb.prepare(`
    SELECT indexer, COUNT(*) as count
    FROM download_events
    WHERE event_type = 'downloaded' AND release_group = ?
      AND timestamp >= ? AND timestamp <= ?
      AND indexer IS NOT NULL
    GROUP BY indexer
    ORDER BY count DESC
    LIMIT 5
  `).all(releaseGroup, startDate, endDate) as Array<{ indexer: string; count: number }>;

  // Recent downloads
  const recentResults = rawDb.prepare(`
    SELECT m.title, d.timestamp as date, d.resolution, d.size_bytes
    FROM download_events d
    INNER JOIN media_items m ON d.media_item_id = m.id
    WHERE d.event_type = 'downloaded' AND d.release_group = ?
      AND d.timestamp >= ? AND d.timestamp <= ?
    ORDER BY d.timestamp DESC
    LIMIT 10
  `).all(releaseGroup, startDate, endDate) as Array<{
    title: string;
    date: string;
    resolution: string | null;
    size_bytes: number;
  }>;

  return {
    releaseGroup,
    totalDownloads: mainStats.total_downloads,
    totalSizeBytes: mainStats.total_size,
    avgQualityScore: mainStats.avg_quality ? Math.round(mainStats.avg_quality) : null,
    firstSeen: mainStats.first_seen ?? '',
    lastSeen: mainStats.last_seen ?? '',
    movieCount: mainStats.movie_count,
    tvCount: mainStats.tv_count,
    upgradeCount: mainStats.upgrade_count,
    resolutionBreakdown: resolutionResults.map(r => ({ label: r.resolution, value: r.count })),
    sourceBreakdown: sourceResults.map(r => ({ label: r.source, value: r.count })),
    codecBreakdown: codecResults.map(r => ({ label: r.codec, value: r.count })),
    topIndexers: indexerResults,
    recentDownloads: recentResults.map(r => ({
      title: r.title,
      date: r.date,
      resolution: r.resolution,
      sizeBytes: r.size_bytes,
    })),
  };
}

// ============================================
// NEW: Pulse view - grabs per time period (like the screenshot)
// ============================================
export async function getReleaseGroupPulse(
  releaseGroup: string,
  granularity: 'day' | 'week' | 'month' | 'year' = 'month',
  params?: { startDate?: string; endDate?: string }
): Promise<PulseDataPoint[]> {
  const startDate = params?.startDate ?? '1970-01-01';
  const endDate = params?.endDate ?? '2100-01-01';

  const dateFormat = {
    day: '%Y-%m-%d',
    week: '%Y-W%W',
    month: '%Y-%m',
    year: '%Y',
  }[granularity];

  const results = rawDb.prepare(`
    SELECT 
      strftime('${dateFormat}', timestamp) as period,
      COUNT(*) as count,
      SUM(size_bytes) as size_bytes
    FROM download_events
    WHERE event_type = 'downloaded'
      AND release_group = ?
      AND timestamp >= ?
      AND timestamp <= ?
    GROUP BY strftime('${dateFormat}', timestamp)
    ORDER BY period ASC
  `).all(releaseGroup, startDate, endDate) as Array<{
    period: string;
    count: number;
    size_bytes: number;
  }>;

  return results.map(r => ({
    period: r.period,
    count: r.count,
    sizeBytes: r.size_bytes,
  }));
}

// ============================================
// NEW: Multiple groups pulse for comparison chart
// ============================================
export async function getMultiGroupPulse(
  releaseGroups: string[],
  granularity: 'day' | 'week' | 'month' | 'year' = 'month',
  params?: { startDate?: string; endDate?: string }
): Promise<TimeSeriesData[]> {
  const startDate = params?.startDate ?? '1970-01-01';
  const endDate = params?.endDate ?? '2100-01-01';

  const dateFormat = {
    day: '%Y-%m-%d',
    week: '%Y-W%W',
    month: '%Y-%m',
    year: '%Y',
  }[granularity];

  const seriesData: TimeSeriesData[] = [];

  releaseGroups.forEach((group, index) => {
    const results = rawDb.prepare(`
      SELECT 
        strftime('${dateFormat}', timestamp) as period,
        MIN(date(timestamp)) as period_date,
        COUNT(*) as count
      FROM download_events
      WHERE event_type = 'downloaded'
        AND release_group = ?
        AND timestamp >= ?
        AND timestamp <= ?
      GROUP BY strftime('${dateFormat}', timestamp)
      ORDER BY period ASC
    `).all(group, startDate, endDate) as Array<{ period: string; period_date: string; count: number }>;

    seriesData.push({
      label: group,
      data: results.map(r => ({ timestamp: r.period_date, value: r.count })),
      color: getColorByIndex(index),
    });
  });

  return seriesData;
}

// ============================================
// NEW: Ranking over time (position in top N)
// ============================================
export async function getReleaseGroupRanking(
  releaseGroup: string,
  granularity: 'week' | 'month' | 'year' = 'month',
  params?: { startDate?: string; endDate?: string }
): Promise<RankingDataPoint[]> {
  const startDate = params?.startDate ?? '1970-01-01';
  const endDate = params?.endDate ?? '2100-01-01';

  const dateFormat = {
    week: '%Y-W%W',
    month: '%Y-%m',
    year: '%Y',
  }[granularity];

  // Get all periods
  const periods = rawDb.prepare(`
    SELECT DISTINCT strftime('${dateFormat}', timestamp) as period
    FROM download_events
    WHERE event_type = 'downloaded'
      AND timestamp >= ?
      AND timestamp <= ?
    ORDER BY period ASC
  `).all(startDate, endDate) as Array<{ period: string }>;

  const rankings: RankingDataPoint[] = [];

  for (const { period } of periods) {
    // Get ranking for this period
    const ranking = rawDb.prepare(`
      WITH period_counts AS (
        SELECT 
          release_group,
          COUNT(*) as count,
          ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as rank
        FROM download_events
        WHERE event_type = 'downloaded'
          AND release_group IS NOT NULL
          AND strftime('${dateFormat}', timestamp) = ?
        GROUP BY release_group
      )
      SELECT rank, count FROM period_counts WHERE release_group = ?
    `).get(period, releaseGroup) as { rank: number; count: number } | undefined;

    if (ranking) {
      rankings.push({
        period,
        rank: ranking.rank,
        count: ranking.count,
      });
    }
  }

  return rankings;
}

// ============================================
// NEW: Compare multiple release groups
// ============================================
export async function getReleaseGroupComparison(
  releaseGroups: string[],
  params: ReleaseGroupStatsParams
): Promise<ReleaseGroupComparison[]> {
  const { startDate, endDate } = params;

  if (releaseGroups.length === 0) {
    return [];
  }

  const placeholders = releaseGroups.map(() => '?').join(',');
  const results = rawDb.prepare(`
    SELECT 
      release_group,
      COUNT(*) as downloads,
      SUM(size_bytes) as size_bytes,
      AVG(quality_score) as avg_quality
    FROM download_events
    WHERE event_type = 'downloaded'
      AND release_group IN (${placeholders})
      AND timestamp >= ?
      AND timestamp <= ?
    GROUP BY release_group
    ORDER BY downloads DESC
  `).all(...releaseGroups, startDate, endDate) as Array<{
    release_group: string;
    downloads: number;
    size_bytes: number;
    avg_quality: number | null;
  }>;

  return results.map(r => ({
    releaseGroup: r.release_group,
    downloads: r.downloads,
    sizeBytes: r.size_bytes,
    avgQuality: r.avg_quality ? Math.round(r.avg_quality) : null,
  }));
}

// ============================================
// NEW: Get content from a specific release group
// ============================================
export async function getReleaseGroupContent(
  releaseGroup: string,
  params: ReleaseGroupStatsParams,
  limit = 50,
  offset = 0,
  mediaType?: 'movie' | 'tv'
): Promise<{
  items: Array<{
    id: number;
    title: string;
    type: string;
    date: string;
    resolution: string | null;
    quality: string | null;
    sizeBytes: number;
  }>;
  total: number;
}> {
  const { startDate, endDate } = params;

  const typeFilter = mediaType
    ? mediaType === 'movie'
      ? "AND d.source_app = 'radarr'"
      : "AND d.source_app = 'sonarr'"
    : '';

  const totalResult = rawDb.prepare(`
    SELECT COUNT(*) as total
    FROM download_events d
    WHERE d.event_type = 'downloaded'
      AND d.release_group = ?
      AND d.timestamp >= ?
      AND d.timestamp <= ?
      ${typeFilter}
  `).get(releaseGroup, startDate, endDate) as { total: number };

  const results = rawDb.prepare(`
    SELECT 
      m.id,
      m.title,
      m.type,
      d.timestamp as date,
      d.resolution,
      d.quality,
      d.size_bytes
    FROM download_events d
    INNER JOIN media_items m ON d.media_item_id = m.id
    WHERE d.event_type = 'downloaded'
      AND d.release_group = ?
      AND d.timestamp >= ?
      AND d.timestamp <= ?
      ${typeFilter}
    ORDER BY d.timestamp DESC
    LIMIT ? OFFSET ?
  `).all(releaseGroup, startDate, endDate, limit, offset) as Array<{
    id: number;
    title: string;
    type: string;
    date: string;
    resolution: string | null;
    quality: string | null;
    size_bytes: number;
  }>;

  return {
    items: results.map(r => ({
      id: r.id,
      title: r.title,
      type: r.type,
      date: r.date,
      resolution: r.resolution,
      quality: r.quality,
      sizeBytes: r.size_bytes,
    })),
    total: totalResult.total,
  };
}

// ============================================
// NEW: Search release groups
// ============================================
export async function searchReleaseGroups(
  query: string,
  params: ReleaseGroupStatsParams,
  limit = 20
): Promise<Array<{ releaseGroup: string; downloads: number }>> {
  const { startDate, endDate } = params;

  const results = rawDb.prepare(`
    SELECT 
      release_group,
      COUNT(*) as downloads
    FROM download_events
    WHERE event_type = 'downloaded'
      AND release_group IS NOT NULL
      AND release_group LIKE ?
      AND timestamp >= ?
      AND timestamp <= ?
    GROUP BY release_group
    ORDER BY downloads DESC
    LIMIT ?
  `).all(`%${query}%`, startDate, endDate, limit) as Array<{
    release_group: string;
    downloads: number;
  }>;

  return results.map(r => ({
    releaseGroup: r.release_group,
    downloads: r.downloads,
  }));
}

// ============================================
// NEW: Get all unique release groups
// ============================================
export async function getAllReleaseGroups(): Promise<string[]> {
  const results = rawDb.prepare(`
    SELECT DISTINCT release_group
    FROM download_events
    WHERE release_group IS NOT NULL
    ORDER BY release_group ASC
  `).all() as Array<{ release_group: string }>;

  return results.map(r => r.release_group);
}
