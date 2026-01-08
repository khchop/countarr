import { db, schema } from '../db/index.js';
import { sql, eq, and, gte, lte, count, sum } from 'drizzle-orm';
import type { TimeSeriesData } from '@countarr/shared';

export interface GrowthStatsParams {
  startDate: string;
  endDate: string;
}

export interface GrowthStats {
  // Total bytes downloaded (including upgrades)
  totalDownloaded: number;
  
  // Net library change (actual growth)
  netGrowth: number;
  
  // Breakdown
  newContentSize: number;        // Size of first-time downloads
  upgradeDownloaded: number;     // Size of upgrade downloads
  upgradeReplaced: number;       // Size of replaced files
  
  // Counts
  newMovies: number;
  newEpisodes: number;
  upgradedMovies: number;
  upgradedEpisodes: number;
  totalDownloads: number;
  totalUpgrades: number;
}

export interface GrowthByApp {
  radarr: {
    downloaded: number;
    netGrowth: number;
    newCount: number;
    upgradeCount: number;
  };
  sonarr: {
    downloaded: number;
    netGrowth: number;
    newCount: number;
    upgradeCount: number;
  };
}

// Get comprehensive growth stats for a period
export async function getGrowthStats(params: GrowthStatsParams): Promise<GrowthStats> {
  const { startDate, endDate } = params;

  const baseWhere = and(
    eq(schema.downloadEvents.eventType, 'downloaded'),
    gte(schema.downloadEvents.timestamp, startDate),
    lte(schema.downloadEvents.timestamp, endDate)
  );

  // Get all downloads with upgrade info
  const allDownloads = await db
    .select({
      sourceApp: schema.downloadEvents.sourceApp,
      sizeBytes: schema.downloadEvents.sizeBytes,
      isUpgrade: schema.downloadEvents.isUpgrade,
      previousSizeBytes: schema.downloadEvents.previousSizeBytes,
      episodeId: schema.downloadEvents.episodeId,
    })
    .from(schema.downloadEvents)
    .where(baseWhere);

  let totalDownloaded = 0;
  let newContentSize = 0;
  let upgradeDownloaded = 0;
  let upgradeReplaced = 0;
  let newMovies = 0;
  let newEpisodes = 0;
  let upgradedMovies = 0;
  let upgradedEpisodes = 0;

  for (const download of allDownloads) {
    totalDownloaded += download.sizeBytes;

    if (download.isUpgrade) {
      upgradeDownloaded += download.sizeBytes;
      upgradeReplaced += download.previousSizeBytes ?? 0;
      
      if (download.sourceApp === 'radarr') {
        upgradedMovies++;
      } else if (download.sourceApp === 'sonarr') {
        upgradedEpisodes++;
      }
    } else {
      newContentSize += download.sizeBytes;
      
      if (download.sourceApp === 'radarr') {
        newMovies++;
      } else if (download.sourceApp === 'sonarr') {
        newEpisodes++;
      }
    }
  }

  // Net growth = new content + (upgrade downloads - replaced)
  // Which simplifies to: total downloaded - replaced
  const netGrowth = totalDownloaded - upgradeReplaced;

  return {
    totalDownloaded,
    netGrowth,
    newContentSize,
    upgradeDownloaded,
    upgradeReplaced,
    newMovies,
    newEpisodes,
    upgradedMovies,
    upgradedEpisodes,
    totalDownloads: allDownloads.length,
    totalUpgrades: upgradedMovies + upgradedEpisodes,
  };
}

// Get growth stats split by app
export async function getGrowthByApp(params: GrowthStatsParams): Promise<GrowthByApp> {
  const { startDate, endDate } = params;

  const baseWhere = and(
    eq(schema.downloadEvents.eventType, 'downloaded'),
    gte(schema.downloadEvents.timestamp, startDate),
    lte(schema.downloadEvents.timestamp, endDate)
  );

  const allDownloads = await db
    .select({
      sourceApp: schema.downloadEvents.sourceApp,
      sizeBytes: schema.downloadEvents.sizeBytes,
      isUpgrade: schema.downloadEvents.isUpgrade,
      previousSizeBytes: schema.downloadEvents.previousSizeBytes,
    })
    .from(schema.downloadEvents)
    .where(baseWhere);

  const result: GrowthByApp = {
    radarr: { downloaded: 0, netGrowth: 0, newCount: 0, upgradeCount: 0 },
    sonarr: { downloaded: 0, netGrowth: 0, newCount: 0, upgradeCount: 0 },
  };

  for (const download of allDownloads) {
    const app = download.sourceApp as 'radarr' | 'sonarr';
    if (app !== 'radarr' && app !== 'sonarr') continue;

    result[app].downloaded += download.sizeBytes;

    if (download.isUpgrade) {
      result[app].upgradeCount++;
      result[app].netGrowth += download.sizeBytes - (download.previousSizeBytes ?? 0);
    } else {
      result[app].newCount++;
      result[app].netGrowth += download.sizeBytes;
    }
  }

  return result;
}

