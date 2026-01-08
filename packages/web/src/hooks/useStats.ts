import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useTimeRange } from '@/components/layout/TimeRangeSelector';

/**
 * Default options for time-range dependent queries.
 * Uses keepPreviousData to ensure smooth transitions when switching time ranges.
 */
const timeRangeQueryOptions = {
  placeholderData: keepPreviousData,
};

/**
 * Default options for static queries (not time-range dependent).
 */
const staticQueryOptions = {
  staleTime: 5 * 60 * 1000, // 5 minutes for static data
};

// ============================================
// Overview & Downloads
// ============================================
export function useOverviewStats() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'overview', range],
    queryFn: () => api.stats.overview(range),
    ...timeRangeQueryOptions,
  });
}

export function useDownloadStats() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'downloads', range],
    queryFn: () => api.stats.downloads(range),
    ...timeRangeQueryOptions,
  });
}

export function useQualityStats() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'quality', range],
    queryFn: () => api.stats.quality(range),
    ...timeRangeQueryOptions,
  });
}

export function useUpgradeStats() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'upgrades', range],
    queryFn: () => api.stats.upgrades(range),
    ...timeRangeQueryOptions,
  });
}

// ============================================
// Movies (Radarr)
// ============================================
export function useMovieStats() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'movies', range],
    queryFn: () => api.stats.movies(range),
    ...timeRangeQueryOptions,
  });
}

export function useMovieDecades() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'movies', 'decades', range],
    queryFn: () => api.stats.moviesDecades(range),
    ...timeRangeQueryOptions,
  });
}

export function useMovieYears() {
  return useQuery({
    queryKey: ['stats', 'movies', 'years'],
    queryFn: () => api.stats.moviesYears(),
    ...staticQueryOptions,
  });
}

export function useMovieRuntime() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'movies', 'runtime', range],
    queryFn: () => api.stats.moviesRuntime(range),
    ...timeRangeQueryOptions,
  });
}

export function useMovieStudios(limit = 20) {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'movies', 'studios', range, limit],
    queryFn: () => api.stats.moviesStudios(range, limit),
    ...timeRangeQueryOptions,
  });
}

// ============================================
// TV Shows (Sonarr)
// ============================================
export function useTVStats() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'tv', range],
    queryFn: () => api.stats.tv(range),
    ...timeRangeQueryOptions,
  });
}

export function useTVNetworks(limit = 20) {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'tv', 'networks', range, limit],
    queryFn: () => api.stats.tvNetworks(range, limit),
    ...timeRangeQueryOptions,
  });
}

export function useTVMostActive(limit = 20) {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'tv', 'most-active', range, limit],
    queryFn: () => api.stats.tvMostActive(range, limit),
    ...timeRangeQueryOptions,
  });
}

export function useTVMostEpisodes(limit = 20) {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'tv', 'most-episodes', range, limit],
    queryFn: () => api.stats.tvMostEpisodes(range, limit),
    ...timeRangeQueryOptions,
  });
}

export function useTVDecades() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'tv', 'decades', range],
    queryFn: () => api.stats.tvDecades(range),
    ...timeRangeQueryOptions,
  });
}

export function useTVRuntime() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'tv', 'runtime', range],
    queryFn: () => api.stats.tvRuntime(range),
    ...timeRangeQueryOptions,
  });
}

// ============================================
// Genres
// ============================================
export function useGenreStats(type?: 'movie' | 'series' | 'all') {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'genres', range, type],
    queryFn: () => api.stats.genres(range, type),
    ...timeRangeQueryOptions,
  });
}

export function useGenreDecades() {
  return useQuery({
    queryKey: ['stats', 'genres', 'decades'],
    queryFn: () => api.stats.genresDecades(),
    ...staticQueryOptions,
  });
}

export function useAllGenres() {
  return useQuery({
    queryKey: ['stats', 'genres', 'all'],
    queryFn: () => api.stats.genresAll(),
    ...staticQueryOptions,
  });
}

