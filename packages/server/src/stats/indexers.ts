import { db, schema } from '../db/index.js';
import { sql, eq, and, gte, lte, count, sum, avg, desc, isNotNull } from 'drizzle-orm';
import type { TableRow, PieChartData, TimeSeriesData } from '@countarr/shared';
import { getColorByIndex, getColorForLabel } from '../utils/colors.js';

export interface IndexerStatsParams {
  startDate: string;
  endDate: string;
}

// Clean indexer name by removing " (Prowlarr)" suffix
function cleanIndexerName(name: string | null): string {
  if (!name) return 'Unknown';
  return name.replace(/ \(Prowlarr\)$/, '');
}

export interface IndexerOverview {
  totalGrabs: number;
  uniqueIndexers: number;
  topIndexer: string | null;
  topIndexerCount: number;
  totalSizeBytes: number;
}

export async function getIndexerOverview(params: IndexerStatsParams): Promise<IndexerOverview> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      indexer: schema.downloadEvents.indexer,
      count: count(),
      totalBytes: sum(schema.downloadEvents.sizeBytes),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'grabbed'),
        isNotNull(schema.downloadEvents.indexer),
        sql`${schema.downloadEvents.indexer} != ''`
      )
    )
    .groupBy(schema.downloadEvents.indexer)
    .orderBy(sql`count(*) DESC`);

  const totalGrabs = results.reduce((sum, r) => sum + Number(r.count), 0);
  const totalSizeBytes = results.reduce((sum, r) => sum + Number(r.totalBytes ?? 0), 0);
  const topIndexer = results[0] ? cleanIndexerName(results[0].indexer) : null;
  const topIndexerCount = results[0] ? Number(results[0].count) : 0;

  return {
    totalGrabs,
    uniqueIndexers: results.length,
    topIndexer,
    topIndexerCount,
    totalSizeBytes,
  };
}

export async function getGrabsOverTime(params: IndexerStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  // Determine granularity based on date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  let dateFormat: string;
  
  if (daysDiff <= 14) {
    dateFormat = '%Y-%m-%d';
  } else if (daysDiff <= 90) {
    dateFormat = '%Y-%W';
  } else {
    dateFormat = '%Y-%m';
  }

  const results = await db
    .select({
      period: sql<string>`strftime('${sql.raw(dateFormat)}', ${schema.downloadEvents.timestamp})`.as('period'),
      timestamp: schema.downloadEvents.timestamp,
      indexer: schema.downloadEvents.indexer,
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'grabbed'),
        isNotNull(schema.downloadEvents.indexer),
        sql`${schema.downloadEvents.indexer} != ''`
      )
    )
    .groupBy(sql`strftime('${sql.raw(dateFormat)}', ${schema.downloadEvents.timestamp})`, schema.downloadEvents.indexer)
    .orderBy(sql`strftime('${sql.raw(dateFormat)}', ${schema.downloadEvents.timestamp})`);

  // Group by indexer and period
  const byIndexer: Record<string, Record<string, number>> = {};
  const periodToTimestamp: Record<string, string> = {};
  const indexerTotals: Record<string, number> = {};

  for (const row of results) {
    const indexerName = cleanIndexerName(row.indexer);
    if (!periodToTimestamp[row.period]) {
      periodToTimestamp[row.period] = row.timestamp.split('T')[0];
    }
    if (!byIndexer[indexerName]) {
      byIndexer[indexerName] = {};
      indexerTotals[indexerName] = 0;
    }
    byIndexer[indexerName][row.period] = Number(row.count);
    indexerTotals[indexerName] += Number(row.count);
  }

  // Sort indexers by total and take top 8
  const topIndexers = Object.entries(indexerTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);

  const sortedPeriods = Object.keys(periodToTimestamp).sort();

  return topIndexers.map((indexerName) => ({
    label: indexerName,
    data: sortedPeriods.map(period => ({
      timestamp: periodToTimestamp[period],
      value: byIndexer[indexerName]?.[period] ?? 0,
    })),
    color: getColorForLabel(indexerName),
  }));
}

export async function getIndexerSuccessRates(params: IndexerStatsParams): Promise<TableRow[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      indexerName: schema.indexerStats.indexerName,
      totalGrabs: sum(schema.indexerStats.grabs),
      failedGrabs: sum(schema.indexerStats.failedGrabs),
      totalSearches: sum(schema.indexerStats.searches),
      avgResponseMs: avg(schema.indexerStats.avgResponseMs),
    })
    .from(schema.indexerStats)
    .where(
      and(
        gte(schema.indexerStats.date, startDate.split('T')[0]),
        lte(schema.indexerStats.date, endDate.split('T')[0]),
        // Exclude "Unknown" indexer - these are from history imports where indexer wasn't captured
        sql`${schema.indexerStats.indexerName} != 'Unknown'`
      )
    )
    .groupBy(schema.indexerStats.indexerName)
    .orderBy(sql`sum(${schema.indexerStats.grabs}) DESC`);

  return results.map((row, index) => {
    const total = Number(row.totalGrabs ?? 0);
    const failed = Number(row.failedGrabs ?? 0);
    
    // Safe division: if no grabs, success rate is N/A (represented as null or 100%)
    // We return 100% for "no failures out of no attempts" to avoid confusing UIs
    let successRate: number;
    if (total === 0) {
      successRate = 100; // No attempts = no failures = 100% success
    } else {
      const successful = Math.max(0, total - failed); // Ensure non-negative
      successRate = (successful / total) * 100;
    }

    return {
      rank: index + 1,
      indexer: row.indexerName,
      grabs: total,
      failed,
      successRate: Math.round(successRate * 10) / 10,
      searches: Number(row.totalSearches ?? 0),
      avgResponseMs: Math.round(Number(row.avgResponseMs ?? 0)),
    };
  });
}