// Get growth over time (daily)
export async function getGrowthOverTime(params: GrowthStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  const results = await db
    .select({
      date: sql<string>`date(${schema.downloadEvents.timestamp})`.as('date'),
      sizeBytes: schema.downloadEvents.sizeBytes,
      isUpgrade: schema.downloadEvents.isUpgrade,
      previousSizeBytes: schema.downloadEvents.previousSizeBytes,
    })
    .from(schema.downloadEvents)
    .where(
      and(
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate)
      )
    )
    .orderBy(sql`date(${schema.downloadEvents.timestamp})`);

  // Group by date
  const dateStats: Record<string, { downloaded: number; netGrowth: number }> = {};

  for (const row of results) {
    if (!dateStats[row.date]) {
      dateStats[row.date] = { downloaded: 0, netGrowth: 0 };
    }

    dateStats[row.date].downloaded += row.sizeBytes;
    
    if (row.isUpgrade) {
      dateStats[row.date].netGrowth += row.sizeBytes - (row.previousSizeBytes ?? 0);
    } else {
      dateStats[row.date].netGrowth += row.sizeBytes;
    }
  }

  const dates = Object.keys(dateStats).sort();

  return [
    {
      label: 'Downloaded',
      data: dates.map(date => ({
        timestamp: date,
        value: dateStats[date].downloaded,
      })),
      color: '#3498db',
    },
    {
      label: 'Net Growth',
      data: dates.map(date => ({
        timestamp: date,
        value: dateStats[date].netGrowth,
      })),
      color: '#2ecc71',
    },
  ];
}

// Get current library size
export async function getCurrentLibrarySize(): Promise<{
  total: number;
  movies: number;
  tvShows: number;
}> {
  const movieSize = await db
    .select({ total: sum(schema.mediaItems.sizeBytes) })
    .from(schema.mediaItems)
    .where(eq(schema.mediaItems.source, 'radarr'));

  const tvSize = await db
    .select({ total: sum(schema.mediaItems.sizeBytes) })
    .from(schema.mediaItems)
    .where(eq(schema.mediaItems.source, 'sonarr'));

  const movies = Number(movieSize[0]?.total ?? 0);
  const tvShows = Number(tvSize[0]?.total ?? 0);

  return {
    total: movies + tvShows,
    movies,
    tvShows,
  };
}

// Calculate library size at a specific date (approximation)
// This estimates by subtracting downloads after that date
export async function getLibrarySizeAtDate(date: string): Promise<number> {
  const currentSize = await getCurrentLibrarySize();
  
  // Get net growth since that date
  const growthSince = await getGrowthStats({
    startDate: date,
    endDate: new Date().toISOString(),
  });

  // Estimate: current size - net growth since date
  return Math.max(0, currentSize.total - growthSince.netGrowth);
}

// Get library size over time (cumulative)
export async function getLibrarySizeOverTime(params: GrowthStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  // Get daily net growth
  const dailyGrowth = await getGrowthOverTime(params);
  
  if (dailyGrowth.length === 0 || dailyGrowth[0].data.length === 0) {
    return [];
  }

  // Estimate starting size
  const startingSize = await getLibrarySizeAtDate(startDate);
  
  // Build cumulative size
  let runningTotal = startingSize;
  const netGrowthData = dailyGrowth.find(d => d.label === 'Net Growth')?.data ?? [];
  
  const cumulativeData = netGrowthData.map(point => {
    runningTotal += point.value;
    return {
      timestamp: point.timestamp,
      value: runningTotal,
    };
  });

  return [{
    label: 'Library Size',
    data: cumulativeData,
    color: '#9b59b6',
  }];
}

// Get download vs upgrade breakdown
export async function getDownloadUpgradeBreakdown(params: GrowthStatsParams): Promise<{
  newDownloads: { count: number; size: number };
  upgrades: { count: number; downloaded: number; replaced: number; netGain: number };
}> {
  const stats = await getGrowthStats(params);

  return {
    newDownloads: {
      count: stats.newMovies + stats.newEpisodes,
      size: stats.newContentSize,
    },
    upgrades: {
      count: stats.totalUpgrades,
      downloaded: stats.upgradeDownloaded,
      replaced: stats.upgradeReplaced,
      netGain: stats.upgradeDownloaded - stats.upgradeReplaced,
    },
  };
}

// Get comparison between two periods
export async function getGrowthComparison(
  currentParams: GrowthStatsParams,
  previousParams: GrowthStatsParams
): Promise<{
  current: GrowthStats;
  previous: GrowthStats;
  changes: {
    downloadedChange: number; // percentage
    netGrowthChange: number;
    downloadsCountChange: number;
    upgradesCountChange: number;
  };
}> {
  const current = await getGrowthStats(currentParams);
  const previous = await getGrowthStats(previousParams);

  const calcChange = (curr: number, prev: number): number => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return {
    current,
    previous,
    changes: {
      downloadedChange: calcChange(current.totalDownloaded, previous.totalDownloaded),
      netGrowthChange: calcChange(current.netGrowth, previous.netGrowth),
      downloadsCountChange: calcChange(current.totalDownloads, previous.totalDownloads),
      upgradesCountChange: calcChange(current.totalUpgrades, previous.totalUpgrades),
    },
  };
}
