import { db, schema } from '../db/index.js';
import { sql, eq, and, gte, lte, desc, count, sum } from 'drizzle-orm';
import type { TimeSeriesData, PieChartData } from '@countarr/shared';

export interface DownloadStatsParams {
  startDate: string;
  endDate: string;
}

export async function getDownloadsByDay(params: DownloadStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      date: sql<string>`date(${schema.downloadEvents.timestamp})`.as('date'),
      sourceApp: schema.downloadEvents.sourceApp,
      count: count(),
      totalBytes: sum(schema.downloadEvents.sizeBytes),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded')
      )
    )
    .groupBy(sql`date(${schema.downloadEvents.timestamp})`, schema.downloadEvents.sourceApp)
    .orderBy(sql`date(${schema.downloadEvents.timestamp})`);

  // Group by source app for stacked chart
  const byApp: Record<string, TimeSeriesData> = {};
  const colors: Record<string, string> = {
    radarr: '#ffc107',
    sonarr: '#3498db',
  };

  for (const row of results) {
    const app = row.sourceApp;
    if (!byApp[app]) {
      byApp[app] = {
        label: app.charAt(0).toUpperCase() + app.slice(1),
        data: [],
        color: colors[app] ?? '#888',
      };
    }
    byApp[app].data.push({
      timestamp: row.date,
      value: Number(row.count),
    });
  }

  return Object.values(byApp);
}

export async function getDownloadSizeByDay(params: DownloadStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      date: sql<string>`date(${schema.downloadEvents.timestamp})`.as('date'),
      totalBytes: sum(schema.downloadEvents.sizeBytes),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded')
      )
    )
    .groupBy(sql`date(${schema.downloadEvents.timestamp})`)
    .orderBy(sql`date(${schema.downloadEvents.timestamp})`);

  return [{
    label: 'Download Size',
    data: results.map(row => ({
      timestamp: row.date,
      value: Number(row.totalBytes ?? 0) / (1024 * 1024 * 1024), // Convert to GB
    })),
    color: '#3274d9',
  }];
}

export async function getDownloadsByHour(params: DownloadStatsParams): Promise<number[][]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      dayOfWeek: sql<number>`cast(strftime('%w', ${schema.downloadEvents.timestamp}) as integer)`.as('dow'),
      hour: sql<number>`cast(strftime('%H', ${schema.downloadEvents.timestamp}) as integer)`.as('hour'),
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded')
      )
    )
    .groupBy(
      sql`strftime('%w', ${schema.downloadEvents.timestamp})`,
      sql`strftime('%H', ${schema.downloadEvents.timestamp})`
    );

  // Initialize 7x24 grid (days x hours)
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const row of results) {
    heatmap[row.dayOfWeek][row.hour] = Number(row.count);
  }

  return heatmap;
}

export async function getDownloadsByDayOfWeek(params: DownloadStatsParams): Promise<PieChartData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      dayOfWeek: sql<number>`cast(strftime('%w', ${schema.downloadEvents.timestamp}) as integer)`.as('dow'),
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded')
      )
    )
    .groupBy(sql`strftime('%w', ${schema.downloadEvents.timestamp})`)
    .orderBy(sql`strftime('%w', ${schema.downloadEvents.timestamp})`);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const colors = ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#c9cbcf'];

  return results.map(row => ({
    label: dayNames[row.dayOfWeek],
    value: Number(row.count),
    color: colors[row.dayOfWeek],
  }));
}

export async function getDownloadsByApp(params: DownloadStatsParams): Promise<PieChartData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      sourceApp: schema.downloadEvents.sourceApp,
      count: count(),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded')
      )
    )
    .groupBy(schema.downloadEvents.sourceApp);

  const colors: Record<string, string> = {
    radarr: '#ffc107',
    sonarr: '#3498db',
  };

  return results.map(row => ({
    label: row.sourceApp.charAt(0).toUpperCase() + row.sourceApp.slice(1),
    value: Number(row.count),
    color: colors[row.sourceApp] ?? '#888',
  }));
}

export async function getTotalDownloads(params: DownloadStatsParams): Promise<{ count: number; bytes: number }> {
  const { startDate, endDate } = params;

  const result = await db
    .select({
      count: count(),
      totalBytes: sum(schema.downloadEvents.sizeBytes),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded')
      )
    );

  return {
    count: Number(result[0]?.count ?? 0),
    bytes: Number(result[0]?.totalBytes ?? 0),
  };
}
