import { db, rawDb, schema } from '../db/index.js';
import { sql, eq, and, gte, lte, count, sum, avg, desc } from 'drizzle-orm';
import type { TimeSeriesData, PieChartData, TableRow } from '@countarr/shared';

export interface SubtitleStatsParams {
  startDate: string;
  endDate: string;
}

export interface SubtitleOverviewStats {
  totalDownloads: number;
  uniqueLanguages: number;
  uniqueProviders: number;
  avgScore: number | null;
  movieSubtitles: number;
  tvSubtitles: number;
}

export interface LanguageStats {
  language: string;
  count: number;
  percentage: number;
  avgScore: number | null;
}

export interface ProviderStats {
  provider: string;
  count: number;
  percentage: number;
  avgScore: number | null;
  successRate: number; // Percentage of high-score downloads (score > 80)
}

export interface SubtitleTrend {
  period: string;
  count: number;
  byLanguage: Record<string, number>;
}

// ============================================
// Overview stats for subtitles
// ============================================
export async function getSubtitleOverviewStats(params: SubtitleStatsParams): Promise<SubtitleOverviewStats> {
  const { startDate, endDate } = params;

  const stats = rawDb.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT language) as unique_languages,
      COUNT(DISTINCT provider) as unique_providers,
      AVG(score) as avg_score
    FROM subtitle_events
    WHERE timestamp >= ? AND timestamp <= ?
  `).get(startDate, endDate) as {
    total: number;
    unique_languages: number;
    unique_providers: number;
    avg_score: number | null;
  };

  // Movie vs TV breakdown
  const typeBreakdown = rawDb.prepare(`
    SELECT 
      m.type,
      COUNT(*) as count
    FROM subtitle_events s
    INNER JOIN media_items m ON s.media_item_id = m.id
    WHERE s.timestamp >= ? AND s.timestamp <= ?
    GROUP BY m.type
  `).all(startDate, endDate) as Array<{ type: string; count: number }>;

  const movieSubtitles = typeBreakdown.find(t => t.type === 'movie')?.count ?? 0;
  const tvSubtitles = typeBreakdown.find(t => t.type === 'series')?.count ?? 0;

  return {
    totalDownloads: stats.total,
    uniqueLanguages: stats.unique_languages,
    uniqueProviders: stats.unique_providers,
    avgScore: stats.avg_score ? Math.round(stats.avg_score) : null,
    movieSubtitles,
    tvSubtitles,
  };
}

// ============================================
// Subtitle downloads by day
// ============================================
export async function getSubtitleDownloadsByDay(params: SubtitleStatsParams): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  const results = rawDb.prepare(`
    SELECT 
      date(timestamp) as date,
      COUNT(*) as count
    FROM subtitle_events
    WHERE timestamp >= ? AND timestamp <= ?
    GROUP BY date(timestamp)
    ORDER BY date ASC
  `).all(startDate, endDate) as Array<{ date: string; count: number }>;

  return [{
    label: 'Subtitles',
    data: results.map(row => ({
      timestamp: row.date,
      value: row.count,
    })),
    color: '#9b59b6', // Purple for Bazarr
  }];
}

// ============================================
// Language distribution
// ============================================
export async function getSubtitleLanguageDistribution(params: SubtitleStatsParams): Promise<LanguageStats[]> {
  const { startDate, endDate } = params;

  const total = rawDb.prepare(`
    SELECT COUNT(*) as total FROM subtitle_events
    WHERE timestamp >= ? AND timestamp <= ?
  `).get(startDate, endDate) as { total: number };

  const results = rawDb.prepare(`
    SELECT 
      language,
      COUNT(*) as count,
      AVG(score) as avg_score
    FROM subtitle_events
    WHERE timestamp >= ? AND timestamp <= ?
    GROUP BY language
    ORDER BY count DESC
  `).all(startDate, endDate) as Array<{
    language: string;
    count: number;
    avg_score: number | null;
  }>;

  return results.map(r => ({
    language: r.language,
    count: r.count,
    percentage: total.total > 0 ? Math.round((r.count / total.total) * 1000) / 10 : 0,
    avgScore: r.avg_score ? Math.round(r.avg_score) : null,
  }));
}

// ============================================
// Language distribution as pie chart data
// ============================================
export async function getSubtitleLanguagePieChart(params: SubtitleStatsParams): Promise<PieChartData[]> {
  const { startDate, endDate } = params;

  const results = rawDb.prepare(`
    SELECT language, COUNT(*) as count
    FROM subtitle_events
    WHERE timestamp >= ? AND timestamp <= ?
    GROUP BY language
    ORDER BY count DESC
  `).all(startDate, endDate) as Array<{ language: string; count: number }>;

  return results.map(r => ({
    label: r.language,
    value: r.count,
  }));
}

// ============================================
// Provider distribution
// ============================================
export async function getSubtitleProviderDistribution(params: SubtitleStatsParams): Promise<ProviderStats[]> {
  const { startDate, endDate } = params;

  const total = rawDb.prepare(`
    SELECT COUNT(*) as total FROM subtitle_events
    WHERE timestamp >= ? AND timestamp <= ?
  `).get(startDate, endDate) as { total: number };

  const results = rawDb.prepare(`
    SELECT 
      provider,
      COUNT(*) as count,
      AVG(score) as avg_score,
      SUM(CASE WHEN score >= 80 THEN 1 ELSE 0 END) as high_score_count
    FROM subtitle_events
    WHERE timestamp >= ? AND timestamp <= ?
    GROUP BY provider
    ORDER BY count DESC
  `).all(startDate, endDate) as Array<{
    provider: string;
    count: number;
    avg_score: number | null;
    high_score_count: number;
  }>;

  return results.map(r => ({
    provider: r.provider,
    count: r.count,
    percentage: total.total > 0 ? Math.round((r.count / total.total) * 1000) / 10 : 0,
    avgScore: r.avg_score ? Math.round(r.avg_score) : null,
    successRate: r.count > 0 ? Math.round((r.high_score_count / r.count) * 1000) / 10 : 0,
  }));
}

// ============================================
// Provider distribution as pie chart data
// ============================================
export async function getSubtitleProviderPieChart(params: SubtitleStatsParams): Promise<PieChartData[]> {
  const { startDate, endDate } = params;

  const results = rawDb.prepare(`
    SELECT provider, COUNT(*) as count
    FROM subtitle_events
    WHERE timestamp >= ? AND timestamp <= ?
    GROUP BY provider
    ORDER BY count DESC
  `).all(startDate, endDate) as Array<{ provider: string; count: number }>;

  return results.map(r => ({
    label: r.provider,
    value: r.count,
  }));
}

// ============================================
// Provider performance comparison
// ============================================
export async function getSubtitleProviderPerformance(params: SubtitleStatsParams): Promise<TableRow[]> {
  const { startDate, endDate } = params;

  const results = rawDb.prepare(`
    SELECT 
      provider,
      COUNT(*) as total,
      AVG(score) as avg_score,
      MIN(score) as min_score,
      MAX(score) as max_score,
      SUM(CASE WHEN score >= 80 THEN 1 ELSE 0 END) as excellent,
      SUM(CASE WHEN score >= 60 AND score < 80 THEN 1 ELSE 0 END) as good,
      SUM(CASE WHEN score >= 40 AND score < 60 THEN 1 ELSE 0 END) as fair,
      SUM(CASE WHEN score < 40 THEN 1 ELSE 0 END) as poor
    FROM subtitle_events
    WHERE timestamp >= ? AND timestamp <= ?
    GROUP BY provider
    ORDER BY avg_score DESC
  `).all(startDate, endDate) as Array<{
    provider: string;
    total: number;
    avg_score: number | null;
    min_score: number | null;
    max_score: number | null;
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  }>;

  return results.map((r, index) => ({
    rank: index + 1,
    provider: r.provider,
    total: r.total,
    avgScore: r.avg_score ? Math.round(r.avg_score) : null,
    minScore: r.min_score,
    maxScore: r.max_score,
    excellent: r.excellent,
    good: r.good,
    fair: r.fair,
    poor: r.poor,
    excellentRate: r.total > 0 ? Math.round((r.excellent / r.total) * 1000) / 10 : 0,
  }));
}

// ============================================
// Subtitles by language over time
// ============================================
export async function getSubtitleLanguageTrend(
  params: SubtitleStatsParams,
  granularity: 'day' | 'week' | 'month' = 'month'
): Promise<TimeSeriesData[]> {
  const { startDate, endDate } = params;

  const dateFormat = {
    day: '%Y-%m-%d',
    week: '%Y-W%W',
    month: '%Y-%m',
  }[granularity];

  // Get top languages first
  const topLanguages = rawDb.prepare(`
    SELECT language, COUNT(*) as count
    FROM subtitle_events
    WHERE timestamp >= ? AND timestamp <= ?
    GROUP BY language
    ORDER BY count DESC
    LIMIT 5
  `).all(startDate, endDate) as Array<{ language: string; count: number }>;

  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6'];
  const series: TimeSeriesData[] = [];

  for (let i = 0; i < topLanguages.length; i++) {
    const lang = topLanguages[i].language;
    const results = rawDb.prepare(`
      SELECT 
        strftime('${dateFormat}', timestamp) as period,
        MIN(date(timestamp)) as period_date,
        COUNT(*) as count
      FROM subtitle_events
      WHERE timestamp >= ? AND timestamp <= ?
        AND language = ?
      GROUP BY strftime('${dateFormat}', timestamp)
      ORDER BY period ASC
    `).all(startDate, endDate, lang) as Array<{ period: string; period_date: string; count: number }>;

    series.push({
      label: lang,
      data: results.map(r => ({ timestamp: r.period_date, value: r.count })),
      color: colors[i],
    });
  }

  return series;
}

// ============================================
// Recent subtitle downloads
// ============================================
export async function getRecentSubtitles(params: SubtitleStatsParams, limit = 20): Promise<TableRow[]> {
  const { startDate, endDate } = params;

  const results = rawDb.prepare(`
    SELECT 
      s.id,
      m.title,
      m.type,
      e.season,
      e.episode,
      e.title as episode_title,
      s.language,
      s.provider,
      s.score,
      s.timestamp
    FROM subtitle_events s
    INNER JOIN media_items m ON s.media_item_id = m.id
    LEFT JOIN episodes e ON s.episode_id = e.id
    WHERE s.timestamp >= ? AND s.timestamp <= ?
    ORDER BY s.timestamp DESC
    LIMIT ?
  `).all(startDate, endDate, limit) as Array<{
    id: number;
    title: string;
    type: string;
    season: number | null;
    episode: number | null;
    episode_title: string | null;
    language: string;
    provider: string;
    score: number | null;
    timestamp: string;
  }>;

  return results.map(r => ({
    id: r.id,
    title: r.type === 'series' && r.season !== null
      ? `${r.title} S${r.season.toString().padStart(2, '0')}E${r.episode?.toString().padStart(2, '0')}`
      : r.title,
    type: r.type,
    language: r.language,
    provider: r.provider,
    score: r.score,
    timestamp: r.timestamp,
  }));
}

// ============================================
// Subtitle score distribution
// ============================================
export async function getSubtitleScoreDistribution(params: SubtitleStatsParams): Promise<PieChartData[]> {
  const { startDate, endDate } = params;

  const results = rawDb.prepare(`
    SELECT 
      CASE 
        WHEN score >= 90 THEN 'Excellent (90-100)'
        WHEN score >= 80 THEN 'Very Good (80-89)'
        WHEN score >= 70 THEN 'Good (70-79)'
        WHEN score >= 60 THEN 'Fair (60-69)'
        WHEN score >= 50 THEN 'Poor (50-59)'
        ELSE 'Very Poor (<50)'
      END as score_range,
      COUNT(*) as count
    FROM subtitle_events
    WHERE timestamp >= ? AND timestamp <= ?
      AND score IS NOT NULL
    GROUP BY score_range
    ORDER BY MIN(score) DESC
  `).all(startDate, endDate) as Array<{ score_range: string; count: number }>;

  const colors: Record<string, string> = {
    'Excellent (90-100)': '#27ae60',
    'Very Good (80-89)': '#2ecc71',
    'Good (70-79)': '#f1c40f',
    'Fair (60-69)': '#e67e22',
    'Poor (50-59)': '#e74c3c',
    'Very Poor (<50)': '#c0392b',
  };

  return results.map(r => ({
    label: r.score_range,
    value: r.count,
    color: colors[r.score_range],
  }));
}

// ============================================
// Media items needing subtitles (missing for a language)
// ============================================
export async function getMediaMissingSubtitles(
  language: string,
  mediaType?: 'movie' | 'series',
  limit = 50
): Promise<Array<{ id: number; title: string; type: string }>> {
  const typeFilter = mediaType ? `AND m.type = '${mediaType}'` : '';

  const results = rawDb.prepare(`
    SELECT m.id, m.title, m.type
    FROM media_items m
    WHERE m.id NOT IN (
      SELECT DISTINCT media_item_id 
      FROM subtitle_events 
      WHERE language = ?
    )
    ${typeFilter}
    ORDER BY m.title ASC
    LIMIT ?
  `).all(language, limit) as Array<{ id: number; title: string; type: string }>;

  return results;
}

// ============================================
// Subtitle download comparison between periods
// ============================================
export async function getSubtitlePeriodComparison(
  currentStart: string,
  currentEnd: string,
  previousStart: string,
  previousEnd: string
): Promise<{
  current: { count: number; avgScore: number | null };
  previous: { count: number; avgScore: number | null };
  changePercent: number;
  scoreChangePercent: number;
}> {
  const current = rawDb.prepare(`
    SELECT COUNT(*) as count, AVG(score) as avg_score
    FROM subtitle_events
    WHERE timestamp >= ? AND timestamp <= ?
  `).get(currentStart, currentEnd) as { count: number; avg_score: number | null };

  const previous = rawDb.prepare(`
    SELECT COUNT(*) as count, AVG(score) as avg_score
    FROM subtitle_events
    WHERE timestamp >= ? AND timestamp <= ?
  `).get(previousStart, previousEnd) as { count: number; avg_score: number | null };

  const changePercent = previous.count > 0
    ? Math.round(((current.count - previous.count) / previous.count) * 1000) / 10
    : 0;

  const scoreChangePercent = previous.avg_score && current.avg_score
    ? Math.round(((current.avg_score - previous.avg_score) / previous.avg_score) * 1000) / 10
    : 0;

  return {
    current: { count: current.count, avgScore: current.avg_score ? Math.round(current.avg_score) : null },
    previous: { count: previous.count, avgScore: previous.avg_score ? Math.round(previous.avg_score) : null },
    changePercent,
    scoreChangePercent,
  };
}

// ============================================
// Get all unique languages
// ============================================
export async function getAllSubtitleLanguages(): Promise<string[]> {
  const results = rawDb.prepare(`
    SELECT DISTINCT language
    FROM subtitle_events
    ORDER BY language ASC
  `).all() as Array<{ language: string }>;

  return results.map(r => r.language);
}

// ============================================
// Get all unique providers
// ============================================
export async function getAllSubtitleProviders(): Promise<string[]> {
  const results = rawDb.prepare(`
    SELECT DISTINCT provider
    FROM subtitle_events
    ORDER BY provider ASC
  `).all() as Array<{ provider: string }>;

  return results.map(r => r.provider);
}
