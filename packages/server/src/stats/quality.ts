import { db, schema } from '../db/index.js';
import { sql, eq, and, gte, lte, count, avg, isNotNull } from 'drizzle-orm';
import type { PieChartData, TimeSeriesData } from '@countarr/shared';

export interface QualityStatsParams {
  startDate: string;
  endDate: string;
}

export async function getResolutionDistribution(params: QualityStatsParams): Promise<PieChartData[]> {
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
        isNotNull(schema.downloadEvents.resolution)
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
    'unknown': '#95a5a6',
  };

  return results.map(row => ({
    label: row.resolution ?? 'Unknown',
    value: Number(row.count),
    color: colors[row.resolution ?? 'unknown'] ?? '#888',
  }));
}

export async function getSourceDistribution(params: QualityStatsParams): Promise<PieChartData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      source: schema.downloadEvents.qualitySource,
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        isNotNull(schema.downloadEvents.qualitySource)
      )
    )
    .groupBy(schema.downloadEvents.qualitySource)
    .orderBy(sql`count(*) DESC`);

  const colors: Record<string, string> = {
    'remux': '#9b59b6',
    'bluray': '#3498db',
    'webdl': '#2ecc71',
    'webrip': '#1abc9c',
    'hdtv': '#f1c40f',
    'dvd': '#e67e22',
    'unknown': '#95a5a6',
  };

  const labels: Record<string, string> = {
    'remux': 'Remux',
    'bluray': 'BluRay',
    'webdl': 'WEB-DL',
    'webrip': 'WEBRip',
    'hdtv': 'HDTV',
    'dvd': 'DVD',
    'unknown': 'Unknown',
  };

  return results.map(row => ({
    label: labels[row.source ?? 'unknown'] ?? row.source ?? 'Unknown',
    value: Number(row.count),
    color: colors[row.source ?? 'unknown'] ?? '#888',
  }));
}

export async function getCodecDistribution(params: QualityStatsParams): Promise<PieChartData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      codec: schema.downloadEvents.videoCodec,
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        isNotNull(schema.downloadEvents.videoCodec)
      )
    )
    .groupBy(schema.downloadEvents.videoCodec)
    .orderBy(sql`count(*) DESC`);

  const colors: Record<string, string> = {
    'x265': '#9b59b6',
    'hevc': '#9b59b6',
    'h265': '#9b59b6',
    'av1': '#e74c3c',
    'x264': '#3498db',
    'h264': '#3498db',
    'unknown': '#95a5a6',
  };

  return results.map(row => ({
    label: (row.codec ?? 'Unknown').toUpperCase(),
    value: Number(row.count),
    color: colors[(row.codec ?? 'unknown').toLowerCase()] ?? '#888',
  }));
}

export async function getQualityScoreTrend(params: QualityStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      date: sql<string>`date(${schema.downloadEvents.timestamp})`.as('date'),
      avgScore: avg(schema.downloadEvents.qualityScore),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        isNotNull(schema.downloadEvents.qualityScore)
      )
    )
    .groupBy(sql`date(${schema.downloadEvents.timestamp})`)
    .orderBy(sql`date(${schema.downloadEvents.timestamp})`);

  return [{
    label: 'Avg Quality Score',
    data: results.map(row => ({
      timestamp: row.date,
      value: Number(row.avgScore ?? 0),
    })),
    color: '#3274d9',
  }];
}

export async function getQualityOverTime(params: QualityStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  // Get resolution distribution over time for stacked area chart
  const results = await db
    .select({
      date: sql<string>`date(${schema.downloadEvents.timestamp})`.as('date'),
      resolution: schema.downloadEvents.resolution,
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        isNotNull(schema.downloadEvents.resolution)
      )
    )
    .groupBy(sql`date(${schema.downloadEvents.timestamp})`, schema.downloadEvents.resolution)
    .orderBy(sql`date(${schema.downloadEvents.timestamp})`);

  const colors: Record<string, string> = {
    '2160p': '#9b59b6',
    '1080p': '#3498db',
    '720p': '#2ecc71',
    '576p': '#f1c40f',
    '480p': '#e67e22',
  };

  const byResolution: Record<string, TimeSeriesData> = {};

  for (const row of results) {
    const res = row.resolution ?? 'unknown';
    if (!byResolution[res]) {
      byResolution[res] = {
        label: res,
        data: [],
        color: colors[res] ?? '#888',
      };
    }
    byResolution[res].data.push({
      timestamp: row.date,
      value: Number(row.count),
    });
  }

  // Sort by quality (best first)
  const order = ['2160p', '1080p', '720p', '576p', '480p', 'unknown'];
  return order
    .filter(res => byResolution[res])
    .map(res => byResolution[res]);
}

export async function getAverageQualityScore(params: QualityStatsParams): Promise<number> {
  const { startDate, endDate } = params;

  const result = await db
    .select({
      avgScore: avg(schema.downloadEvents.qualityScore),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded'),
        isNotNull(schema.downloadEvents.qualityScore)
      )
    );

  return Number(result[0]?.avgScore ?? 0);
}
