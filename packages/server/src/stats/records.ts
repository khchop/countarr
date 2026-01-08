import { db, rawDb, schema } from '../db/index.js';
import { sql, eq, and, desc, asc, count, sum, avg, gte, lte } from 'drizzle-orm';
import type { RecordStats } from '@countarr/shared';

export interface RecordStatsParams {
  startDate?: string;
  endDate?: string;
}

export interface AllTimeRecords {
  biggestDownload: { title: string; sizeBytes: number; date: string } | null;
  smallestDownload: { title: string; sizeBytes: number; date: string } | null;
  busiestDay: { date: string; downloads: number; sizeBytes: number } | null;
  busiestHour: { hour: number; downloads: number } | null;
  firstDownload: { title: string; date: string } | null;
  latestDownload: { title: string; date: string } | null;
  oldestContent: { title: string; year: number } | null;
  newestContent: { title: string; year: number } | null;
  longestRuntime: { title: string; minutes: number } | null;
  shortestRuntime: { title: string; minutes: number } | null;
  mostUpgraded: { title: string; count: number } | null;
  longestUpgradeWait: { title: string; days: number } | null;
}

export interface DownloadMilestone {
  milestone: number;
  title: string;
  date: string;
  type: 'movie' | 'series';
}

export interface HourlyPattern {
  hour: number;
  count: number;
  percentage: number;
}

export interface DayOfWeekPattern {
  dayOfWeek: number;
  dayName: string;
  count: number;
  percentage: number;
}

export interface CalendarHeatmapData {
  date: string;
  count: number;
  sizeBytes: number;
}

export interface QualityMilestone {
  quality: string;
  firstDate: string;
  firstTitle: string;
}

export interface DecadeStats {
  decade: string;
  movieCount: number;
  tvCount: number;
  totalCount: number;
}

export async function getRecordStats(params: RecordStatsParams = {}): Promise<RecordStats> {
  const { startDate, endDate } = params;

  const dateConditions = [];
  if (startDate) {
    dateConditions.push(gte(schema.downloadEvents.timestamp, startDate));
  }
  if (endDate) {
    dateConditions.push(lte(schema.downloadEvents.timestamp, endDate));
  }

  // Biggest file ever downloaded
  const biggestFile = await db
    .select({
      title: schema.mediaItems.title,
      sizeBytes: schema.downloadEvents.sizeBytes,
      date: schema.downloadEvents.timestamp,
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.eventType, 'downloaded'),
        ...dateConditions
      )
    )
    .orderBy(desc(schema.downloadEvents.sizeBytes))
    .limit(1);

  // Smallest file (excluding 0 size)
  const smallestFile = await db
    .select({
      title: schema.mediaItems.title,
      sizeBytes: schema.downloadEvents.sizeBytes,
      date: schema.downloadEvents.timestamp,
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.eventType, 'downloaded'),
        sql`${schema.downloadEvents.sizeBytes} > 0`,
        ...dateConditions
      )
    )
    .orderBy(asc(schema.downloadEvents.sizeBytes))
    .limit(1);

  // Most upgraded item
  const mostUpgraded = await db
    .select({
      title: schema.mediaItems.title,
      upgradeCount: count(),
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.eventType, 'downloaded'),
        ...dateConditions
      )
    )
    .groupBy(schema.downloadEvents.mediaItemId, schema.mediaItems.title)
    .orderBy(sql`count(*) DESC`)
    .limit(1);

  // Busiest download day
  const busiestDay = await db
    .select({
      date: sql<string>`date(${schema.downloadEvents.timestamp})`.as('date'),
      downloads: count(),
      sizeBytes: sum(schema.downloadEvents.sizeBytes),
    })
    .from(schema.downloadEvents)
    .where(
      and(
        eq(schema.downloadEvents.eventType, 'downloaded'),
        ...dateConditions
      )
    )
    .groupBy(sql`date(${schema.downloadEvents.timestamp})`)
    .orderBy(sql`count(*) DESC`)
    .limit(1);

  // Longest wait for upgrade (days between first and last download for same item)
  // Note: This query doesn't filter by date range since we want all-time records
  const longestWait = rawDb.prepare(`
    SELECT 
      m.title,
      CAST(
        (julianday(MAX(d.timestamp)) - julianday(MIN(d.timestamp))) AS INTEGER
      ) as days
    FROM download_events d
    INNER JOIN media_items m ON d.media_item_id = m.id
    WHERE d.event_type = 'downloaded'
    GROUP BY d.media_item_id
    HAVING COUNT(*) > 1
    ORDER BY days DESC
    LIMIT 1
  `).all() as Array<{ title: string; days: number }>;

  // Note: "Fastest grab" would require tracking grab-to-download time
  // which needs comparing grabbed vs downloaded events for the same item

  return {
    biggestFile: biggestFile[0] ? {
      title: biggestFile[0].title,
      sizeBytes: biggestFile[0].sizeBytes,
      date: biggestFile[0].date,
    } : { title: 'N/A', sizeBytes: 0, date: '' },

    smallestFile: smallestFile[0] ? {
      title: smallestFile[0].title,
      sizeBytes: smallestFile[0].sizeBytes,
      date: smallestFile[0].date,
    } : { title: 'N/A', sizeBytes: 0, date: '' },

    mostUpgradedItem: mostUpgraded[0] ? {
      title: mostUpgraded[0].title,
      upgradeCount: Number(mostUpgraded[0].upgradeCount) - 1, // Subtract 1 since first download isn't an upgrade
    } : { title: 'N/A', upgradeCount: 0 },

    busiestDay: busiestDay[0] ? {
      date: busiestDay[0].date,
      downloads: Number(busiestDay[0].downloads),
      sizeBytes: Number(busiestDay[0].sizeBytes ?? 0),
    } : { date: 'N/A', downloads: 0, sizeBytes: 0 },

    longestUpgradeWait: longestWait[0] ? {
      title: longestWait[0].title,
      days: longestWait[0].days,
    } : { title: 'N/A', days: 0 },

    fastestGrab: { title: 'N/A', seconds: 0 }, // Would need grab-to-download tracking
  };
}

