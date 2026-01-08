import { db, schema } from '../db/index.js';
import { sql, eq, and, gte, lte, count } from 'drizzle-orm';
import type { PieChartData, TimeSeriesData, TableRow } from '@countarr/shared';
import { getColorByIndex } from '../utils/colors.js';

export interface GenreStatsParams {
  startDate: string;
  endDate: string;
  type?: 'movie' | 'series' | 'all';
}

export interface GenreDetail {
  genre: string;
  movieCount: number;
  tvCount: number;
  totalCount: number;
  totalSizeBytes: number;
  topReleaseGroups: { name: string; count: number }[];
  recentDownloads: { title: string; timestamp: string; type: string }[];
}

export interface GenreDiversity {
  score: number; // 0-10 scale
  totalGenres: number;
  topGenre: string | null;
  topGenrePercentage: number;
}

export interface GenreSeasonality {
  genre: string;
  peakMonth: number;
  monthName: string;
}

// Get overall genre distribution (counts unique media items, not individual episodes)
export async function getGenreDistribution(params: GenreStatsParams): Promise<PieChartData[]> {
  const { startDate, endDate, type = 'all' } = params;

  // Build source filter
  const sourceConditions = [];
  if (type === 'movie') {
    sourceConditions.push(eq(schema.downloadEvents.sourceApp, 'radarr'));
  } else if (type === 'series') {
    sourceConditions.push(eq(schema.downloadEvents.sourceApp, 'sonarr'));
  }

  // Get distinct media items with downloads in period
  const results = await db
    .selectDistinct({
      mediaItemId: schema.downloadEvents.mediaItemId,
      genres: schema.mediaItems.genres,
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        ...sourceConditions
      )
    );

  // Count genres by unique media items (not episode downloads)
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

// Get genre trends over time (auto-granularity based on date range)
export async function getGenreOverTime(params: GenreStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate, type = 'all' } = params;

  // Determine granularity based on date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  let dateFormat: string;
  
  if (daysDiff <= 14) {
    // Daily for 2 weeks or less
    dateFormat = '%Y-%m-%d';
  } else if (daysDiff <= 90) {
    // Weekly for up to 3 months
    dateFormat = '%Y-%W';
  } else {
    // Monthly for longer periods
    dateFormat = '%Y-%m';
  }

  const sourceConditions = [];
  if (type === 'movie') {
    sourceConditions.push(eq(schema.downloadEvents.sourceApp, 'radarr'));
  } else if (type === 'series') {
    sourceConditions.push(eq(schema.downloadEvents.sourceApp, 'sonarr'));
  }

  const results = await db
    .select({
      period: sql<string>`strftime('${sql.raw(dateFormat)}', ${schema.downloadEvents.timestamp})`.as('period'),
      timestamp: schema.downloadEvents.timestamp,
      genres: schema.mediaItems.genres,
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        ...sourceConditions
      )
    );

  // Build genre -> period -> count map
  const genrePeriodCounts: Record<string, Record<string, number>> = {};
  // Map period key to a valid ISO date (first date seen in that period)
  const periodToDate: Record<string, string> = {};

  for (const row of results) {
    if (row.genres && row.period) {
      // Store the first timestamp for each period - use just the date part (YYYY-MM-DD)
      if (!periodToDate[row.period]) {
        periodToDate[row.period] = row.timestamp.split('T')[0];
      }
      try {
        const genres = JSON.parse(row.genres) as string[];
        for (const genre of genres) {
          if (!genrePeriodCounts[genre]) {
            genrePeriodCounts[genre] = {};
          }
          genrePeriodCounts[genre][row.period] = (genrePeriodCounts[genre][row.period] ?? 0) + 1;
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Get top genres (limit to top 8 for readability)
  const genreTotals = Object.entries(genrePeriodCounts)
    .map(([genre, periods]) => ({
      genre,
      total: Object.values(periods).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const sortedPeriods = Object.keys(periodToDate).sort();

  return genreTotals.map(({ genre }, index) => ({
    label: genre,
    data: sortedPeriods.map(period => ({
      // Use the actual date from the period, which is always a valid ISO date (YYYY-MM-DD)
      timestamp: periodToDate[period],
      value: genrePeriodCounts[genre]?.[period] ?? 0,
    })),
    color: getColorByIndex(index),
  }));
}

// Get genre by decade matrix
export async function getGenreByDecade(): Promise<{ genre: string; decade: string; count: number }[]> {
  const results = await db
    .select({
      decade: sql<number>`(${schema.mediaItems.year} / 10) * 10`.as('decade'),
      genres: schema.mediaItems.genres,
    })
    .from(schema.mediaItems)
    .where(sql`${schema.mediaItems.year} IS NOT NULL`);

  const genreDecadeCounts: Record<string, Record<string, number>> = {};

  for (const row of results) {
    if (row.genres && row.decade) {
      const decadeStr = `${row.decade}s`;
      try {
        const genres = JSON.parse(row.genres) as string[];
        for (const genre of genres) {
          if (!genreDecadeCounts[genre]) {
            genreDecadeCounts[genre] = {};
          }
          genreDecadeCounts[genre][decadeStr] = (genreDecadeCounts[genre][decadeStr] ?? 0) + 1;
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  const result: { genre: string; decade: string; count: number }[] = [];
  for (const [genre, decades] of Object.entries(genreDecadeCounts)) {
    for (const [decade, count] of Object.entries(decades)) {
      result.push({ genre, decade, count });
    }
  }

  return result;
}

// Get top genre for a period
export async function getTopGenreThisPeriod(params: GenreStatsParams): Promise<{
  genre: string | null;
  count: number;
  change: number | null; // Percentage change from previous period
}> {
  const distribution = await getGenreDistribution(params);
  
  if (distribution.length === 0) {
    return { genre: null, count: 0, change: null };
  }

  const topGenre = distribution[0];

  // Calculate previous period for comparison
  const startDate = new Date(params.startDate);
  const endDate = new Date(params.endDate);
  const periodMs = endDate.getTime() - startDate.getTime();
  
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - periodMs);

  const prevDistribution = await getGenreDistribution({
    startDate: prevStartDate.toISOString(),
    endDate: prevEndDate.toISOString(),
    type: params.type,
  });

  const prevTopGenre = prevDistribution.find(g => g.label === topGenre.label);
  const prevCount = prevTopGenre?.value ?? 0;
  
  let change: number | null = null;
  if (prevCount > 0) {
    change = Math.round(((topGenre.value - prevCount) / prevCount) * 100);
  }

  return {
    genre: topGenre.label,
    count: topGenre.value,
    change,
  };
}

// Get genre seasonality (which genres are popular in which months)
export async function getGenreSeasonality(): Promise<{ genre: string; peakMonth: number; monthName: string }[]> {
  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const results = await db
    .select({
      month: sql<number>`CAST(strftime('%m', ${schema.downloadEvents.timestamp}) AS INTEGER)`.as('month'),
      genres: schema.mediaItems.genres,
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(eq(schema.downloadEvents.eventType, 'downloaded'));

  // Build genre -> month -> count
  const genreMonthCounts: Record<string, Record<number, number>> = {};

  for (const row of results) {
    if (row.genres && row.month) {
      try {
        const genres = JSON.parse(row.genres) as string[];
        for (const genre of genres) {
          if (!genreMonthCounts[genre]) {
            genreMonthCounts[genre] = {};
          }
          genreMonthCounts[genre][row.month] = (genreMonthCounts[genre][row.month] ?? 0) + 1;
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Get top genres and find their peak month
  const genreTotals = Object.entries(genreMonthCounts)
    .map(([genre, months]) => ({
      genre,
      total: Object.values(months).reduce((a, b) => a + b, 0),
      months,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  return genreTotals.map(({ genre, months }) => {
    // Find the month with the highest count
    let peakMonth = 1;
    let maxCount = 0;
    for (let m = 1; m <= 12; m++) {
      const count = months[m] ?? 0;
      if (count > maxCount) {
        maxCount = count;
        peakMonth = m;
      }
    }
    
    return {
      genre,
      peakMonth,
      monthName: monthNames[peakMonth],
    };
  });
}

// Get genre diversity score
export async function getGenreDiversity(): Promise<GenreDiversity> {
  const results = await db
    .select({
      genres: schema.mediaItems.genres,
    })
    .from(schema.mediaItems);

  const genreCounts: Record<string, number> = {};
  let totalItems = 0;

  for (const row of results) {
    if (row.genres) {
      totalItems++;
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

  const totalGenres = Object.keys(genreCounts).length;
  const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
  const topGenre = sortedGenres[0]?.[0] ?? null;
  const topGenreCount = sortedGenres[0]?.[1] ?? 0;
  const topGenrePercentage = totalItems > 0 ? Math.round((topGenreCount / totalItems) * 100) : 0;

  // Calculate diversity score (Shannon entropy normalized to 0-10)
  // Higher is more diverse
  let entropy = 0;
  for (const count of Object.values(genreCounts)) {
    const p = count / totalItems;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  
  // Normalize: max entropy is log2(totalGenres)
  const maxEntropy = totalGenres > 0 ? Math.log2(totalGenres) : 1;
  const score = maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 10 * 10) / 10 : 0;

  return {
    score,
    totalGenres,
    topGenre,
    topGenrePercentage,
  };
}

// Get details for a single genre
export async function getGenreDetails(
  genre: string, 
  type: 'movie' | 'series' | 'all' = 'all',
  params: GenreStatsParams
): Promise<GenreDetail> {
  const { startDate, endDate } = params;

  // Get all items with this genre
  const sourceConditions = [];
  if (type === 'movie') {
    sourceConditions.push(eq(schema.mediaItems.source, 'radarr'));
  } else if (type === 'series') {
    sourceConditions.push(eq(schema.mediaItems.source, 'sonarr'));
  }

  const items = await db
    .select({
      id: schema.mediaItems.id,
      source: schema.mediaItems.source,
      title: schema.mediaItems.title,
      genres: schema.mediaItems.genres,
      sizeBytes: schema.mediaItems.sizeBytes,
    })
    .from(schema.mediaItems)
    .where(and(...sourceConditions));

  // Filter items that have this genre
  const matchingItems = items.filter(item => {
    if (!item.genres) return false;
    try {
      const genres = JSON.parse(item.genres) as string[];
      return genres.includes(genre);
    } catch {
      return false;
    }
  });

  const movieCount = matchingItems.filter(i => i.source === 'radarr').length;
  const tvCount = matchingItems.filter(i => i.source === 'sonarr').length;
  const totalSizeBytes = matchingItems.reduce((sum, i) => sum + i.sizeBytes, 0);

  // Get release groups for this genre's downloads
  const releaseGroupResults = await db
    .select({
      releaseGroup: schema.downloadEvents.releaseGroup,
      count: count(),
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        sql`${schema.downloadEvents.releaseGroup} IS NOT NULL`,
        sql`${schema.mediaItems.genres} LIKE ${'%' + genre + '%'}`
      )
    )
    .groupBy(schema.downloadEvents.releaseGroup)
    .orderBy(sql`count(*) DESC`)
    .limit(5);

  const topReleaseGroups = releaseGroupResults.map(r => ({
    name: r.releaseGroup ?? 'Unknown',
    count: Number(r.count),
  }));

  // Get recent downloads for this genre
  const recentResults = await db
    .select({
      title: schema.mediaItems.title,
      type: schema.mediaItems.type,
      timestamp: schema.downloadEvents.timestamp,
    })
    .from(schema.downloadEvents)
    .innerJoin(schema.mediaItems, eq(schema.downloadEvents.mediaItemId, schema.mediaItems.id))
    .where(
      and(
        eq(schema.downloadEvents.eventType, 'downloaded'),
        gte(schema.downloadEvents.timestamp, startDate),
        lte(schema.downloadEvents.timestamp, endDate),
        sql`${schema.mediaItems.genres} LIKE ${'%' + genre + '%'}`
      )
    )
    .orderBy(sql`${schema.downloadEvents.timestamp} DESC`)
    .limit(10);

  const recentDownloads = recentResults.map(r => ({
    title: r.title,
    timestamp: r.timestamp,
    type: r.type,
  }));

  return {
    genre,
    movieCount,
    tvCount,
    totalCount: movieCount + tvCount,
    totalSizeBytes,
    topReleaseGroups,
    recentDownloads,
  };
}

// Get list of popular genres not in library
export async function getMissingPopularGenres(): Promise<string[]> {
  const popularGenres = [
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
    'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery',
    'Romance', 'Science Fiction', 'Thriller', 'War', 'Western'
  ];

  const results = await db
    .select({
      genres: schema.mediaItems.genres,
    })
    .from(schema.mediaItems);

  const existingGenres = new Set<string>();
  for (const row of results) {
    if (row.genres) {
      try {
        const genres = JSON.parse(row.genres) as string[];
        for (const genre of genres) {
          existingGenres.add(genre);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  return popularGenres.filter(g => !existingGenres.has(g));
}

// Get all unique genres in library
export async function getAllGenres(): Promise<string[]> {
  const results = await db
    .select({
      genres: schema.mediaItems.genres,
    })
    .from(schema.mediaItems);

  const genreSet = new Set<string>();
  for (const row of results) {
    if (row.genres) {
      try {
        const genres = JSON.parse(row.genres) as string[];
        for (const genre of genres) {
          genreSet.add(genre);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  return Array.from(genreSet).sort();
}
