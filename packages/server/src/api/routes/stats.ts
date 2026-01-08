import { FastifyInstance } from 'fastify';
import * as stats from '../../stats/index.js';
import * as movies from '../../stats/movies.js';
import * as tvshows from '../../stats/tvshows.js';
import * as genres from '../../stats/genres.js';
import * as growth from '../../stats/growth.js';
import * as releaseGroups from '../../stats/release-groups.js';
import * as records from '../../stats/records.js';
import * as subtitles from '../../stats/subtitles.js';
import * as indexers from '../../stats/indexers.js';

interface TimeRangeQuery {
  start?: string;
  end?: string;
}

interface PaginationQuery {
  limit?: string;
  offset?: string;
}

function getDefaultTimeRange(): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // Default 30 days

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

function parseTimeRange(query: TimeRangeQuery): { startDate: string; endDate: string } {
  const defaults = getDefaultTimeRange();
  return {
    startDate: query.start ?? defaults.startDate,
    endDate: query.end ?? defaults.endDate,
  };
}

function parsePagination(query: PaginationQuery): { limit: number; offset: number } {
  return {
    limit: Math.min(parseInt(query.limit ?? '50', 10), 200),
    offset: parseInt(query.offset ?? '0', 10),
  };
}

export async function statsRoutes(fastify: FastifyInstance) {
  // ============================================
  // Overview stats
  // ============================================
  fastify.get('/overview', async (request) => {
    const { startDate, endDate } = parseTimeRange(request.query as TimeRangeQuery);
    const params = { startDate, endDate };

    const [downloads, contentCounts, storage, avgQuality, totalUpgrades, totalWatchTime] = await Promise.all([
      stats.getTotalDownloads(params),
      records.getContentCounts(),
      records.getStorageStats(),
      stats.getAverageQualityScore(params),
      stats.getTotalUpgrades(params),
      stats.getTotalWatchTime(params),
    ]);

    return {
      totalDownloads: { value: downloads.count, unit: 'downloads' },
      totalSizeBytes: { value: downloads.bytes, unit: 'bytes' },
      totalMediaItems: { value: contentCounts.totalItems, unit: 'items' },
      avgQualityScore: { value: Math.round(avgQuality), unit: 'score' },
      totalUpgrades: { value: totalUpgrades, unit: 'upgrades' },
      totalPlaytime: { value: totalWatchTime, unit: 'seconds' },
      movies: contentCounts.movies,
      series: contentCounts.series,
      episodes: contentCounts.episodes,
      storage,
    };
  });

  // ============================================
  // Download stats
  // ============================================
  fastify.get('/downloads', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);

    const [byDay, sizeByDay, byHour, byDayOfWeek, byApp] = await Promise.all([
      stats.getDownloadsByDay(params),
      stats.getDownloadSizeByDay(params),
      stats.getDownloadsByHour(params),
      stats.getDownloadsByDayOfWeek(params),
      stats.getDownloadsByApp(params),
    ]);

    return {
      byDay,
      sizeByDay,
      heatmap: byHour,
      byDayOfWeek,
      byApp,
    };
  });

  // ============================================
  // Quality stats
  // ============================================
  fastify.get('/quality', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);

    const [resolution, source, codec, trend, overTime] = await Promise.all([
      stats.getResolutionDistribution(params),
      stats.getSourceDistribution(params),
      stats.getCodecDistribution(params),
      stats.getQualityScoreTrend(params),
      stats.getQualityOverTime(params),
    ]);

    return {
      resolutionDistribution: resolution,
      sourceDistribution: source,
      codecDistribution: codec,
      qualityTrend: trend,
      qualityOverTime: overTime,
    };
  });

  // ============================================
  // Movie stats (Radarr)
  // ============================================
  fastify.get('/movies', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);

    const [overview, downloadsByDay, releaseGroupsData, quality, genreDistribution] = await Promise.all([
      movies.getMovieOverviewStats(params),
      movies.getMovieDownloadsByDay(params),
      movies.getMovieReleaseGroups(params),
      movies.getMovieQualityDistribution(params),
      movies.getMovieGenreDistribution(params),
    ]);

    return {
      overview,
      downloadsByDay,
      releaseGroups: releaseGroupsData,
      quality,
      genreDistribution,
    };
  });

  fastify.get('/movies/decades', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);
    return movies.getMovieDecadeDistribution(params);
  });

  fastify.get('/movies/years', async () => {
    return movies.getMovieYearDistribution();
  });

  fastify.get('/movies/runtime', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);
    return movies.getMovieRuntimeStats(params);
  });

  fastify.get('/movies/most-upgraded', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);
    const { limit } = parsePagination(request.query as PaginationQuery);
    return movies.getMostUpgradedMovies(params, limit);
  });

  fastify.get('/movies/oldest', async (request) => {
    const { limit } = parsePagination(request.query as PaginationQuery);
    return movies.getOldestMovies(limit);
  });

  fastify.get('/movies/newest', async (request) => {
    const { limit } = parsePagination(request.query as PaginationQuery);
    return movies.getNewestMovies(limit);
  });

  fastify.get('/movies/studios', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);
    const { limit } = parsePagination(request.query as PaginationQuery);
    return movies.getMovieStudios(params, limit);
  });

  // ============================================
  // TV Show stats (Sonarr)
  // ============================================
  fastify.get('/tv', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);

    const [overview, downloadsByDay, releaseGroupsData, quality, genreDistribution] = await Promise.all([
      tvshows.getTVOverviewStats(params),
      tvshows.getEpisodeDownloadsByDay(params),
      tvshows.getTVReleaseGroups(params),
      tvshows.getTVQualityDistribution(params),
      tvshows.getTVGenreDistribution(params),
    ]);

    return {
      overview,
      downloadsByDay,
      releaseGroups: releaseGroupsData,
      quality,
      genreDistribution,
    };
  });

  fastify.get('/tv/networks', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);
    const { limit } = parsePagination(request.query as PaginationQuery);
    return tvshows.getNetworkDistribution(params, limit);
  });

  fastify.get('/tv/most-active', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);
    const { limit } = parsePagination(request.query as PaginationQuery);
    return tvshows.getMostActiveSeries(params, limit);
  });

  fastify.get('/tv/most-episodes', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);
    const { limit } = parsePagination(request.query as PaginationQuery);
    return tvshows.getSeriesWithMostEpisodes(params, limit);
  });

  fastify.get('/tv/decades', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);
    return tvshows.getTVDecadeDistribution(params);
  });

  fastify.get('/tv/runtime', async () => {
    return tvshows.getEpisodeRuntimeStats();
  });

  // ============================================
  // Genre stats
  // ============================================
  fastify.get('/genres', async (request) => {
    const query = request.query as TimeRangeQuery & { type?: 'movie' | 'series' | 'all' };
    const params = parseTimeRange(query);

    const [distribution, overTime, topGenre, seasonality, diversity] = await Promise.all([
      genres.getGenreDistribution({ ...params, type: query.type }),
      genres.getGenreOverTime({ ...params, type: query.type }),
      genres.getTopGenreThisPeriod({ ...params, type: query.type }),
      genres.getGenreSeasonality(),
      genres.getGenreDiversity(),
    ]);

    return {
      distribution,
      overTime,
      topGenre,
      seasonality,
      diversity,
    };
  });

  fastify.get('/genres/decades', async () => {
    return genres.getGenreByDecade();
  });

  fastify.get('/genres/all', async () => {
    return genres.getAllGenres();
  });

  fastify.get('/genres/:genre', async (request) => {
    const { genre } = request.params as { genre: string };
    const query = request.query as TimeRangeQuery & { type?: 'movie' | 'series' | 'all' };
    const params = parseTimeRange(query);
    return genres.getGenreDetails(decodeURIComponent(genre), query.type ?? 'all', params);
  });

  // ============================================
  // Growth stats
  // ============================================
  fastify.get('/growth', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);

    const [growthStats, byApp, overTime, librarySize, breakdown] = await Promise.all([
      growth.getGrowthStats(params),
      growth.getGrowthByApp(params),
      growth.getGrowthOverTime(params),
      growth.getCurrentLibrarySize(),
      growth.getDownloadUpgradeBreakdown(params),
    ]);

    return {
      stats: growthStats,
      byApp,
      overTime,
      librarySize,
      breakdown,
    };
  });

  fastify.get('/growth/library-size', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);
    return growth.getLibrarySizeOverTime(params);
  });

  fastify.get('/growth/compare', async (request) => {
    const query = request.query as {
      currentStart: string;
      currentEnd: string;
      previousStart: string;
      previousEnd: string;
    };
    return growth.getGrowthComparison(
      { startDate: query.currentStart, endDate: query.currentEnd },
      { startDate: query.previousStart, endDate: query.previousEnd }
    );
  });

  // ============================================
  // Release group stats (enhanced)
  // ============================================
  fastify.get('/release-groups', async (request) => {
    const query = request.query as TimeRangeQuery & { 
      favorites?: string;
      sort?: 'downloads' | 'size' | 'quality' | 'recent';
    };
    const params = parseTimeRange(query);
    const { limit, offset } = parsePagination(request.query as PaginationQuery);
    const favoriteGroups = query.favorites?.split(',').filter(Boolean) ?? [];

    const [list, loyalty] = await Promise.all([
      releaseGroups.getReleaseGroupsList(params, limit, offset, query.sort),
      releaseGroups.getReleaseGroupLoyalty(params),
    ]);

    // If favorites provided, get their stats too
    let favoriteStats = null;
    if (favoriteGroups.length > 0) {
      favoriteStats = await releaseGroups.getFavoriteGroupsStats({ ...params, favoriteGroups });
    }

    return {
      ...list,
      loyalty,
      favoriteStats,
    };
  });

  fastify.get('/release-groups/all', async () => {
    return releaseGroups.getAllReleaseGroups();
  });

  fastify.get('/release-groups/search', async (request) => {
    const query = request.query as TimeRangeQuery & { q: string };
    const params = parseTimeRange(query);
    const { limit } = parsePagination(request.query as PaginationQuery);
    return releaseGroups.searchReleaseGroups(query.q ?? '', params, limit);
  });

  fastify.get('/release-groups/:group', async (request) => {
    const { group } = request.params as { group: string };
    const params = parseTimeRange(request.query as TimeRangeQuery);
    return releaseGroups.getReleaseGroupDetails(decodeURIComponent(group), params);
  });

  fastify.get('/release-groups/:group/pulse', async (request) => {
    const { group } = request.params as { group: string };
    const query = request.query as TimeRangeQuery & { granularity?: 'day' | 'week' | 'month' | 'year' };
    const params = parseTimeRange(query);
    return releaseGroups.getReleaseGroupPulse(decodeURIComponent(group), query.granularity ?? 'month', params);
  });

  fastify.get('/release-groups/:group/ranking', async (request) => {
    const { group } = request.params as { group: string };
    const query = request.query as TimeRangeQuery & { granularity?: 'week' | 'month' | 'year' };
    const params = parseTimeRange(query);
    return releaseGroups.getReleaseGroupRanking(decodeURIComponent(group), query.granularity ?? 'month', params);
  });

  fastify.get('/release-groups/:group/content', async (request) => {
    const { group } = request.params as { group: string };
    const query = request.query as TimeRangeQuery & { mediaType?: 'movie' | 'tv' };
    const params = parseTimeRange(query);
    const { limit, offset } = parsePagination(request.query as PaginationQuery);
    return releaseGroups.getReleaseGroupContent(decodeURIComponent(group), params, limit, offset, query.mediaType);
  });

  fastify.post('/release-groups/compare', async (request) => {
    const { groups } = request.body as { groups: string[] };
    const params = parseTimeRange(request.query as TimeRangeQuery);
    return releaseGroups.getReleaseGroupComparison(groups, params);
  });

  fastify.post('/release-groups/pulse', async (request) => {
    const { groups } = request.body as { groups: string[] };
    const query = request.query as TimeRangeQuery & { granularity?: 'day' | 'week' | 'month' | 'year' };
    const params = parseTimeRange(query);
    return releaseGroups.getMultiGroupPulse(groups, query.granularity ?? 'month', params);
  });

  // ============================================
  // Upgrade stats
  // ============================================
  fastify.get('/upgrades', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);

    const [perDay, mostUpgraded, flows, avgTime] = await Promise.all([
      stats.getUpgradesPerDay(params),
      stats.getMostUpgradedItems(params),
      stats.getUpgradeFlows(params),
      stats.getAvgTimeBetweenUpgrades(params),
    ]);

    return {
      upgradesPerDay: perDay,
      mostUpgraded,
      upgradeFlows: flows,
      avgTimeBetweenUpgrades: avgTime,
    };
  });

  // ============================================
  // Playback stats
  // ============================================
  fastify.get('/playback', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);

    const [watchTimeByUser, mostWatched, watchedVsUnwatched, neverWatched, userStats, recentPlayback] = await Promise.all([
      stats.getWatchTimeByUserOverTime(params),
      stats.getMostWatchedContent(params),
      stats.getWatchedVsUnwatched(),
      stats.getNeverWatchedContent(),
      stats.getPlaybackByUser(params),
      stats.getRecentPlayback(params, 20),
    ]);

    return {
      watchTimePerDay: watchTimeByUser,
      mostWatched,
      watchedVsUnwatched,
      neverWatched,
      userStats,
      recentPlayback,
    };
  });

  // ============================================
  // Indexer stats
  // ============================================
  fastify.get('/indexers', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);

    const [overview, grabsOverTime, grabsByIndexer, topIndexers] = await Promise.all([
      indexers.getIndexerOverview(params),
      indexers.getGrabsOverTime(params),
      indexers.getGrabsByIndexer(params),
      indexers.getTopIndexers(params, 15),
    ]);

    return {
      overview,
      grabsOverTime,
      grabsByIndexer,
      topIndexers,
    };
  });

  // ============================================
  // Subtitle stats (Bazarr)
  // ============================================
  fastify.get('/subtitles', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);

    const [overview, byDay, languages, providers, scoreDistribution] = await Promise.all([
      subtitles.getSubtitleOverviewStats(params),
      subtitles.getSubtitleDownloadsByDay(params),
      subtitles.getSubtitleLanguageDistribution(params),
      subtitles.getSubtitleProviderDistribution(params),
      subtitles.getSubtitleScoreDistribution(params),
    ]);

    return {
      overview,
      byDay,
      languages,
      providers,
      scoreDistribution,
    };
  });

  fastify.get('/subtitles/languages', async () => {
    return subtitles.getAllSubtitleLanguages();
  });

  fastify.get('/subtitles/providers', async () => {
    return subtitles.getAllSubtitleProviders();
  });

  fastify.get('/subtitles/provider-performance', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);
    return subtitles.getSubtitleProviderPerformance(params);
  });

  fastify.get('/subtitles/language-trend', async (request) => {
    const query = request.query as TimeRangeQuery & { granularity?: 'day' | 'week' | 'month' };
    const params = parseTimeRange(query);
    return subtitles.getSubtitleLanguageTrend(params, query.granularity ?? 'month');
  });

  fastify.get('/subtitles/recent', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);
    const { limit } = parsePagination(request.query as PaginationQuery);
    return subtitles.getRecentSubtitles(params, limit);
  });

  fastify.get('/subtitles/missing', async (request) => {
    const query = request.query as { language: string; mediaType?: 'movie' | 'series' };
    const { limit } = parsePagination(request.query as PaginationQuery);
    return subtitles.getMediaMissingSubtitles(query.language, query.mediaType, limit);
  });

  // ============================================
  // Record stats (fun/quirky)
  // ============================================
  fastify.get('/records', async (request) => {
    const params = parseTimeRange(request.query as TimeRangeQuery);
    return records.getRecordStats(params);
  });

  fastify.get('/records/all-time', async () => {
    return records.getAllTimeRecords();
  });

  fastify.get('/records/milestones', async () => {
    return records.getDownloadMilestones();
  });

  fastify.get('/records/golden-hour', async () => {
    return records.getGoldenHour();
  });

  fastify.get('/records/patterns', async () => {
    const [byHour, byDayOfWeek, weekendVsWeekday] = await Promise.all([
      records.getRecordDownloadsByHour(),
      records.getRecordDownloadsByDayOfWeek(),
      records.getWeekendVsWeekday(),
    ]);
    return { byHour, byDayOfWeek, weekendVsWeekday };
  });

  fastify.get('/records/calendar', async (request) => {
    const query = request.query as { year?: string };
    const year = query.year ? parseInt(query.year, 10) : undefined;
    return records.getCalendarHeatmap(year);
  });

  fastify.get('/records/quality-journey', async () => {
    return records.getQualityJourney();
  });

  fastify.get('/records/decades', async () => {
    return records.getDecadeDistribution();
  });

  fastify.get('/records/streaks', async () => {
    return records.getDownloadStreaks();
  });

  fastify.get('/records/quirky', async () => {
    return records.getQuirkyStats();
  });

  fastify.get('/records/library-insights', async () => {
    return records.getLibraryInsights();
  });

  fastify.get('/records/monthly/:year/:month', async (request) => {
    const { year, month } = request.params as { year: string; month: string };
    return records.getMonthlySummary(parseInt(year, 10), parseInt(month, 10));
  });
}
