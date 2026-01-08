import { db, rawDb, schema } from '../db/index.js';
import { sql, eq, and, gte, lte, count, sum, desc, isNull } from 'drizzle-orm';
import type { TimeSeriesData, TableRow, PieChartData } from '@countarr/shared';
import { getColor, getColorForLabel } from '../utils/colors.js';

export interface PlaybackStatsParams {
  startDate: string;
  endDate: string;
}

export async function getWatchTimePerDay(params: PlaybackStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  // Count plays per day (since Activity Log doesn't include duration)
  const results = await db
    .select({
      date: sql<string>`date(${schema.playbackEvents.startedAt})`.as('date'),
      playCount: count(),
    })
    .from(schema.playbackEvents)
    .where(
      and(
        gte(schema.playbackEvents.startedAt, startDate),
        lte(schema.playbackEvents.startedAt, endDate)
      )
    )
    .groupBy(sql`date(${schema.playbackEvents.startedAt})`)
    .orderBy(sql`date(${schema.playbackEvents.startedAt})`);

  return [{
    label: 'Plays',
    data: results.map(row => ({
      timestamp: row.date,
      value: Number(row.playCount),
    })),
    color: getColor('Plays'),
  }];
}

export async function getMostWatchedContent(params: PlaybackStatsParams, limit = 20): Promise<TableRow[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      mediaItemId: schema.playbackEvents.mediaItemId,
      title: schema.mediaItems.title,
      type: schema.mediaItems.type,
      playCount: count(),
      totalSeconds: sum(schema.playbackEvents.playDurationSeconds),
    })
    .from(schema.playbackEvents)
    .innerJoin(schema.mediaItems, eq(schema.playbackEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        gte(schema.playbackEvents.startedAt, startDate),
        lte(schema.playbackEvents.startedAt, endDate)
      )
    )
    .groupBy(schema.playbackEvents.mediaItemId, schema.mediaItems.title, schema.mediaItems.type)
    .orderBy(sql`count(*) DESC`)
    .limit(limit);

  return results.map((row, index) => ({
    rank: index + 1,
    id: row.mediaItemId,
    title: row.title,
    type: row.type,
    playCount: Number(row.playCount),
    totalWatchTime: Number(row.totalSeconds ?? 0),
  }));
}

export async function getWatchedVsUnwatched(): Promise<PieChartData[]> {
  // Count media items that have been played vs not
  const watchedResult = await db
    .select({
      count: sql<number>`count(distinct ${schema.playbackEvents.mediaItemId})`,
    })
    .from(schema.playbackEvents);

  const totalResult = await db
    .select({
      count: count(),
    })
    .from(schema.mediaItems);

  const watched = Number(watchedResult[0]?.count ?? 0);
  const total = Number(totalResult[0]?.count ?? 0);
  const unwatched = Math.max(0, total - watched);

  return [
    { label: 'Watched', value: watched, color: getColor('Watched') },
    { label: 'Unwatched', value: unwatched, color: getColor('Unwatched') },
  ];
}

export async function getNeverWatchedContent(limit = 50): Promise<TableRow[]> {
  // Get media items that have never been played
  const results = await db
    .select({
      id: schema.mediaItems.id,
      title: schema.mediaItems.title,
      type: schema.mediaItems.type,
      addedAt: schema.mediaItems.addedAt,
      sizeBytes: schema.mediaItems.sizeBytes,
    })
    .from(schema.mediaItems)
    .leftJoin(schema.playbackEvents, eq(schema.mediaItems.id, schema.playbackEvents.mediaItemId))
    .where(isNull(schema.playbackEvents.id))
    .orderBy(desc(schema.mediaItems.addedAt))
    .limit(limit);

  return results.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    title: row.title,
    type: row.type,
    addedAt: row.addedAt,
    sizeBytes: row.sizeBytes,
  }));
}

export async function getTotalWatchTime(params: PlaybackStatsParams): Promise<number> {
  const { startDate, endDate } = params;

  const result = await db
    .select({
      totalSeconds: sum(schema.playbackEvents.playDurationSeconds),
    })
    .from(schema.playbackEvents)
    .where(
      and(
        gte(schema.playbackEvents.startedAt, startDate),
        lte(schema.playbackEvents.startedAt, endDate)
      )
    );

  return Number(result[0]?.totalSeconds ?? 0);
}

