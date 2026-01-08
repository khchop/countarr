import type {
  // Core types
  TimeRange,
  TimeSeriesData,
  MediaItem,
  Episode,
  // Response types
  HealthResponse,
  OverviewResponse,
  DownloadsResponse,
  QualityResponse,
  ReleaseGroupsListResponse,
  ReleaseGroupDetailsResponse,
  ReleaseGroupPulseItem,
  ReleaseGroupRankingItem,
  ReleaseGroupContentResponse,
  UpgradesResponse,
  PlaybackResponse,
  IndexersResponse,
  MoviesResponse,
  RuntimeStats,
  TVRuntimeStats,
  DecadeCount,
  YearCount,
  StudioRow,
  TVResponse,
  NetworkRow,
  MostActiveSeriesRow,
  MostEpisodesRow,
  GenresResponse,
  GenreDecade,
  GenreDetailsResponse,
  GrowthResponse,
  SubtitlesResponse,
  ProviderPerformanceRow,
  RecentSubtitleRow,
  AllTimeRecordsResponse,
  MilestoneItem,
  GoldenHourResponse,
  PatternsResponse,
  CalendarDay,
  QualityJourneyItem,
  DecadesRecord,
  StreaksResponse,
  QuirkyStatsResponse,
  LibraryInsightsResponse,
  DiscordWebhook,
  DiscordSchedule,
  MediaListResponse,
  MediaHistoryItem,
  MediaPlaybackItem,
  Connection,
  ConnectionStatus,
  ConnectionTestResult,
  SettingsResponse,
  SyncStatusResponse,
  SchedulerStatusResponse,
  UpgradeStep,
} from '@countarr/shared';

// Re-export TimeRange for convenience
export type { TimeRange };