export async function getStorageStats(): Promise<{
  totalSize: number;
  movieSize: number;
  seriesSize: number;
  avgFileSize: number;
}> {
  const totals = await db
    .select({
      type: schema.mediaItems.type,
      totalSize: sum(schema.mediaItems.sizeBytes),
      count: count(),
    })
    .from(schema.mediaItems)
    .groupBy(schema.mediaItems.type);

  let totalSize = 0;
  let movieSize = 0;
  let seriesSize = 0;
  let totalCount = 0;

  for (const row of totals) {
    const size = Number(row.totalSize ?? 0);
    const cnt = Number(row.count);
    totalSize += size;
    totalCount += cnt;

    if (row.type === 'movie') {
      movieSize = size;
    } else if (row.type === 'series') {
      seriesSize = size;
    }
  }

  return {
    totalSize,
    movieSize,
    seriesSize,
    avgFileSize: totalCount > 0 ? Math.round(totalSize / totalCount) : 0,
  };
}

export async function getContentCounts(): Promise<{
  totalItems: number;
  movies: number;
  series: number;
  episodes: number;
}> {
  const mediaCount = await db
    .select({
      type: schema.mediaItems.type,
      count: count(),
    })
    .from(schema.mediaItems)
    .groupBy(schema.mediaItems.type);

  const episodeCount = await db
    .select({
      count: count(),
    })
    .from(schema.episodes);

  let movies = 0;
  let series = 0;

  for (const row of mediaCount) {
    if (row.type === 'movie') {
      movies = Number(row.count);
    } else if (row.type === 'series') {
      series = Number(row.count);
    }
  }

  return {
    totalItems: movies + series,
    movies,
    series,
    episodes: Number(episodeCount[0]?.count ?? 0),
  };
}