export async function getGrabsByIndexer(params: IndexerStatsParams): Promise<PieChartData[]> {
  const { startDate, endDate } = params;

  // Get grabs from download events (actual usage) - only include known indexers
  const results = await db
    .select({
      indexer: schema.downloadEvents.indexer,
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'grabbed'),
        isNotNull(schema.downloadEvents.indexer),
        sql`${schema.downloadEvents.indexer} != ''`
      )
    )
    .groupBy(schema.downloadEvents.indexer)
    .orderBy(sql`count(*) DESC`);

  // Clean up indexer names: remove " (Prowlarr)" suffix
  return results.map((row, index) => {
    let label = row.indexer ?? 'Unknown';
    // Normalize: remove " (Prowlarr)" suffix
    label = label.replace(/ \(Prowlarr\)$/, '');
    
    return {
      label,
      value: Number(row.count),
      color: getColorByIndex(index),
    };
  });
}

export async function getIndexerResponseTimeTrend(params: IndexerStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  // First try indexer_stats table (has response times from Prowlarr)
  const statsResults = await db
    .select({
      date: schema.indexerStats.date,
      indexerName: schema.indexerStats.indexerName,
      avgResponseMs: schema.indexerStats.avgResponseMs,
    })
    .from(schema.indexerStats)
    .where(
      and(
        gte(schema.indexerStats.date, startDate.split('T')[0]),
        lte(schema.indexerStats.date, endDate.split('T')[0]),
        isNotNull(schema.indexerStats.avgResponseMs),
        sql`${schema.indexerStats.indexerName} != 'Unknown'`
      )
    )
    .orderBy(schema.indexerStats.date);

  // If we have multi-day stats data, use it
  const uniqueDates = new Set(statsResults.map(r => r.date));
  if (uniqueDates.size > 1) {
    const byIndexer: Record<string, TimeSeriesData> = {};
    let colorIndex = 0;

    for (const row of statsResults) {
      if (!byIndexer[row.indexerName]) {
        byIndexer[row.indexerName] = {
          label: row.indexerName,
          data: [],
          color: getColorByIndex(colorIndex++),
        };
      }
      byIndexer[row.indexerName].data.push({
        timestamp: row.date,
        value: row.avgResponseMs ?? 0,
      });
    }
    return Object.values(byIndexer);
  }

  // Otherwise, show downloads over time by indexer (more useful visualization)
  const downloadResults = await db
    .select({
      date: sql<string>`date(${schema.downloadEvents.timestamp})`.as('date'),
      indexer: schema.downloadEvents.indexer,
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        isNotNull(schema.downloadEvents.indexer)
      )
    )
    .groupBy(sql`date(${schema.downloadEvents.timestamp})`, schema.downloadEvents.indexer)
    .orderBy(sql`date(${schema.downloadEvents.timestamp})`);

  // Group by indexer (normalize names)
  const byIndexer: Record<string, TimeSeriesData> = {};
  let colorIndex = 0;

  for (const row of downloadResults) {
    const indexerName = (row.indexer ?? 'Unknown').replace(/ \(Prowlarr\)$/, '');
    if (!byIndexer[indexerName]) {
      byIndexer[indexerName] = {
        label: indexerName,
        data: [],
        color: getColorByIndex(colorIndex++),
      };
    }
    byIndexer[indexerName].data.push({
      timestamp: row.date,
      value: Number(row.count),
    });
  }

  return Object.values(byIndexer);
}

export async function getTopIndexers(params: IndexerStatsParams, limit = 10): Promise<TableRow[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      indexer: schema.downloadEvents.indexer,
      downloads: count(),
      totalBytes: sum(schema.downloadEvents.sizeBytes),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'grabbed'),
        isNotNull(schema.downloadEvents.indexer),
        sql`${schema.downloadEvents.indexer} != ''`
      )
    )
    .groupBy(schema.downloadEvents.indexer)
    .orderBy(sql`count(*) DESC`)
    .limit(limit);

  return results.map((row, index) => ({
    rank: index + 1,
    indexer: row.indexer ?? 'Unknown',
    downloads: Number(row.downloads),
    totalSize: Number(row.totalBytes ?? 0),
  }));
}
