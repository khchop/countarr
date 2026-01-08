import { db, schema } from '../db/index.js';
import { sql, eq, and, gte, lte, count, desc } from 'drizzle-orm';
import type { TimeSeriesData, PieChartData, TableRow } from '@countarr/shared';
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

export interface MovieStatsParams extends StatsParams {}

export interface MovieOverviewStats {
  totalMovies: number;
  totalSizeBytes: number;
  downloadedCount: number;
  upgradedCount: number;
  avgQualityScore: number | null;
}

export interface MovieRuntimeStats {
  shortestMinutes: number | null;
  shortestTitle: string | null;
  longestMinutes: number | null;
  longestTitle: string | null;
  averageMinutes: number | null;
  totalMinutes: number;
}

export interface DecadeDistribution {
  decade: string;
  count: number;
}

export interface YearDistribution {
  year: number;
  count: number;
}

// Get overview stats for movies
export async function getMovieOverviewStats(params: MovieStatsParams): Promise<MovieOverviewStats> {
  // Total movies in library
  const totalResult = await db
    .select({ count: count() })
    .from(schema.mediaItems)
    .where(eq(schema.mediaItems.source, 'radarr'));
  const totalMovies = Number(totalResult[0]?.count ?? 0);

  // Use shared helper for the rest
  const baseStats = await getBaseOverviewStats(params, 'radarr');

  return {
    totalMovies,
    ...baseStats,
  };
}

// Get movie downloads by day
export async function getMovieDownloadsByDay(params: MovieStatsParams): Promise<TimeSeriesData[]> {
  return getDownloadsByDay(params, 'radarr', 'Movies', '#f1c40f');
}

// Get top release groups for movies
export async function getMovieReleaseGroups(params: MovieStatsParams, limit = 10): Promise<TableRow[]> {
  return getReleaseGroups(params, 'radarr', limit);
}

// Get quality distribution for movies
export async function getMovieQualityDistribution(params: MovieStatsParams): Promise<{
  resolution: PieChartData[];
  source: PieChartData[];
  codec: PieChartData[];
}> {
  return getQualityDistribution(params, 'radarr');
}

// Get genre distribution for movies
export async function getMovieGenreDistribution(params: MovieStatsParams): Promise<PieChartData[]> {
  return getGenreDistribution(params, 'radarr');
}

// Get decade distribution for movies (based on downloads in time range)
export async function getMovieDecadeDistribution(params: MovieStatsParams): Promise<DecadeDistribution[]> {
  return getDecadeDistribution(params, 'radarr');
}

// Get year distribution for movies
export async function getMovieYearDistribution(): Promise<YearDistribution[]> {
  const results = await db
    .select({
      year: schema.mediaItems.year,
      count: count(),
    })
    .from(schema.mediaItems)
    .where(
      and(
        eq(schema.mediaItems.source, 'radarr'),
        sql`${schema.mediaItems.year} IS NOT NULL`
      )
    )
    .groupBy(schema.mediaItems.year)
    .orderBy(schema.mediaItems.year);

  return results
    .filter(r => r.year !== null)
    .map(row => ({
      year: row.year!,
      count: Number(row.count),
    }));
}

// Get runtime stats for movies (based on downloads in time range)
export async function getMovieRuntimeStats(params: MovieStatsParams): Promise<MovieRuntimeStats> {
  const { startDate, endDate } = params;
  
  // Get movies downloaded in the time range with runtime info
  const moviesInRange = await db
    .select({
      id: schema.mediaItems.id,
      title: schema.mediaItems.title,
      runtimeMinutes: schema.mediaItems.runtimeMinutes,
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.sourceApp, 'radarr'),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        sql`${schema.mediaItems.runtimeMinutes} IS NOT NULL`
      )
    )
    .groupBy(schema.mediaItems.id, schema.mediaItems.title, schema.mediaItems.runtimeMinutes);

  if (moviesInRange.length === 0) {
    return {
      shortestMinutes: null,
      shortestTitle: null,
      longestMinutes: null,
      longestTitle: null,
      averageMinutes: null,
      totalMinutes: 0,
    };
  }

  // Find shortest (excluding 0)
  const validMovies = moviesInRange.filter(m => m.runtimeMinutes && m.runtimeMinutes > 0);
  const shortest = validMovies.length > 0 
    ? validMovies.reduce((min, m) => (m.runtimeMinutes! < min.runtimeMinutes! ? m : min))
    : null;

  // Find longest
  const longest = validMovies.length > 0
    ? validMovies.reduce((max, m) => (m.runtimeMinutes! > max.runtimeMinutes! ? m : max))
    : null;

  // Calculate average and total
  const totalMinutes = validMovies.reduce((sum, m) => sum + (m.runtimeMinutes ?? 0), 0);
  const averageMinutes = validMovies.length > 0 ? Math.round(totalMinutes / validMovies.length) : null;

  return {
    shortestMinutes: shortest?.runtimeMinutes ?? null,
    shortestTitle: shortest?.title ?? null,
    longestMinutes: longest?.runtimeMinutes ?? null,
    longestTitle: longest?.title ?? null,
    averageMinutes,
    totalMinutes,
  };
}

// Get most upgraded movies
export async function getMostUpgradedMovies(params: MovieStatsParams, limit = 10): Promise<TableRow[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      mediaItemId: schema.downloadEvents.mediaItemId,
      title: schema.mediaItems.title,
      upgradeCount: count(),
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.sourceApp, 'radarr'),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        eq(schema.downloadEvents.isUpgrade, true),
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
    upgradeCount: Number(row.upgradeCount),
  }));
}

// Get oldest movies by release year
export async function getOldestMovies(limit = 10): Promise<TableRow[]> {
  const results = await db.query.mediaItems.findMany({
    where: and(
      eq(schema.mediaItems.source, 'radarr'),
      sql`${schema.mediaItems.year} IS NOT NULL`
    ),
    orderBy: [schema.mediaItems.year],
    limit,
  });

  return results.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    title: row.title,
    year: row.year,
  }));
}

// Get newest movies by release year
export async function getNewestMovies(limit = 10): Promise<TableRow[]> {
  const results = await db.query.mediaItems.findMany({
    where: and(
      eq(schema.mediaItems.source, 'radarr'),
      sql`${schema.mediaItems.year} IS NOT NULL`
    ),
    orderBy: [desc(schema.mediaItems.year)],
    limit,
  });

  return results.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    title: row.title,
    year: row.year,
  }));
}

// Get movie studios based on downloads in time range
export async function getMovieStudios(params: MovieStatsParams, limit = 10): Promise<TableRow[]> {
  const { startDate, endDate } = params;
  
  // Get movies downloaded in the time range
  const results = await db
    .select({
      metadata: schema.mediaItems.metadata,
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.sourceApp, 'radarr'),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate)
      )
    )
    .groupBy(schema.mediaItems.id); // Count each movie once per time range

  const studioCounts: Record<string, number> = {};
  for (const row of results) {
    if (row.metadata) {
      try {
        const metadata = JSON.parse(row.metadata) as { studio?: string };
        if (metadata.studio) {
          studioCounts[metadata.studio] = (studioCounts[metadata.studio] ?? 0) + 1;
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  return Object.entries(studioCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([studio, count], index) => ({
      rank: index + 1,
      studio,
      count,
    }));
}