// ============================================
// NEW: Comprehensive all-time records
// ============================================
export async function getAllTimeRecords(): Promise<AllTimeRecords> {
  // Biggest download
  const biggest = rawDb.prepare(`
    SELECT m.title, d.size_bytes, d.timestamp as date
    FROM download_events d
    INNER JOIN media_items m ON d.media_item_id = m.id
    WHERE d.event_type = 'downloaded' AND d.size_bytes > 0
    ORDER BY d.size_bytes DESC
    LIMIT 1
  `).get() as { title: string; size_bytes: number; date: string } | undefined;

  // Smallest download (excluding 0)
  const smallest = rawDb.prepare(`
    SELECT m.title, d.size_bytes, d.timestamp as date
    FROM download_events d
    INNER JOIN media_items m ON d.media_item_id = m.id
    WHERE d.event_type = 'downloaded' AND d.size_bytes > 0
    ORDER BY d.size_bytes ASC
    LIMIT 1
  `).get() as { title: string; size_bytes: number; date: string } | undefined;

  // Busiest day
  const busiestDayResult = rawDb.prepare(`
    SELECT 
      date(timestamp) as date,
      COUNT(*) as downloads,
      SUM(size_bytes) as size_bytes
    FROM download_events
    WHERE event_type = 'downloaded'
    GROUP BY date(timestamp)
    ORDER BY downloads DESC
    LIMIT 1
  `).get() as { date: string; downloads: number; size_bytes: number } | undefined;

  // Busiest hour (golden hour)
  const busiestHour = rawDb.prepare(`
    SELECT 
      CAST(strftime('%H', timestamp) AS INTEGER) as hour,
      COUNT(*) as downloads
    FROM download_events
    WHERE event_type = 'downloaded'
    GROUP BY strftime('%H', timestamp)
    ORDER BY downloads DESC
    LIMIT 1
  `).get() as { hour: number; downloads: number } | undefined;

  // First download ever
  const firstDownload = rawDb.prepare(`
    SELECT m.title, d.timestamp as date
    FROM download_events d
    INNER JOIN media_items m ON d.media_item_id = m.id
    WHERE d.event_type = 'downloaded'
    ORDER BY d.timestamp ASC
    LIMIT 1
  `).get() as { title: string; date: string } | undefined;

  // Latest download
  const latestDownload = rawDb.prepare(`
    SELECT m.title, d.timestamp as date
    FROM download_events d
    INNER JOIN media_items m ON d.media_item_id = m.id
    WHERE d.event_type = 'downloaded'
    ORDER BY d.timestamp DESC
    LIMIT 1
  `).get() as { title: string; date: string } | undefined;

  // Oldest content by release year
  const oldestContent = rawDb.prepare(`
    SELECT title, year
    FROM media_items
    WHERE year IS NOT NULL AND year > 1800
    ORDER BY year ASC
    LIMIT 1
  `).get() as { title: string; year: number } | undefined;

  // Newest content by release year
  const newestContent = rawDb.prepare(`
    SELECT title, year
    FROM media_items
    WHERE year IS NOT NULL
    ORDER BY year DESC
    LIMIT 1
  `).get() as { title: string; year: number } | undefined;

  // Longest runtime
  const longestRuntime = rawDb.prepare(`
    SELECT title, runtime_minutes as minutes
    FROM media_items
    WHERE runtime_minutes IS NOT NULL AND runtime_minutes > 0
    ORDER BY runtime_minutes DESC
    LIMIT 1
  `).get() as { title: string; minutes: number } | undefined;

  // Shortest runtime
  const shortestRuntime = rawDb.prepare(`
    SELECT title, runtime_minutes as minutes
    FROM media_items
    WHERE runtime_minutes IS NOT NULL AND runtime_minutes > 0
    ORDER BY runtime_minutes ASC
    LIMIT 1
  `).get() as { title: string; minutes: number } | undefined;

  // Most upgraded item
  const mostUpgraded = rawDb.prepare(`
    SELECT m.title, COUNT(*) as count
    FROM download_events d
    INNER JOIN media_items m ON d.media_item_id = m.id
    WHERE d.event_type = 'downloaded' AND d.is_upgrade = 1
    GROUP BY d.media_item_id
    ORDER BY count DESC
    LIMIT 1
  `).get() as { title: string; count: number } | undefined;

  // Longest upgrade wait (days between first and last download)
  const longestWait = rawDb.prepare(`
    SELECT 
      m.title,
      CAST(julianday(MAX(d.timestamp)) - julianday(MIN(d.timestamp)) AS INTEGER) as days
    FROM download_events d
    INNER JOIN media_items m ON d.media_item_id = m.id
    WHERE d.event_type = 'downloaded'
    GROUP BY d.media_item_id
    HAVING COUNT(*) > 1
    ORDER BY days DESC
    LIMIT 1
  `).get() as { title: string; days: number } | undefined;

  return {
    biggestDownload: biggest ? { title: biggest.title, sizeBytes: biggest.size_bytes, date: biggest.date } : null,
    smallestDownload: smallest ? { title: smallest.title, sizeBytes: smallest.size_bytes, date: smallest.date } : null,
    busiestDay: busiestDayResult ? { date: busiestDayResult.date, downloads: busiestDayResult.downloads, sizeBytes: busiestDayResult.size_bytes } : null,
    busiestHour: busiestHour ?? null,
    firstDownload: firstDownload ?? null,
    latestDownload: latestDownload ?? null,
    oldestContent: oldestContent ?? null,
    newestContent: newestContent ?? null,
    longestRuntime: longestRuntime ?? null,
    shortestRuntime: shortestRuntime ?? null,
    mostUpgraded: mostUpgraded ?? null,
    longestUpgradeWait: longestWait ?? null,
  };
}