export function useGenreDetails(genre: string, type?: 'movie' | 'series' | 'all') {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'genres', genre, range, type],
    queryFn: () => api.stats.genreDetails(genre, range, type),
    ...timeRangeQueryOptions,
    enabled: !!genre,
  });
}

// ============================================
// Growth
// ============================================
export function useGrowthStats() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'growth', range],
    queryFn: () => api.stats.growth(range),
    ...timeRangeQueryOptions,
  });
}

export function useGrowthLibrarySize() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'growth', 'library-size', range],
    queryFn: () => api.stats.growthLibrarySize(range),
    ...timeRangeQueryOptions,
  });
}

// ============================================
// Release Groups (enhanced)
// ============================================
export function useReleaseGroupStats(favorites?: string[]) {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'release-groups', range, favorites],
    queryFn: () => api.stats.releaseGroups(range, favorites),
    ...timeRangeQueryOptions,
  });
}

export function useReleaseGroupsList(limit = 50, offset = 0, sort?: 'downloads' | 'size' | 'quality' | 'recent') {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'release-groups', 'list', range, limit, offset, sort],
    queryFn: () => api.stats.releaseGroupsList(range, limit, offset, sort),
    ...timeRangeQueryOptions,
  });
}

export function useAllReleaseGroups() {
  return useQuery({
    queryKey: ['stats', 'release-groups', 'all'],
    queryFn: () => api.stats.releaseGroupsAll(),
    ...staticQueryOptions,
  });
}

export function useReleaseGroupSearch(query: string) {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'release-groups', 'search', query, range],
    queryFn: () => api.stats.releaseGroupsSearch(query, range),
    ...timeRangeQueryOptions,
    enabled: query.length >= 2,
  });
}

export function useReleaseGroupDetails(group: string) {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'release-groups', group, range],
    queryFn: () => api.stats.releaseGroupDetails(group, range),
    ...timeRangeQueryOptions,
    enabled: !!group,
  });
}

export function useReleaseGroupPulse(group: string, granularity: 'day' | 'week' | 'month' | 'year' = 'month') {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'release-groups', group, 'pulse', range, granularity],
    queryFn: () => api.stats.releaseGroupPulse(group, range, granularity),
    ...timeRangeQueryOptions,
    enabled: !!group,
  });
}

export function useReleaseGroupRanking(group: string, granularity: 'week' | 'month' | 'year' = 'month') {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'release-groups', group, 'ranking', range, granularity],
    queryFn: () => api.stats.releaseGroupRanking(group, range, granularity),
    ...timeRangeQueryOptions,
    enabled: !!group,
  });
}

export function useReleaseGroupContent(group: string, limit = 50, offset = 0, mediaType?: 'movie' | 'tv') {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'release-groups', group, 'content', range, limit, offset, mediaType],
    queryFn: () => api.stats.releaseGroupContent(group, range, limit, offset, mediaType),
    ...timeRangeQueryOptions,
    enabled: !!group,
  });
}

// ============================================
// Subtitles (Bazarr)
// ============================================
export function useSubtitleStats() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'subtitles', range],
    queryFn: () => api.stats.subtitles(range),
    ...timeRangeQueryOptions,
  });
}

export function useSubtitleLanguages() {
  return useQuery({
    queryKey: ['stats', 'subtitles', 'languages'],
    queryFn: () => api.stats.subtitlesLanguages(),
    ...staticQueryOptions,
  });
}

export function useSubtitleProviders() {
  return useQuery({
    queryKey: ['stats', 'subtitles', 'providers'],
    queryFn: () => api.stats.subtitlesProviders(),
    ...staticQueryOptions,
  });
}

export function useSubtitleProviderPerformance() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'subtitles', 'provider-performance', range],
    queryFn: () => api.stats.subtitlesProviderPerformance(range),
    ...timeRangeQueryOptions,
  });
}

