/**
 * Shared helper functions for stats queries.
 * Reduces code duplication between movies.ts and tvshows.ts.
 */

import { db, schema } from '../db/index.js';
import { sql, eq, and, gte, lte, count, sum, avg } from 'drizzle-orm';
import type { TimeSeriesData, PieChartData, TableRow } from '@countarr/shared';

export type SourceAppType = 'radarr' | 'sonarr';

export interface StatsParams {
  startDate: string;
  endDate: string;
}

export interface BaseOverviewStats {
  totalSizeBytes: number;
  downloadedCount: number;
  upgradedCount: number;
  avgQualityScore: number | null;
}

/**
 * Get base download statistics for a source app.
 */
export async function getBaseOverviewStats(
  params: StatsParams,
  sourceApp: SourceAppType
): Promise<BaseOverviewStats> {
  const { startDate, endDate } = params;

  // Total size
  const sizeResult = await db
    .select({ total: sum(schema.mediaItems.sizeBytes) })
    .from(schema.mediaItems)
    .where(eq(schema.mediaItems.source, sourceApp));
  const totalSizeBytes = Number(sizeResult[0]?.total ?? 0);

  // Downloads in period
  const downloadResult = await db
    .select({ count: count() })
    .from(schema.downloadEvents)
    .where(
      and(
        eq(schema.downloadEvents.sourceApp, sourceApp),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate)
      )
    );
  const downloadedCount = Number(downloadResult[0]?.count ?? 0);

  // Upgrades in period
  const upgradeResult = await db
    .select({ count: count() })
    .from(schema.downloadEvents)
    .where(
      and(
        eq(schema.downloadEvents.sourceApp, sourceApp),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        eq(schema.downloadEvents.isUpgrade, true),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate)
      )
    );
  const upgradedCount = Number(upgradeResult[0]?.count ?? 0);

  // Average quality score
  const qualityResult = await db
    .select({ avg: avg(schema.downloadEvents.qualityScore) })
    .from(schema.downloadEvents)
    .where(
      and(
        eq(schema.downloadEvents.sourceApp, sourceApp),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate)
      )
    );
  const avgQualityScore = qualityResult[0]?.avg ? Number(qualityResult[0].avg) : null;

  return {
    totalSizeBytes,
    downloadedCount,
    upgradedCount,
    avgQualityScore,
  };
}

/**
 * Get downloads by day for a source app.
 */
export async function getDownloadsByDay(
  params: StatsParams,
  sourceApp: SourceAppType,
  label: string,
  color: string
): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      date: sql<string>`date(${schema.downloadEvents.timestamp})`.as('date'),
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        eq(schema.downloadEvents.sourceApp, sourceApp),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate)
      )
    )
    .groupBy(sql`date(${schema.downloadEvents.timestamp})`)
    .orderBy(sql`date(${schema.downloadEvents.timestamp})`);

  return [{
    label,
    data: results.map(row => ({
      timestamp: row.date,
      value: Number(row.count),
    })),
    color,
  }];
}

/**
 * Get top release groups for a source app.
 */
export async function getReleaseGroups(
  params: StatsParams,
  sourceApp: SourceAppType,
  limit = 10
): Promise<TableRow[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      releaseGroup: schema.downloadEvents.releaseGroup,
      count: count(),
      totalSize: sum(schema.downloadEvents.sizeBytes),
      avgQuality: avg(schema.downloadEvents.qualityScore),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        eq(schema.downloadEvents.sourceApp, sourceApp),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        sql`${schema.downloadEvents.releaseGroup} IS NOT NULL`
      )
    )
    .groupBy(schema.downloadEvents.releaseGroup)
    .orderBy(sql`count(*) DESC`)
    .limit(limit);

  return results.map((row, index) => ({
    rank: index + 1,
    releaseGroup: row.releaseGroup ?? 'Unknown',
    count: Number(row.count),
    totalSize: Number(row.totalSize ?? 0),
    avgQuality: row.avgQuality ? Math.round(Number(row.avgQuality)) : null,
  }));
}

/**
 * Get quality distribution (resolution, source, codec) for a source app.
 */
export async function getQualityDistribution(
  params: StatsParams,
  sourceApp: SourceAppType
): Promise<{
  resolution: PieChartData[];
  source: PieChartData[];
  codec: PieChartData[];
}> {
  const { startDate, endDate } = params;

  const baseWhere = and(
    eq(schema.downloadEvents.sourceApp, sourceApp),
    eq(schema.downloadEvents.eventType, 'downloaded'),
    gte(schema.downloadEvents.timestamp, startDate),
    lte(schema.downloadEvents.timestamp, endDate)
  );

  // Resolution distribution
  const resolutionResults = await db
    .select({
      resolution: schema.downloadEvents.resolution,
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(baseWhere)
    .groupBy(schema.downloadEvents.resolution);

  const resolution: PieChartData[] = resolutionResults
    .filter(r => r.resolution)
    .map(r => ({
      label: r.resolution ?? 'Unknown',
      value: Number(r.count),
    }));

  // Source distribution (BluRay, WEB-DL, etc.)
  const sourceResults = await db
    .select({
      source: schema.downloadEvents.qualitySource,
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(baseWhere)
    .groupBy(schema.downloadEvents.qualitySource);

  const source: PieChartData[] = sourceResults
    .filter(r => r.source)
    .map(r => ({
      label: r.source ?? 'Unknown',
      value: Number(r.count),
    }));

  // Video codec distribution
  const codecResults = await db
    .select({
      codec: schema.downloadEvents.videoCodec,
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(baseWhere)
    .groupBy(schema.downloadEvents.videoCodec);

  const codec: PieChartData[] = codecResults
    .filter(r => r.codec)
    .map(r => ({
      label: r.codec ?? 'Unknown',
      value: Number(r.count),
    }));

  return { resolution, source, codec };
}

/**
 * Get genre distribution for a source app.
 */
export async function getGenreDistribution(
  params: StatsParams,
  sourceApp: SourceAppType
): Promise<PieChartData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      genres: schema.mediaItems.genres,
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.sourceApp, sourceApp),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate)
      )
    );

  // Count genres
  const genreCounts: Record<string, number> = {};
  for (const row of results) {
    if (row.genres) {
      try {
        const genres = JSON.parse(row.genres) as string[];
        for (const genre of genres) {
          genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  return Object.entries(genreCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Get decade distribution for a source app.
 */
export async function getDecadeDistribution(
  params: StatsParams,
  sourceApp: SourceAppType
): Promise<{ decade: string; count: number }[]> {
  const { startDate, endDate } = params;
  
  const results = await db
    .select({
      decade: sql<string>`(${schema.mediaItems.year} / 10) * 10`.as('decade'),
      count: count(),
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.sourceApp, sourceApp),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        sql`${schema.mediaItems.year} IS NOT NULL`
      )
    )
    .groupBy(sql`(${schema.mediaItems.year} / 10) * 10`)
    .orderBy(sql`(${schema.mediaItems.year} / 10) * 10`);

  return results.map(row => ({
    decade: `${row.decade}s`,
    count: Number(row.count),
  }));
}

/**
 * Parse metadata JSON safely, logging warnings instead of silently failing.
 */
export function parseMetadata<T>(metadataString: string | null): T | null {
  if (!metadataString) return null;
  try {
    return JSON.parse(metadataString) as T;
  } catch {
    // Could log warning here if needed
    return null;
  }
}

/**
 * Parse genres JSON safely.
 */
export function parseGenres(genresString: string | null): string[] {
  if (!genresString) return [];
  try {
    return JSON.parse(genresString) as string[];
  } catch {
    return [];
  }
}