// ============================================
// NEW: Download milestones (100th, 500th, 1000th, etc.)
// ============================================
export async function getDownloadMilestones(): Promise<DownloadMilestone[]> {
  const milestones = [1, 10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  const result: DownloadMilestone[] = [];

  // Get total count first
  const totalResult = rawDb.prepare(`
    SELECT COUNT(*) as total FROM download_events WHERE event_type = 'downloaded'
  `).get() as { total: number };

  const total = totalResult.total;

  for (const milestone of milestones) {
    if (milestone > total) break;

    const row = rawDb.prepare(`
      SELECT m.title, d.timestamp as date, m.type
      FROM download_events d
      INNER JOIN media_items m ON d.media_item_id = m.id
      WHERE d.event_type = 'downloaded'
      ORDER BY d.timestamp ASC
      LIMIT 1 OFFSET ?
    `).get(milestone - 1) as { title: string; date: string; type: string } | undefined;

    if (row) {
      result.push({
        milestone,
        title: row.title,
        date: row.date,
        type: row.type as 'movie' | 'series',
      });
    }
  }

  return result;
}

// ============================================
// NEW: Golden hour (most active download hour)
// ============================================
export async function getGoldenHour(): Promise<{ hour: number; downloads: number; percentage: number }> {
  const total = rawDb.prepare(`
    SELECT COUNT(*) as total FROM download_events WHERE event_type = 'downloaded'
  `).get() as { total: number };

  const result = rawDb.prepare(`
    SELECT 
      CAST(strftime('%H', timestamp) AS INTEGER) as hour,
      COUNT(*) as downloads
    FROM download_events
    WHERE event_type = 'downloaded'
    GROUP BY strftime('%H', timestamp)
    ORDER BY downloads DESC
    LIMIT 1
  `).get() as { hour: number; downloads: number } | undefined;

  if (!result) {
    return { hour: 0, downloads: 0, percentage: 0 };
  }

  return {
    hour: result.hour,
    downloads: result.downloads,
    percentage: total.total > 0 ? Math.round((result.downloads / total.total) * 1000) / 10 : 0,
  };
}

// ============================================
// NEW: Download patterns by hour (all-time for records)
// ============================================
export async function getRecordDownloadsByHour(): Promise<HourlyPattern[]> {
  const total = rawDb.prepare(`
    SELECT COUNT(*) as total FROM download_events WHERE event_type = 'downloaded'
  `).get() as { total: number };

  const results = rawDb.prepare(`
    SELECT 
      CAST(strftime('%H', timestamp) AS INTEGER) as hour,
      COUNT(*) as count
    FROM download_events
    WHERE event_type = 'downloaded'
    GROUP BY strftime('%H', timestamp)
    ORDER BY hour ASC
  `).all() as Array<{ hour: number; count: number }>;

  // Fill in missing hours
  const hourMap = new Map(results.map(r => [r.hour, r.count]));
  const patterns: HourlyPattern[] = [];

  for (let h = 0; h < 24; h++) {
    const count = hourMap.get(h) ?? 0;
    patterns.push({
      hour: h,
      count,
      percentage: total.total > 0 ? Math.round((count / total.total) * 1000) / 10 : 0,
    });
  }

  return patterns;
}

// ============================================
// NEW: Download patterns by day of week (all-time for records)
// ============================================
export async function getRecordDownloadsByDayOfWeek(): Promise<DayOfWeekPattern[]> {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const total = rawDb.prepare(`
    SELECT COUNT(*) as total FROM download_events WHERE event_type = 'downloaded'
  `).get() as { total: number };

  const results = rawDb.prepare(`
    SELECT 
      CAST(strftime('%w', timestamp) AS INTEGER) as day_of_week,
      COUNT(*) as count
    FROM download_events
    WHERE event_type = 'downloaded'
    GROUP BY strftime('%w', timestamp)
    ORDER BY day_of_week ASC
  `).all() as Array<{ day_of_week: number; count: number }>;

  const dayMap = new Map(results.map(r => [r.day_of_week, r.count]));
  const patterns: DayOfWeekPattern[] = [];

  for (let d = 0; d < 7; d++) {
    const count = dayMap.get(d) ?? 0;
    patterns.push({
      dayOfWeek: d,
      dayName: dayNames[d],
      count,
      percentage: total.total > 0 ? Math.round((count / total.total) * 1000) / 10 : 0,
    });
  }

  return patterns;
}

// ============================================
// NEW: Weekend vs weekday stats
// ============================================
export async function getWeekendVsWeekday(): Promise<{
  weekday: { count: number; percentage: number; avgPerDay: number };
  weekend: { count: number; percentage: number; avgPerDay: number };
}> {
  const results = rawDb.prepare(`
    SELECT 
      CASE 
        WHEN CAST(strftime('%w', timestamp) AS INTEGER) IN (0, 6) THEN 'weekend'
        ELSE 'weekday'
      END as period,
      COUNT(*) as count
    FROM download_events
    WHERE event_type = 'downloaded'
    GROUP BY period
  `).all() as Array<{ period: string; count: number }>;

  const weekday = results.find(r => r.period === 'weekday')?.count ?? 0;
  const weekend = results.find(r => r.period === 'weekend')?.count ?? 0;
  const total = weekday + weekend;

  return {
    weekday: {
      count: weekday,
      percentage: total > 0 ? Math.round((weekday / total) * 1000) / 10 : 0,
      avgPerDay: Math.round(weekday / 5), // 5 weekdays
    },
    weekend: {
      count: weekend,
      percentage: total > 0 ? Math.round((weekend / total) * 1000) / 10 : 0,
      avgPerDay: Math.round(weekend / 2), // 2 weekend days
    },
  };
}

// ============================================
// NEW: Calendar heatmap data (GitHub-style)
// ============================================
export async function getCalendarHeatmap(year?: number): Promise<CalendarHeatmapData[]> {
  const yearFilter = year ? `AND strftime('%Y', timestamp) = '${year}'` : '';

  const results = rawDb.prepare(`
    SELECT 
      date(timestamp) as date,
      COUNT(*) as count,
      SUM(size_bytes) as size_bytes
    FROM download_events
    WHERE event_type = 'downloaded'
      ${yearFilter}
    GROUP BY date(timestamp)
    ORDER BY date ASC
  `).all() as Array<{ date: string; count: number; size_bytes: number }>;

  return results.map(r => ({
    date: r.date,
    count: r.count,
    sizeBytes: r.size_bytes,
  }));
}

// ============================================
// NEW: Quality journey (first time reaching each quality)
// ============================================
export async function getQualityJourney(): Promise<QualityMilestone[]> {
  const qualities = ['2160p', '1080p', '720p', '576p', '480p'];
  const milestones: QualityMilestone[] = [];

  for (const quality of qualities) {
    const result = rawDb.prepare(`
      SELECT m.title, d.timestamp as date
      FROM download_events d
      INNER JOIN media_items m ON d.media_item_id = m.id
      WHERE d.event_type = 'downloaded' AND d.resolution = ?
      ORDER BY d.timestamp ASC
      LIMIT 1
    `).get(quality) as { title: string; date: string } | undefined;

    if (result) {
      milestones.push({
        quality,
        firstDate: result.date,
        firstTitle: result.title,
      });
    }
  }

  // Sort by date
  milestones.sort((a, b) => a.firstDate.localeCompare(b.firstDate));

  return milestones;
}

// ============================================
// NEW: Decade distribution for content
// ============================================
export async function getDecadeDistribution(): Promise<DecadeStats[]> {
  const results = rawDb.prepare(`
    SELECT 
      (year / 10) * 10 as decade,
      SUM(CASE WHEN type = 'movie' THEN 1 ELSE 0 END) as movie_count,
      SUM(CASE WHEN type = 'series' THEN 1 ELSE 0 END) as tv_count
    FROM media_items
    WHERE year IS NOT NULL AND year > 1800
    GROUP BY (year / 10) * 10
    ORDER BY decade ASC
  `).all() as Array<{ decade: number; movie_count: number; tv_count: number }>;

  return results.map(r => ({
    decade: `${r.decade}s`,
    movieCount: r.movie_count,
    tvCount: r.tv_count,
    totalCount: r.movie_count + r.tv_count,
  }));
}

// ============================================
// NEW: Streaks (consecutive days with downloads)
// ============================================
export async function getDownloadStreaks(): Promise<{
  longestStreak: { startDate: string; endDate: string; days: number };
  currentStreak: { startDate: string; days: number } | null;
}> {
  // Get all unique download dates
  const dates = rawDb.prepare(`
    SELECT DISTINCT date(timestamp) as date
    FROM download_events
    WHERE event_type = 'downloaded'
    ORDER BY date ASC
  `).all() as Array<{ date: string }>;

  if (dates.length === 0) {
    return {
      longestStreak: { startDate: '', endDate: '', days: 0 },
      currentStreak: null,
    };
  }

  let longestStreak = { startDate: '', endDate: '', days: 0 };
  let currentStreak = { startDate: dates[0].date, days: 1 };
  let tempStreak = { startDate: dates[0].date, days: 1 };

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1].date);
    const currDate = new Date(dates[i].date);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      tempStreak.days++;
    } else {
      if (tempStreak.days > longestStreak.days) {
        longestStreak = {
          startDate: tempStreak.startDate,
          endDate: dates[i - 1].date,
          days: tempStreak.days,
        };
      }
      tempStreak = { startDate: dates[i].date, days: 1 };
    }
  }

  // Check final streak
  if (tempStreak.days > longestStreak.days) {
    longestStreak = {
      startDate: tempStreak.startDate,
      endDate: dates[dates.length - 1].date,
      days: tempStreak.days,
    };
  }

  // Check if current streak is active (last download was yesterday or today)
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastDownloadDate = dates[dates.length - 1].date;

  if (lastDownloadDate === today || lastDownloadDate === yesterday) {
    currentStreak = tempStreak;
  } else {
    return { longestStreak, currentStreak: null };
  }

  return { longestStreak, currentStreak };
}