export async function getPlaybackMethodDistribution(params: PlaybackStatsParams): Promise<PieChartData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      method: schema.playbackEvents.playMethod,
      count: count(),
    })
    .from(schema.playbackEvents)
    .where(
      and(
        gte(schema.playbackEvents.startedAt, startDate),
        lte(schema.playbackEvents.startedAt, endDate)
      )
    )
    .groupBy(schema.playbackEvents.playMethod);

  return results.map(row => ({
    label: row.method ?? 'Unknown',
    value: Number(row.count),
    color: getColor(row.method ?? 'Unknown'),
  }));
}

export async function getAvgTimeToFirstWatch(): Promise<number> {
  // Average time from download to first watch
  // This requires joining download events with playback events
  const result = rawDb.prepare(`
    SELECT AVG(
      (julianday(p.started_at) - julianday(d.timestamp)) * 24
    ) as avgHours
    FROM playback_events p
    INNER JOIN (
      SELECT media_item_id, MIN(timestamp) as timestamp
      FROM download_events
      WHERE event_type = 'downloaded'
      GROUP BY media_item_id
    ) d ON p.media_item_id = d.media_item_id
    WHERE p.started_at > d.timestamp
  `).get() as { avgHours: number | null } | undefined;

  return Math.round(Number(result?.avgHours ?? 0));
}

// User-based playback statistics
export async function getPlaybackByUser(params: PlaybackStatsParams): Promise<TableRow[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      userName: schema.playbackEvents.userName,
      playCount: count(),
      uniqueItems: sql<number>`count(distinct ${schema.playbackEvents.mediaItemId})`,
    })
    .from(schema.playbackEvents)
    .where(
      and(
        gte(schema.playbackEvents.startedAt, startDate),
        lte(schema.playbackEvents.startedAt, endDate),
        sql`${schema.playbackEvents.userName} IS NOT NULL`
      )
    )
    .groupBy(schema.playbackEvents.userName)
    .orderBy(sql`count(*) DESC`);

  return results.map((row, index) => ({
    rank: index + 1,
    userName: row.userName ?? 'Unknown',
    playCount: Number(row.playCount),
    uniqueItems: Number(row.uniqueItems ?? 0),
  }));
}

// Plays by user over time (for stacked area chart)
export async function getWatchTimeByUserOverTime(params: PlaybackStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      date: sql<string>`date(${schema.playbackEvents.startedAt})`.as('date'),
      userName: schema.playbackEvents.userName,
      playCount: count(),
    })
    .from(schema.playbackEvents)
    .where(
      and(
        gte(schema.playbackEvents.startedAt, startDate),
        lte(schema.playbackEvents.startedAt, endDate)
      )
    )
    .groupBy(sql`date(${schema.playbackEvents.startedAt})`, schema.playbackEvents.userName)
    .orderBy(sql`date(${schema.playbackEvents.startedAt})`);

  // Group by user
  const byUser: Record<string, TimeSeriesData> = {};

  for (const row of results) {
    const userName = row.userName ?? 'Unknown';
    if (!byUser[userName]) {
      byUser[userName] = {
        label: userName,
        data: [],
        // Use hash-based color so each user always has the same color
        color: getColorForLabel(userName),
      };
    }
    byUser[userName].data.push({
      timestamp: row.date,
      value: Number(row.playCount),
    });
  }

  return Object.values(byUser);
}

// Recent playback activity
export async function getRecentPlayback(params: PlaybackStatsParams, limit = 20): Promise<TableRow[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      id: schema.playbackEvents.id,
      title: schema.mediaItems.title,
      type: schema.mediaItems.type,
      userName: schema.playbackEvents.userName,
      startedAt: schema.playbackEvents.startedAt,
      durationSeconds: schema.playbackEvents.playDurationSeconds,
      completed: schema.playbackEvents.completed,
    })
    .from(schema.playbackEvents)
    .innerJoin(schema.mediaItems, eq(schema.playbackEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        gte(schema.playbackEvents.startedAt, startDate),
        lte(schema.playbackEvents.startedAt, endDate)
      )
    )
    .orderBy(desc(schema.playbackEvents.startedAt))
    .limit(limit);

  return results.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    title: row.title,
    type: row.type,
    userName: row.userName ?? 'Unknown',
    startedAt: row.startedAt,
    durationSeconds: row.durationSeconds,
    completed: row.completed,
  }));
}