export function useSubtitleRecent(limit = 20) {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'subtitles', 'recent', range, limit],
    queryFn: () => api.stats.subtitlesRecent(range, limit),
    ...timeRangeQueryOptions,
  });
}

// ============================================
// Playback
// ============================================
export function usePlaybackStats() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'playback', range],
    queryFn: () => api.stats.playback(range),
    ...timeRangeQueryOptions,
  });
}

// ============================================
// Indexers
// ============================================
export function useIndexerStats() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'indexers', range],
    queryFn: () => api.stats.indexers(range),
    ...timeRangeQueryOptions,
  });
}

// ============================================
// Records (enhanced with fun stats)
// ============================================
export function useRecordStats() {
  const { range } = useTimeRange();
  return useQuery({
    queryKey: ['stats', 'records', range],
    queryFn: () => api.stats.records(range),
    ...timeRangeQueryOptions,
  });
}

export function useAllTimeRecords() {
  return useQuery({
    queryKey: ['stats', 'records', 'all-time'],
    queryFn: () => api.stats.recordsAllTime(),
    staleTime: 60000,
  });
}

export function useDownloadMilestones() {
  return useQuery({
    queryKey: ['stats', 'records', 'milestones'],
    queryFn: () => api.stats.recordsMilestones(),
    staleTime: 60000,
  });
}

export function useGoldenHour() {
  return useQuery({
    queryKey: ['stats', 'records', 'golden-hour'],
    queryFn: () => api.stats.recordsGoldenHour(),
    staleTime: 60000,
  });
}

export function useDownloadPatterns() {
  return useQuery({
    queryKey: ['stats', 'records', 'patterns'],
    queryFn: () => api.stats.recordsPatterns(),
    staleTime: 60000,
  });
}

export function useCalendarHeatmap(year?: number) {
  return useQuery({
    queryKey: ['stats', 'records', 'calendar', year],
    queryFn: () => api.stats.recordsCalendar(year),
    staleTime: 60000,
  });
}

export function useQualityJourney() {
  return useQuery({
    queryKey: ['stats', 'records', 'quality-journey'],
    queryFn: () => api.stats.recordsQualityJourney(),
    staleTime: 60000,
  });
}

export function useDecadeDistribution() {
  return useQuery({
    queryKey: ['stats', 'records', 'decades'],
    queryFn: () => api.stats.recordsDecades(),
    staleTime: 60000,
  });
}

export function useDownloadStreaks() {
  return useQuery({
    queryKey: ['stats', 'records', 'streaks'],
    queryFn: () => api.stats.recordsStreaks(),
    staleTime: 60000,
  });
}

export function useQuirkyStats() {
  return useQuery({
    queryKey: ['stats', 'records', 'quirky'],
    queryFn: () => api.stats.recordsQuirky(),
    staleTime: 60000,
  });
}

export function useLibraryInsights() {
  return useQuery({
    queryKey: ['stats', 'records', 'library-insights'],
    queryFn: () => api.stats.recordsLibraryInsights(),
    staleTime: 60000,
  });
}

// ============================================
// Discord
// ============================================
export function useDiscordWebhooks() {
  return useQuery({
    queryKey: ['discord', 'webhooks'],
    queryFn: () => api.discord.webhooks(),
  });
}

export function useDiscordSchedule() {
  return useQuery({
    queryKey: ['discord', 'schedule'],
    queryFn: () => api.discord.schedule(),
  });
}

// ============================================
// Settings & Connections
// ============================================
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.settings.get(),
    staleTime: 60000,
  });
}

export function useConnections() {
  return useQuery({
    queryKey: ['connections'],
    queryFn: () => api.connections.list(),
  });
}

export function useConnectionStatus() {
  return useQuery({
    queryKey: ['connections', 'status'],
    queryFn: () => api.connections.status(),
  });
}