// ============================================
// NEW: Fun/quirky random stats
// ============================================
export async function getQuirkyStats(): Promise<{
  totalWatchTimeYears: number;
  avgDownloadsPerWeek: number;
  favoriteDayOfWeek: string;
  mostActiveMonth: { month: string; year: number; count: number } | null;
  downloadedOnHolidays: number;
  nightOwlPercentage: number; // Downloads between 00:00-06:00
  earlyBirdPercentage: number; // Downloads between 06:00-12:00
}> {
  // Total watch time (sum of all runtimes)
  const runtimeResult = rawDb.prepare(`
    SELECT SUM(runtime_minutes) as total
    FROM media_items
    WHERE runtime_minutes IS NOT NULL
  `).get() as { total: number } | undefined;
  const totalMinutes = runtimeResult?.total ?? 0;
  const totalWatchTimeYears = Math.round((totalMinutes / 60 / 24 / 365) * 100) / 100;

  // Average downloads per week
  const downloadStats = rawDb.prepare(`
    SELECT 
      COUNT(*) as total,
      MIN(timestamp) as first_date,
      MAX(timestamp) as last_date
    FROM download_events
    WHERE event_type = 'downloaded'
  `).get() as { total: number; first_date: string; last_date: string } | undefined;

  let avgDownloadsPerWeek = 0;
  if (downloadStats && downloadStats.first_date && downloadStats.last_date) {
    const firstDate = new Date(downloadStats.first_date);
    const lastDate = new Date(downloadStats.last_date);
    const weeks = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7)));
    avgDownloadsPerWeek = Math.round((downloadStats.total / weeks) * 10) / 10;
  }

  // Favorite day of week
  const dayResult = rawDb.prepare(`
    SELECT 
      CAST(strftime('%w', timestamp) AS INTEGER) as day_of_week,
      COUNT(*) as count
    FROM download_events
    WHERE event_type = 'downloaded'
    GROUP BY strftime('%w', timestamp)
    ORDER BY count DESC
    LIMIT 1
  `).get() as { day_of_week: number; count: number } | undefined;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const favoriteDayOfWeek = dayResult ? dayNames[dayResult.day_of_week] : 'N/A';

  // Most active month
  const monthResult = rawDb.prepare(`
    SELECT 
      strftime('%m', timestamp) as month,
      CAST(strftime('%Y', timestamp) AS INTEGER) as year,
      COUNT(*) as count
    FROM download_events
    WHERE event_type = 'downloaded'
    GROUP BY strftime('%Y-%m', timestamp)
    ORDER BY count DESC
    LIMIT 1
  `).get() as { month: string; year: number; count: number } | undefined;

  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const mostActiveMonth = monthResult 
    ? { month: monthNames[parseInt(monthResult.month)], year: monthResult.year, count: monthResult.count }
    : null;

  // Night owl vs early bird
  const timeStats = rawDb.prepare(`
    SELECT 
      SUM(CASE WHEN CAST(strftime('%H', timestamp) AS INTEGER) BETWEEN 0 AND 5 THEN 1 ELSE 0 END) as night_owl,
      SUM(CASE WHEN CAST(strftime('%H', timestamp) AS INTEGER) BETWEEN 6 AND 11 THEN 1 ELSE 0 END) as early_bird,
      COUNT(*) as total
    FROM download_events
    WHERE event_type = 'downloaded'
  `).get() as { night_owl: number; early_bird: number; total: number };

  return {
    totalWatchTimeYears,
    avgDownloadsPerWeek,
    favoriteDayOfWeek,
    mostActiveMonth,
    downloadedOnHolidays: 0, // Would need a holiday calendar to calculate
    nightOwlPercentage: timeStats.total > 0 ? Math.round((timeStats.night_owl / timeStats.total) * 1000) / 10 : 0,
    earlyBirdPercentage: timeStats.total > 0 ? Math.round((timeStats.early_bird / timeStats.total) * 1000) / 10 : 0,
  };
}