const API_BASE = '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Time range helpers
export function getTimeRangeParams(range: TimeRange): { start: string; end: string } {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case '24h':
      start.setDate(start.getDate() - 1);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'all':
      start.setFullYear(2000);
      break;
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

// API endpoints
export const api = {
  // Health
  health: () => fetchApi<HealthResponse>('/health'),

  // Stats
  stats: {
    overview: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<OverviewResponse>(`/stats/overview?start=${params.start}&end=${params.end}`);
    },

    downloads: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<DownloadsResponse>(`/stats/downloads?start=${params.start}&end=${params.end}`);
    },

    quality: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<QualityResponse>(`/stats/quality?start=${params.start}&end=${params.end}`);
    },

    releaseGroups: (range: TimeRange, favorites?: string[]) => {
      const params = getTimeRangeParams(range);
      const favParam = favorites?.length ? `&favorites=${favorites.join(',')}` : '';
      return fetchApi<ReleaseGroupsListResponse>(`/stats/release-groups?start=${params.start}&end=${params.end}${favParam}`);
    },

    upgrades: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<UpgradesResponse>(`/stats/upgrades?start=${params.start}&end=${params.end}`);
    },

    playback: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<PlaybackResponse>(`/stats/playback?start=${params.start}&end=${params.end}`);
    },

    indexers: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<IndexersResponse>(`/stats/indexers?start=${params.start}&end=${params.end}`);
    },

    records: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<{
        biggestFile: { title: string; sizeBytes: number; date: string };
        smallestFile: { title: string; sizeBytes: number; date: string };
        mostUpgradedItem: { title: string; upgradeCount: number };
        busiestDay: { date: string; downloads: number; sizeBytes: number };
        longestUpgradeWait: { title: string; days: number };
        fastestGrab: { title: string; seconds: number };
      }>(`/stats/records?start=${params.start}&end=${params.end}`);
    },

    // Movies (Radarr)
    movies: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<MoviesResponse>(`/stats/movies?start=${params.start}&end=${params.end}`);
    },

    moviesDecades: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<DecadeCount[]>(`/stats/movies/decades?start=${params.start}&end=${params.end}`);
    },

    moviesYears: () => fetchApi<YearCount[]>('/stats/movies/years'),

    moviesRuntime: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<RuntimeStats>(`/stats/movies/runtime?start=${params.start}&end=${params.end}`);
    },

    moviesStudios: (range: TimeRange, limit = 20) => {
      const params = getTimeRangeParams(range);
      return fetchApi<StudioRow[]>(`/stats/movies/studios?start=${params.start}&end=${params.end}&limit=${limit}`);
    },

    // TV Shows (Sonarr)
    tv: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<TVResponse>(`/stats/tv?start=${params.start}&end=${params.end}`);
    },

    tvNetworks: (range: TimeRange, limit = 20) => {
      const params = getTimeRangeParams(range);
      return fetchApi<NetworkRow[]>(`/stats/tv/networks?start=${params.start}&end=${params.end}&limit=${limit}`);
    },

    tvMostActive: (range: TimeRange, limit = 20) => {
      const params = getTimeRangeParams(range);
      return fetchApi<MostActiveSeriesRow[]>(`/stats/tv/most-active?start=${params.start}&end=${params.end}&limit=${limit}`);
    },

    tvMostEpisodes: (range: TimeRange, limit = 20) => {
      const params = getTimeRangeParams(range);
      return fetchApi<MostEpisodesRow[]>(`/stats/tv/most-episodes?start=${params.start}&end=${params.end}&limit=${limit}`);
    },

    tvDecades: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<DecadeCount[]>(`/stats/tv/decades?start=${params.start}&end=${params.end}`);
    },

    tvRuntime: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<TVRuntimeStats>(`/stats/tv/runtime?start=${params.start}&end=${params.end}`);
    },

    // Genres
    genres: (range: TimeRange, type?: 'movie' | 'series' | 'all') => {
      const params = getTimeRangeParams(range);
      const typeParam = type ? `&type=${type}` : '';
      return fetchApi<GenresResponse>(`/stats/genres?start=${params.start}&end=${params.end}${typeParam}`);
    },

    genresDecades: () => fetchApi<GenreDecade[]>('/stats/genres/decades'),
    genresAll: () => fetchApi<string[]>('/stats/genres/all'),

    genreDetails: (genre: string, range: TimeRange, type?: 'movie' | 'series' | 'all') => {
      const params = getTimeRangeParams(range);
      const typeParam = type ? `&type=${type}` : '';
      return fetchApi<GenreDetailsResponse>(`/stats/genres/${encodeURIComponent(genre)}?start=${params.start}&end=${params.end}${typeParam}`);
    },

    // Growth
    growth: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<GrowthResponse>(`/stats/growth?start=${params.start}&end=${params.end}`);
    },

    growthLibrarySize: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<TimeSeriesData[]>(`/stats/growth/library-size?start=${params.start}&end=${params.end}`);
    },

    // Release Groups (enhanced)
    releaseGroupsList: (range: TimeRange, limit = 50, offset = 0, sort?: 'downloads' | 'size' | 'quality' | 'recent') => {
      const params = getTimeRangeParams(range);
      const sortParam = sort ? `&sort=${sort}` : '';
      return fetchApi<ReleaseGroupsListResponse>(`/stats/release-groups?start=${params.start}&end=${params.end}&limit=${limit}&offset=${offset}${sortParam}`);
    },

    releaseGroupsAll: () => fetchApi<string[]>('/stats/release-groups/all'),

    releaseGroupsSearch: (query: string, range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<Array<{ releaseGroup: string; downloads: number }>>(`/stats/release-groups/search?q=${encodeURIComponent(query)}&start=${params.start}&end=${params.end}`);
    },

    releaseGroupDetails: (group: string, range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<ReleaseGroupDetailsResponse>(`/stats/release-groups/${encodeURIComponent(group)}?start=${params.start}&end=${params.end}`);
    },

    releaseGroupPulse: (group: string, range: TimeRange, granularity: 'day' | 'week' | 'month' | 'year' = 'month') => {
      const params = getTimeRangeParams(range);
      return fetchApi<ReleaseGroupPulseItem[]>(`/stats/release-groups/${encodeURIComponent(group)}/pulse?start=${params.start}&end=${params.end}&granularity=${granularity}`);
    },

    releaseGroupRanking: (group: string, range: TimeRange, granularity: 'week' | 'month' | 'year' = 'month') => {
      const params = getTimeRangeParams(range);
      return fetchApi<ReleaseGroupRankingItem[]>(`/stats/release-groups/${encodeURIComponent(group)}/ranking?start=${params.start}&end=${params.end}&granularity=${granularity}`);
    },

    releaseGroupContent: (group: string, range: TimeRange, limit = 50, offset = 0, mediaType?: 'movie' | 'tv') => {
      const params = getTimeRangeParams(range);
      const typeParam = mediaType ? `&mediaType=${mediaType}` : '';
      return fetchApi<ReleaseGroupContentResponse>(`/stats/release-groups/${encodeURIComponent(group)}/content?start=${params.start}&end=${params.end}&limit=${limit}&offset=${offset}${typeParam}`);
    },

    // Subtitles (Bazarr)
    subtitles: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<SubtitlesResponse>(`/stats/subtitles?start=${params.start}&end=${params.end}`);
    },

    subtitlesLanguages: () => fetchApi<string[]>('/stats/subtitles/languages'),
    subtitlesProviders: () => fetchApi<string[]>('/stats/subtitles/providers'),

    subtitlesProviderPerformance: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return fetchApi<ProviderPerformanceRow[]>(`/stats/subtitles/provider-performance?start=${params.start}&end=${params.end}`);
    },

    subtitlesRecent: (range: TimeRange, limit = 20) => {
      const params = getTimeRangeParams(range);
      return fetchApi<RecentSubtitleRow[]>(`/stats/subtitles/recent?start=${params.start}&end=${params.end}&limit=${limit}`);
    },

    // Records (enhanced with fun stats)
    recordsAllTime: () => fetchApi<AllTimeRecordsResponse>('/stats/records/all-time'),
    recordsMilestones: () => fetchApi<MilestoneItem[]>('/stats/records/milestones'),
    recordsGoldenHour: () => fetchApi<GoldenHourResponse>('/stats/records/golden-hour'),
    recordsPatterns: () => fetchApi<PatternsResponse>('/stats/records/patterns'),

    recordsCalendar: (year?: number) => {
      const param = year ? `?year=${year}` : '';
      return fetchApi<CalendarDay[]>(`/stats/records/calendar${param}`);
    },

    recordsQualityJourney: () => fetchApi<QualityJourneyItem[]>('/stats/records/quality-journey'),
    recordsDecades: () => fetchApi<DecadesRecord[]>('/stats/records/decades'),
    recordsStreaks: () => fetchApi<StreaksResponse>('/stats/records/streaks'),
    recordsQuirky: () => fetchApi<QuirkyStatsResponse>('/stats/records/quirky'),
    recordsLibraryInsights: () => fetchApi<LibraryInsightsResponse>('/stats/records/library-insights'),
  },

  // Export
  export: {
    releaseGroups: (range: TimeRange, format: 'csv' | 'json' = 'json') => {
      const params = getTimeRangeParams(range);
      return `/api/export/release-groups?start=${params.start}&end=${params.end}&format=${format}`;
    },
    genres: (range: TimeRange, format: 'csv' | 'json' = 'json', type?: 'movie' | 'series' | 'all') => {
      const params = getTimeRangeParams(range);
      const typeParam = type ? `&type=${type}` : '';
      return `/api/export/genres?start=${params.start}&end=${params.end}&format=${format}${typeParam}`;
    },
    fullReport: (range: TimeRange) => {
      const params = getTimeRangeParams(range);
      return `/api/export/full-report?start=${params.start}&end=${params.end}`;
    },
  },

  // Discord
  discord: {
    webhooks: () => fetchApi<DiscordWebhook[]>('/discord/webhooks'),
    webhook: (id: number) => fetchApi<DiscordWebhook>(`/discord/webhooks/${id}`),

    createWebhook: (data: {
      name: string;
      webhookUrl: string;
      enabled?: boolean;
      sendDaily?: boolean;
      sendWeekly?: boolean;
      sendMonthly?: boolean;
      sendYearly?: boolean;
    }) => fetchApi<{ id: number }>('/discord/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    updateWebhook: (id: number, data: Partial<Omit<DiscordWebhook, 'id'>>) => fetchApi<void>(`/discord/webhooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

    deleteWebhook: (id: number) => fetchApi<void>(`/discord/webhooks/${id}`, { method: 'DELETE' }),

    testWebhook: (id: number) => fetchApi<{ success: boolean; message?: string; error?: string }>(`/discord/webhooks/${id}/test`, {
      method: 'POST',
    }),

    schedule: () => fetchApi<DiscordSchedule[]>('/discord/schedule'),

    updateSchedule: (id: string, data: Partial<Omit<DiscordSchedule, 'id'>>) => fetchApi<void>(`/discord/schedule/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

    triggerSummary: (type: 'daily' | 'weekly' | 'monthly' | 'yearly') => fetchApi<void>(`/discord/trigger/${type}`, {
      method: 'POST',
    }),
  },

  // Media
  media: {
    list: (page = 1, pageSize = 50, type?: 'movie' | 'series', search?: string) => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (type) params.set('type', type);
      if (search) params.set('search', search);
      return fetchApi<MediaListResponse>(`/media?${params}`);
    },

    get: (id: number) => fetchApi<MediaItem & { episodes?: Episode[] }>(`/media/${id}`),
    history: (id: number) => fetchApi<MediaHistoryItem[]>(`/media/${id}/history`),
    playback: (id: number) => fetchApi<MediaPlaybackItem[]>(`/media/${id}/playback`),
    upgradePath: (id: number) => fetchApi<{ mediaItem: MediaItem; upgrades: UpgradeStep[] }>(`/media/${id}/upgrade-path`),
  },

  // Settings
  settings: {
    get: () => fetchApi<SettingsResponse>('/settings'),

    update: (data: Partial<{
      pollIntervals: { history?: number; metadata?: number; playback?: number };
      historyImportMonths: number;
      favoriteReleaseGroups: string[];
      defaultTimeRange: TimeRange;
    }>) => fetchApi<void>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

    sync: (type?: 'full' | 'history' | 'metadata' | 'playback') => fetchApi<{ success: boolean; message: string }>('/settings/sync', {
      method: 'POST',
      body: JSON.stringify({ type: type ?? 'full' }),
    }),

    syncStatus: () => fetchApi<SyncStatusResponse>('/settings/sync-status'),
    scheduler: () => fetchApi<SchedulerStatusResponse>('/settings/scheduler'),
  },

  // Connections
  connections: {
    list: () => fetchApi<Connection[]>('/connections'),
    status: () => fetchApi<ConnectionStatus>('/connections/status'),
    get: (id: number) => fetchApi<Connection>(`/connections/${id}`),

    create: (data: { name: string; type: string; url: string; apiKey: string; enabled?: boolean }) =>
      fetchApi<{ id: number; name: string; type: string; lastTestSuccess: boolean; lastTestError?: string }>('/connections', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: number, data: { name?: string; url?: string; apiKey?: string; enabled?: boolean }) =>
      fetchApi<void>(`/connections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: number) => fetchApi<void>(`/connections/${id}`, { method: 'DELETE' }),

    test: (id: number) => fetchApi<ConnectionTestResult>(`/connections/${id}/test`, {
      method: 'POST',
    }),

    testNew: (data: { type: string; url: string; apiKey: string }) =>
      fetchApi<ConnectionTestResult>('/connections/test', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    testAll: () => fetchApi<{ results: Record<number, ConnectionTestResult> }>('/connections/test-all', {
      method: 'POST',
    }),
  },
};
