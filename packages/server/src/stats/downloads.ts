import { db, schema } from '../db/index.js';
import { sql, eq, and, gte, lte, desc, count, sum, isNull } from 'drizzle-orm';
import type { TimeSeriesData, PieChartData } from '@countarr/shared';

export interface DownloadStatsParams {
  startDate: string;
  endDate: string;
}

// Color palette for multiple connections
const CONNECTION_COLORS = [
  '#ffc107', // Yellow (Radarr-like)
  '#3498db', // Blue (Sonarr-like)
  '#e74c3c', // Red
  '#2ecc71', // Green
  '#9b59b6', // Purple
  '#f39c12', // Orange
  '#1abc9c', // Teal
  '#34495e', // Dark blue-gray
  '#e91e63', // Pink
  '#00bcd4', // Cyan
];

export async function getDownloadsByDay(params: DownloadStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  // Query with LEFT JOIN to get connection names
  const results = await db
    .select({
      date: sql<string>`date(${schema.downloadEvents.timestamp})`.as('date'),
      connectionId: schema.downloadEvents.connectionId,
      connectionName: schema.serviceConnections.name,
      sourceApp: schema.downloadEvents.sourceApp,
      count: count(),
      totalBytes: sum(schema.downloadEvents.sizeBytes),
    })
    .from(schema.downloadEvents)
    .leftJoin(
      schema.serviceConnections,
      eq(schema.downloadEvents.connectionId, schema.serviceConnections.id)
    )
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded')
      )
    )
    .groupBy(
      sql`date(${schema.downloadEvents.timestamp})`,
      schema.downloadEvents.connectionId
    )
    .orderBy(sql`date(${schema.downloadEvents.timestamp})`);

  // Group by connection for stacked chart
  const byConnection: Record<string, TimeSeriesData> = {};
  let colorIndex = 0;

  for (const row of results) {
    // Use connection name if available, fallback to sourceApp type
    const key = row.connectionId?.toString() ?? row.sourceApp;
    const label = row.connectionName ?? (row.sourceApp.charAt(0).toUpperCase() + row.sourceApp.slice(1));
    
    if (!byConnection[key]) {
      byConnection[key] = {
        label,
        data: [],
        color: CONNECTION_COLORS[colorIndex % CONNECTION_COLORS.length],
      };
      colorIndex++;
    }
    byConnection[key].data.push({
      timestamp: row.date,
      value: Number(row.count),
    });
  }

  return Object.values(byConnection);
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

  // Query with LEFT JOIN to get connection names
  const results = await db
    .select({
      connectionId: schema.downloadEvents.connectionId,
      connectionName: schema.serviceConnections.name,
      sourceApp: schema.downloadEvents.sourceApp,
      count: count(),
    })
    .from(schema.downloadEvents)
    .leftJoin(
      schema.serviceConnections,
      eq(schema.downloadEvents.connectionId, schema.serviceConnections.id)
    )
    .where(
      and(
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        eq(schema.downloadEvents.eventType, 'downloaded')
      )
    )
    .groupBy(schema.downloadEvents.connectionId);

  return results.map((row, index) => ({
    label: row.connectionName ?? (row.sourceApp.charAt(0).toUpperCase() + row.sourceApp.slice(1)),
    value: Number(row.count),
    color: CONNECTION_COLORS[index % CONNECTION_COLORS.length],
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