// ============================================
// NEW: Library insights - useful dynamic facts
// ============================================
export async function getLibraryInsights(): Promise<{
  releaseGroupLoyalty: { group: string; percentage: number; count: number } | null;
  mostBingedShow: { title: string; episodesInOneDay: number; date: string } | null;
  avgUpgradeTime: { days: number; sampleSize: number } | null;
  genreVariety: { uniqueGenres: number; topGenre: string; topGenrePercentage: number } | null;
  qualityBreakdown: { resolution: string; percentage: number }[];
  seriesCompletionRate: { completed: number; inProgress: number; percentage: number } | null;
  avgMovieSize: { bytes: number; comparedToTypical: string } | null;
  oldestWatched: { title: string; year: number } | null;
  newestReleaseDownloaded: { title: string; daysAfterRelease: number } | null;
}> {
  // Release group loyalty - which group do you get most content from
  const groupLoyalty = rawDb.prepare(`
    SELECT release_group, COUNT(*) as count
    FROM download_events
    WHERE event_type = 'downloaded' AND release_group IS NOT NULL AND release_group != ''
    GROUP BY release_group
    ORDER BY count DESC
    LIMIT 1
  `).get() as { release_group: string; count: number } | undefined;

  const totalDownloads = rawDb.prepare(`
    SELECT COUNT(*) as total FROM download_events WHERE event_type = 'downloaded'
  `).get() as { total: number };

  // Most binged show - most episodes downloaded in one day for same series
  const mostBinged = rawDb.prepare(`
    SELECT m.title, COUNT(*) as episode_count, date(d.timestamp) as date
    FROM download_events d
    INNER JOIN media_items m ON d.media_item_id = m.id
    WHERE d.event_type = 'downloaded' AND d.source_app = 'sonarr'
    GROUP BY m.id, date(d.timestamp)
    ORDER BY episode_count DESC
    LIMIT 1
  `).get() as { title: string; episode_count: number; date: string } | undefined;

  // Average time between first download and first upgrade for upgraded items
  const avgUpgrade = rawDb.prepare(`
    SELECT AVG(upgrade_days) as avg_days, COUNT(*) as sample_size FROM (
      SELECT 
        media_item_id,
        CAST(julianday(MAX(timestamp)) - julianday(MIN(timestamp)) AS INTEGER) as upgrade_days
      FROM download_events
      WHERE event_type = 'downloaded'
      GROUP BY media_item_id
      HAVING COUNT(*) > 1
    )
  `).get() as { avg_days: number; sample_size: number } | undefined;

  // Genre variety
  const genreData = rawDb.prepare(`
    SELECT genres FROM media_items WHERE genres IS NOT NULL
  `).all() as Array<{ genres: string }>;

  const genreCounts: Record<string, number> = {};
  let totalGenreItems = 0;
  const uniqueGenres = new Set<string>();

  for (const row of genreData) {
    try {
      const genres = JSON.parse(row.genres) as string[];
      for (const g of genres) {
        uniqueGenres.add(g);
        genreCounts[g] = (genreCounts[g] ?? 0) + 1;
        totalGenreItems++;
      }
    } catch { /* ignore */ }
  }

  const topGenreEntry = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0];

  // Quality breakdown
  const qualityData = rawDb.prepare(`
    SELECT resolution, COUNT(*) as count
    FROM download_events
    WHERE event_type = 'downloaded' AND resolution IS NOT NULL AND resolution != ''
    GROUP BY resolution
    ORDER BY count DESC
  `).all() as Array<{ resolution: string; count: number }>;

  const totalQuality = qualityData.reduce((sum, q) => sum + q.count, 0);

  // Series completion rate (series with all episodes vs in progress)
  // This is an approximation - we count series with recent downloads as "in progress"
  const seriesStats = rawDb.prepare(`
    SELECT 
      COUNT(DISTINCT CASE WHEN last_download < date('now', '-90 days') THEN media_item_id END) as likely_completed,
      COUNT(DISTINCT CASE WHEN last_download >= date('now', '-90 days') THEN media_item_id END) as in_progress
    FROM (
      SELECT media_item_id, MAX(timestamp) as last_download
      FROM download_events
      WHERE event_type = 'downloaded' AND source_app = 'sonarr'
      GROUP BY media_item_id
    )
  `).get() as { likely_completed: number; in_progress: number } | undefined;

  // Average movie size
  const movieSizeData = rawDb.prepare(`
    SELECT AVG(d.size_bytes) as avg_size
    FROM download_events d
    INNER JOIN media_items m ON d.media_item_id = m.id
    WHERE d.event_type = 'downloaded' AND d.source_app = 'radarr'
  `).get() as { avg_size: number } | undefined;

  // Typical movie size is around 8-15 GB for 1080p
  const typicalMovieSize = 10 * 1024 * 1024 * 1024; // 10 GB
  let comparedToTypical = 'typical';
  if (movieSizeData?.avg_size) {
    const ratio = movieSizeData.avg_size / typicalMovieSize;
    if (ratio > 1.5) comparedToTypical = 'larger than typical (quality hunter!)';
    else if (ratio > 1.1) comparedToTypical = 'slightly above average';
    else if (ratio < 0.7) comparedToTypical = 'smaller than typical (space saver!)';
    else if (ratio < 0.9) comparedToTypical = 'slightly below average';
    else comparedToTypical = 'about average';
  }

  // Oldest content that was played (if playback data exists)
  const oldestWatched = rawDb.prepare(`
    SELECT m.title, m.year
    FROM playback_events p
    INNER JOIN media_items m ON p.media_item_id = m.id
    WHERE m.year IS NOT NULL AND m.year > 1800
    ORDER BY m.year ASC
    LIMIT 1
  `).get() as { title: string; year: number } | undefined;

  return {
    releaseGroupLoyalty: groupLoyalty ? {
      group: groupLoyalty.release_group,
      percentage: Math.round((groupLoyalty.count / totalDownloads.total) * 100),
      count: groupLoyalty.count,
    } : null,
    mostBingedShow: mostBinged && mostBinged.episode_count > 1 ? {
      title: mostBinged.title,
      episodesInOneDay: mostBinged.episode_count,
      date: mostBinged.date,
    } : null,
    avgUpgradeTime: avgUpgrade && avgUpgrade.sample_size > 0 ? {
      days: Math.round(avgUpgrade.avg_days),
      sampleSize: avgUpgrade.sample_size,
    } : null,
    genreVariety: topGenreEntry ? {
      uniqueGenres: uniqueGenres.size,
      topGenre: topGenreEntry[0],
      topGenrePercentage: Math.round((topGenreEntry[1] / totalGenreItems) * 100),
    } : null,
    qualityBreakdown: qualityData.slice(0, 4).map(q => ({
      resolution: q.resolution,
      percentage: Math.round((q.count / totalQuality) * 100),
    })),
    seriesCompletionRate: seriesStats ? {
      completed: seriesStats.likely_completed,
      inProgress: seriesStats.in_progress,
      percentage: seriesStats.likely_completed + seriesStats.in_progress > 0
        ? Math.round((seriesStats.likely_completed / (seriesStats.likely_completed + seriesStats.in_progress)) * 100)
        : 0,
    } : null,
    avgMovieSize: movieSizeData?.avg_size ? {
      bytes: Math.round(movieSizeData.avg_size),
      comparedToTypical,
    } : null,
    oldestWatched: oldestWatched ?? null,
    newestReleaseDownloaded: null, // Would need release date data
  };
}

// ============================================
// NEW: Monthly summary for a specific month
// ============================================
export async function getMonthlySummary(year: number, month: number): Promise<{
  downloads: number;
  sizeBytes: number;
  upgrades: number;
  topReleaseGroup: string | null;
  topGenre: string | null;
  avgQuality: number | null;
  busiestDay: { date: string; count: number } | null;
}> {
  const monthStr = month.toString().padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const endDate = `${year}-${monthStr}-31`;

  // Basic stats
  const stats = rawDb.prepare(`
    SELECT 
      COUNT(*) as downloads,
      SUM(size_bytes) as size_bytes,
      SUM(CASE WHEN is_upgrade = 1 THEN 1 ELSE 0 END) as upgrades,
      AVG(quality_score) as avg_quality
    FROM download_events
    WHERE event_type = 'downloaded'
      AND timestamp >= ?
      AND timestamp <= ?
  `).get(startDate, endDate) as { downloads: number; size_bytes: number; upgrades: number; avg_quality: number | null };

  // Top release group
  const topGroup = rawDb.prepare(`
    SELECT release_group, COUNT(*) as count
    FROM download_events
    WHERE event_type = 'downloaded'
      AND release_group IS NOT NULL
      AND timestamp >= ?
      AND timestamp <= ?
    GROUP BY release_group
    ORDER BY count DESC
    LIMIT 1
  `).get(startDate, endDate) as { release_group: string; count: number } | undefined;

  // Busiest day
  const busiestDay = rawDb.prepare(`
    SELECT date(timestamp) as date, COUNT(*) as count
    FROM download_events
    WHERE event_type = 'downloaded'
      AND timestamp >= ?
      AND timestamp <= ?
    GROUP BY date(timestamp)
    ORDER BY count DESC
    LIMIT 1
  `).get(startDate, endDate) as { date: string; count: number } | undefined;

  return {
    downloads: stats.downloads,
    sizeBytes: stats.size_bytes,
    upgrades: stats.upgrades,
    topReleaseGroup: topGroup?.release_group ?? null,
    topGenre: null, // Would need to parse genre JSON
    avgQuality: stats.avg_quality ? Math.round(stats.avg_quality) : null,
    busiestDay: busiestDay ?? null,
  };
}
