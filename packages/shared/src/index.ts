// ============================================
// Countarr Shared Types
// ============================================

// --------------------------------------------
// Source Apps
// --------------------------------------------
export type SourceApp = 'radarr' | 'sonarr' | 'bazarr' | 'prowlarr' | 'jellyseerr' | 'emby' | 'jellyfin';
export type MediaType = 'movie' | 'series' | 'episode';
export type EventType = 'grabbed' | 'downloaded' | 'upgraded' | 'deleted' | 'imported' | 'renamed';
export type RequestStatus = 'pending' | 'approved' | 'available' | 'declined';

// --------------------------------------------
// Quality Types
// --------------------------------------------
export type Resolution = '480p' | '576p' | '720p' | '1080p' | '2160p' | 'unknown';
export type QualitySource = 'cam' | 'telesync' | 'telecine' | 'workprint' | 'dvd' | 'hdtv' | 'webdl' | 'webrip' | 'bluray' | 'remux' | 'unknown';
export type VideoCodec = 'x264' | 'x265' | 'h264' | 'h265' | 'hevc' | 'av1' | 'vp9' | 'xvid' | 'divx' | 'mpeg2' | 'unknown';
export type AudioCodec = 'aac' | 'ac3' | 'eac3' | 'dts' | 'dtshd' | 'truehd' | 'atmos' | 'flac' | 'mp3' | 'opus' | 'unknown';

export interface ParsedQuality {
  resolution: Resolution;
  source: QualitySource;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  is3d: boolean;
  isHdr: boolean;
  isDolbyVision: boolean;
  isAtmos: boolean;
  qualityScore: number; // 0-100 weighted score
}

// --------------------------------------------
// Media Item Types
// --------------------------------------------
export interface MediaItem {
  id: number;
  externalId: string;
  source: SourceApp;
  type: MediaType;
  title: string;
  year: number | null;
  tmdbId: number | null;
  imdbId: string | null;
  tvdbId: number | null;
  runtimeMinutes: number | null;
  addedAt: string;
  sizeBytes: number;
  quality: string | null;
  posterUrl: string | null;
  genres: string[];
  metadata: Record<string, unknown>;
}

export interface Episode {
  id: number;
  externalId: string;
  mediaItemId: number;
  season: number;
  episode: number;
  title: string | null;
  sizeBytes: number;
  quality: string | null;
  airDate: string | null;
}

// --------------------------------------------
// Event Types
// --------------------------------------------
export interface DownloadEvent {
  id: number;
  mediaItemId: number;
  episodeId: number | null;
  eventType: EventType;
  timestamp: string;
  sizeBytes: number;
  quality: string | null;
  qualitySource: QualitySource | null;
  resolution: Resolution | null;
  videoCodec: VideoCodec | null;
  audioCodec: AudioCodec | null;
  releaseGroup: string | null;
  releaseTitle: string | null;
  indexer: string | null;
  downloadClient: string | null;
  sourceApp: SourceApp;
  qualityScore: number | null;
  rawData: Record<string, unknown>;
}

export interface PlaybackEvent {
  id: number;
  externalId: string | null;
  mediaItemId: number;
  episodeId: number | null;
  sourceApp: 'emby' | 'jellyfin';
  startedAt: string;
  endedAt: string | null;
  playDurationSeconds: number;
  completed: boolean;
  playMethod: string | null;
}

export interface SubtitleEvent {
  id: number;
  mediaItemId: number;
  episodeId: number | null;
  language: string;
  provider: string;
  timestamp: string;
  score: number | null;
}

export interface Request {
  id: number;
  externalId: string;
  mediaItemId: number | null;
  type: 'movie' | 'series';
  title: string;
  tmdbId: number | null;
  status: RequestStatus;
  requestedAt: string;
  approvedAt: string | null;
  availableAt: string | null;
}

// --------------------------------------------
// Stats Types
// --------------------------------------------
export interface DailyStats {
  date: string;
  downloads: number;
  upgrades: number;
  totalBytes: number;
  moviesAdded: number;
  episodesAdded: number;
  avgQualityScore: number | null;
}

export interface IndexerStats {
  id: number;
  indexerName: string;
  date: string;
  searches: number;
  grabs: number;
  failedGrabs: number;
  avgResponseMs: number | null;
}

// --------------------------------------------
// API Response Types
// --------------------------------------------
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface TimeSeriesData {
  label: string;
  data: TimeSeriesPoint[];
  color?: string;
}

export interface PieChartData {
  label: string;
  value: number;
  color?: string;
}

export interface TableRow {
  [key: string]: string | number | boolean | null;
}

export interface StatValue {
  value: number | string;
  previousValue?: number | string;
  changePercent?: number;
  unit?: string;
}

// Dashboard Stats
export interface OverviewStats {
  totalDownloads: StatValue;
  totalSizeBytes: StatValue;
  totalMediaItems: StatValue;
  avgQualityScore: StatValue;
  totalUpgrades: StatValue;
  totalPlaytime: StatValue;
}

export interface DownloadStats {
  byDay: TimeSeriesData[];
  byHour: number[][]; // Heatmap data [day][hour]
  byDayOfWeek: PieChartData[];
  byApp: PieChartData[];
}

export interface QualityStats {
  resolutionDistribution: PieChartData[];
  sourceDistribution: PieChartData[];
  codecDistribution: PieChartData[];
  qualityTrend: TimeSeriesData[];
  qualityOverTime: TimeSeriesData[]; // Stacked area
}

export interface ReleaseGroupStats {
  topByCount: TableRow[];
  topBySize: TableRow[];
  favoriteGroups: string[];
}

export interface IndexerPerformanceStats {
  successRates: TableRow[];
  grabsByIndexer: PieChartData[];
  responseTimeTrend: TimeSeriesData[];
}

export interface UpgradeStats {
  upgradesPerDay: TimeSeriesData[];
  mostUpgraded: TableRow[];
  upgradeFlows: SankeyData;
  avgTimeBetweenUpgrades: number; // hours
}

export interface SankeyNode {
  name: string;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export interface PlaybackStats {
  watchTimePerDay: TimeSeriesData[];
  mostWatched: TableRow[];
  watchedVsUnwatched: PieChartData[];
  neverWatched: TableRow[];
}

export interface RecordStats {
  biggestFile: { title: string; sizeBytes: number; date: string };
  smallestFile: { title: string; sizeBytes: number; date: string };
  mostUpgradedItem: { title: string; upgradeCount: number };
  busiestDay: { date: string; downloads: number; sizeBytes: number };
  longestUpgradeWait: { title: string; days: number };
  fastestGrab: { title: string; seconds: number };
}

// --------------------------------------------
// Settings Types
// --------------------------------------------
export interface AppConnection {
  app: SourceApp;
  url: string;
  apiKey: string;
  enabled: boolean;
  lastSync: string | null;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
}

export interface Settings {
  connections: AppConnection[];
  favoriteReleaseGroups: string[];
  pollIntervals: {
    history: number;
    metadata: number;
    playback: number;
  };
  historyImportMonths: number;
  defaultTimeRange: '24h' | '7d' | '30d' | '90d' | '1y' | 'all';
}

// --------------------------------------------
// Upgrade Path Types
// --------------------------------------------
export interface UpgradeStep {
  timestamp: string;
  quality: string;
  resolution: Resolution | null;
  source: QualitySource | null;
  releaseGroup: string | null;
  sizeBytes: number;
  qualityScore: number | null;
  // Episode info for series (Sonarr)
  episodeId?: number | null;
  season?: number | null;
  episode?: number | null;
  episodeTitle?: string | null;
}

export interface MediaUpgradePath {
  mediaItem: MediaItem;
  episode?: Episode;
  upgrades: UpgradeStep[];
  totalSizeDownloaded: number;
  upgradeCount: number;
  currentQualityScore: number | null;
}

// --------------------------------------------
// API Request Types
// --------------------------------------------
export interface TimeRangeParams {
  start: string;
  end: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface SortParams {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// --------------------------------------------
// API Response Types (Extended)
// --------------------------------------------

// Health
export interface HealthResponse {
  status: string;
  configuredApps: string[];
}

// Overview
export interface OverviewResponse {
  totalDownloads: StatValue;
  totalSizeBytes: StatValue;
  totalMediaItems: StatValue;
  avgQualityScore: StatValue;
  totalUpgrades: StatValue;
  totalPlaytime: StatValue;
  movies: number;
  series: number;
  episodes: number;
  storage: { totalSize: number; movieSize: number; seriesSize: number };
}

// Downloads
export interface DownloadsResponse {
  byDay: TimeSeriesData[];
  sizeByDay: TimeSeriesData[];
  heatmap: number[][];
  byDayOfWeek: PieChartData[];
  byApp: PieChartData[];
}

// Quality
export interface QualityResponse {
  resolutionDistribution: PieChartData[];
  sourceDistribution: PieChartData[];
  codecDistribution: PieChartData[];
  qualityTrend: TimeSeriesData[];
  qualityOverTime: TimeSeriesData[];
}

// Release Groups
export interface ReleaseGroupRow {
  rank: number;
  releaseGroup: string;
  downloads: number;
  totalSize: number;
  avgQualityScore: number | null;
}

export interface ReleaseGroupLoyalty {
  topGroups: string[];
  loyaltyPercent: number;
  totalDownloads: number;
}

export interface ReleaseGroupsResponse {
  topByCount: ReleaseGroupRow[];
  topBySize: ReleaseGroupRow[];
  favoriteGroups: ReleaseGroupRow[];
  loyalty: ReleaseGroupLoyalty;
}

export interface ReleaseGroupListItem {
  releaseGroup: string;
  totalDownloads: number;
  totalSizeBytes: number;
  avgQualityScore: number | null;
  firstSeen: string;
  lastSeen: string;
  movieCount: number;
  tvCount: number;
  upgradeCount: number;
}

export interface ReleaseGroupsListResponse {
  groups: ReleaseGroupListItem[];
  total: number;
  loyalty: ReleaseGroupLoyalty;
}

export interface ReleaseGroupDetailsResponse {
  releaseGroup: string;
  totalDownloads: number;
  totalSizeBytes: number;
  avgQualityScore: number | null;
  firstSeen: string;
  lastSeen: string;
  movieCount: number;
  tvCount: number;
  upgradeCount: number;
  resolutionBreakdown: PieChartData[];
  sourceBreakdown: PieChartData[];
  codecBreakdown: PieChartData[];
  topIndexers: Array<{ indexer: string; count: number }>;
  recentDownloads: Array<{ title: string; date: string; resolution: string | null; sizeBytes: number }>;
}

export interface ReleaseGroupPulseItem {
  period: string;
  count: number;
  sizeBytes: number;
}

export interface ReleaseGroupRankingItem {
  period: string;
  rank: number;
  count: number;
}

export interface ReleaseGroupContentItem {
  id: number;
  title: string;
  type: string;
  date: string;
  resolution: string | null;
  quality: string | null;
  sizeBytes: number;
}

export interface ReleaseGroupContentResponse {
  items: ReleaseGroupContentItem[];
  total: number;
}

// Upgrades
export interface UpgradeTableRow {
  rank: number;
  title: string;
  type: string;
  upgradeCount: number;
}

export interface UpgradesResponse {
  upgradesPerDay: TimeSeriesData[];
  mostUpgraded: UpgradeTableRow[];
  upgradeFlows: SankeyData;
  avgTimeBetweenUpgrades: number;
}

// Playback
export interface UserStatRow {
  rank: number;
  userName: string;
  playCount: number;
  uniqueItems: number;
}

export interface MostWatchedRow {
  rank: number;
  title: string;
  type: string;
  playCount: number;
}

export interface NeverWatchedRow {
  rank: number;
  title: string;
  type: string;
  sizeBytes: number;
  addedAt: string;
}

export interface RecentPlaybackRow {
  id: number;
  title: string;
  userName: string;
  durationSeconds: number;
  startedAt: string;
}

export interface PlaybackResponse {
  watchTimePerDay: TimeSeriesData[];
  mostWatched: MostWatchedRow[];
  watchedVsUnwatched: PieChartData[];
  neverWatched: NeverWatchedRow[];
  userStats: UserStatRow[];
  recentPlayback: RecentPlaybackRow[];
}

// Indexers
export interface IndexerOverview {
  totalGrabs: number;
  uniqueIndexers: number;
  topIndexer: string | null;
  topIndexerCount: number;
  totalSizeBytes: number;
}

export interface IndexerTableRow {
  rank: number;
  indexer: string;
  downloads: number;
  totalSize: number;
}

export interface IndexersResponse {
  overview: IndexerOverview;
  grabsOverTime: TimeSeriesData[];
  grabsByIndexer: PieChartData[];
  topIndexers: IndexerTableRow[];
}

// Movies
export interface MoviesOverview {
  totalMovies: number;
  totalSizeBytes: number;
  downloadedCount: number;
  upgradedCount: number;
  avgQualityScore: number | null;
}

export interface QualityBreakdown {
  resolution: PieChartData[];
  source: PieChartData[];
  codec: PieChartData[];
}

export interface MoviesResponse {
  overview: MoviesOverview;
  downloadsByDay: TimeSeriesData[];
  releaseGroups: ReleaseGroupRow[];
  quality: QualityBreakdown;
  genreDistribution: PieChartData[];
}

export interface RuntimeStats {
  shortestMinutes: number | null;
  shortestTitle: string | null;
  longestMinutes: number | null;
  longestTitle: string | null;
  averageMinutes: number | null;
  totalMinutes: number;
}

export interface TVRuntimeStats extends Omit<RuntimeStats, 'totalMinutes'> {
  totalWatchTimeMinutes: number;
}

export interface DecadeCount {
  decade: string;
  count: number;
}

export interface YearCount {
  year: number;
  count: number;
}

export interface StudioRow {
  rank: number;
  studio: string;
  count: number;
  sizeBytes: number;
}

// TV Shows
export interface TVOverview {
  totalSeries: number;
  totalEpisodes: number;
  totalSizeBytes: number;
  downloadedCount: number;
  upgradedCount: number;
  avgQualityScore: number | null;
}

export interface TVResponse {
  overview: TVOverview;
  downloadsByDay: TimeSeriesData[];
  releaseGroups: ReleaseGroupRow[];
  quality: QualityBreakdown;
  genreDistribution: PieChartData[];
}

export interface NetworkRow {
  label: string;
  value: number;
}

export interface MostActiveSeriesRow {
  rank: number;
  title: string;
  downloads: number;
  lastDownload: string;
}

export interface MostEpisodesRow {
  rank: number;
  title: string;
  episodeCount: number;
  sizeBytes: number;
}

// Genres
export interface GenreTopInfo {
  genre: string | null;
  count: number;
  change: number | null;
}

export interface GenreSeasonality {
  genre: string;
  peakMonth: number;
  monthName: string;
}

export interface GenreDiversity {
  score: number;
  uniqueGenres: number;
  totalGenres: number;
  topGenre: string | null;
  topGenrePercentage: number;
}

export interface GenresResponse {
  distribution: PieChartData[];
  overTime: TimeSeriesData[];
  topGenre: GenreTopInfo;
  seasonality: GenreSeasonality[];
  diversity: GenreDiversity;
}

export interface GenreDecade {
  genre: string;
  decade: string;
  count: number;
}

export interface GenreDetailsResponse {
  genre: string;
  totalItems: number;
  totalSizeBytes: number;
  movieCount: number;
  tvCount: number;
  topReleaseGroups: Array<{ releaseGroup: string; count: number }>;
  decadeBreakdown: DecadeCount[];
}

// Growth
export interface GrowthStats {
  totalDownloaded: number;
  netGrowth: number;
  newContentSize: number;
  upgradeDownloaded: number;
  upgradeReplaced: number;
  totalDownloads: number;
  newDownloads: number;
  totalUpgrades: number;
}

export interface GrowthByApp {
  app: string;
  downloaded: number;
  netGrowth: number;
  upgrades: number;
}

export interface GrowthResponse {
  stats: GrowthStats;
  byApp: GrowthByApp[];
  overTime: TimeSeriesData[];
  librarySize: { total: number; radarr: number; sonarr: number };
  breakdown: { newCount: number; upgradeCount: number; newSize: number; upgradeSize: number };
}

// Subtitles
export interface SubtitlesOverview {
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
  successRate: number;
}

export interface SubtitlesResponse {
  overview: SubtitlesOverview;
  byDay: TimeSeriesData[];
  languages: LanguageStats[];
  providers: ProviderStats[];
  scoreDistribution: PieChartData[];
}

export interface ProviderPerformanceRow {
  rank: number;
  provider: string;
  downloads: number;
  avgScore: number | null;
  successRate: number;
}

export interface RecentSubtitleRow {
  id: number;
  title: string;
  language: string;
  provider: string;
  score: number | null;
  timestamp: string;
}

// Records
export interface RecordItem {
  title: string;
  sizeBytes?: number;
  date?: string;
  year?: number;
  minutes?: number;
  count?: number;
  days?: number;
}

export interface AllTimeRecordsResponse {
  biggestDownload: RecordItem | null;
  smallestDownload: RecordItem | null;
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

export interface MilestoneItem {
  milestone: number;
  title: string;
  date: string;
  type: 'movie' | 'series';
}

export interface GoldenHourResponse {
  hour: number;
  downloads: number;
  percentage: number;
}

export interface HourPattern {
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

export interface WeekendVsWeekday {
  weekday: { count: number; percentage: number; avgPerDay: number };
  weekend: { count: number; percentage: number; avgPerDay: number };
}

export interface PatternsResponse {
  byHour: HourPattern[];
  byDayOfWeek: DayOfWeekPattern[];
  weekendVsWeekday: WeekendVsWeekday;
}

export interface CalendarDay {
  date: string;
  count: number;
  sizeBytes: number;
}

export interface QualityJourneyItem {
  quality: string;
  firstDate: string;
  firstTitle: string;
}

export interface DecadesRecord {
  decade: string;
  movieCount: number;
  tvCount: number;
  totalCount: number;
}

export interface StreaksResponse {
  longestStreak: { startDate: string; endDate: string; days: number };
  currentStreak: { startDate: string; days: number } | null;
}

export interface QuirkyStatsResponse {
  totalWatchTimeYears: number;
  avgDownloadsPerWeek: number;
  favoriteDayOfWeek: string;
  mostActiveMonth: { month: string; year: number; count: number } | null;
  downloadedOnHolidays: number;
  nightOwlPercentage: number;
  earlyBirdPercentage: number;
}

export interface LibraryInsightsResponse {
  releaseGroupLoyalty: { group: string; percentage: number; count: number } | null;
  mostBingedShow: { title: string; episodesInOneDay: number; date: string } | null;
  avgUpgradeTime: { days: number; sampleSize: number } | null;
  genreVariety: { uniqueGenres: number; topGenre: string; topGenrePercentage: number } | null;
  qualityBreakdown: Array<{ resolution: string; percentage: number }>;
  seriesCompletionRate: { completed: number; inProgress: number; percentage: number } | null;
  avgMovieSize: { bytes: number; comparedToTypical: string } | null;
  oldestWatched: { title: string; year: number } | null;
}

// Discord
export interface DiscordWebhook {
  id: number;
  name: string;
  webhookUrl: string;
  enabled: boolean;
  sendDaily: boolean;
  sendWeekly: boolean;
  sendMonthly: boolean;
  sendYearly: boolean;
  includeMovies: boolean;
  includeTVShows: boolean;
  includeSubtitles: boolean;
  includePlayback: boolean;
  includeIndexers: boolean;
  includeReleaseGroups: boolean;
  includeGenres: boolean;
  includeQuirkyStats: boolean;
  mentionRoleId: string | null;
  mentionUserId: string | null;
  mentionOnlyYearly: boolean;
}

export interface DiscordSchedule {
  id: string;
  enabled: boolean;
  hour: number;
  minute: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  month: number | null;
}

// Media
export interface MediaListItem {
  id: number;
  title: string;
  type: MediaType;
  year: number | null;
  posterUrl: string | null;
  sizeBytes: number;
  quality: string | null;
  addedAt: string;
}

export interface MediaPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MediaListResponse {
  items: MediaListItem[];
  pagination: MediaPagination;
}

export interface MediaHistoryItem {
  id: number;
  eventType: EventType;
  timestamp: string;
  quality: string | null;
  resolution: Resolution | null;
  releaseGroup: string | null;
  sizeBytes: number;
  indexer: string | null;
}

export interface MediaPlaybackItem {
  id: number;
  userName: string;
  startedAt: string;
  durationSeconds: number;
  completed: boolean;
}

// Connections
export interface Connection {
  id: number;
  name: string;
  type: string;
  url: string;
  apiKey: string;
  enabled: boolean;
  isDefault: boolean;
  lastTestAt: string | null;
  lastTestSuccess: boolean | null;
  lastTestError: string | null;
}

export interface ConnectionStatus {
  hasConnections: boolean;
  connectionCount: number;
  enabledCount: number;
  byType: Record<string, number>;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  version?: string;
}

// Settings
export interface SettingsResponse {
  configuredServices: string[];
  pollIntervals: { history: number; metadata: number; playback: number };
  historyImportMonths: number;
  favoriteReleaseGroups: string[];
  defaultTimeRange: TimeRange;
}

export type TimeRange = '24h' | '7d' | '30d' | '90d' | '1y' | 'all';

export interface SyncTask {
  connectionId: number;
  connectionName: string;
  connectionType: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  syncType: 'history' | 'metadata' | 'playback' | 'stats';
  startedAt?: string;
  completedAt?: string;
  progress?: { current: number; total: number; message: string };
  result?: { processed: number; added?: number; updated?: number; errors: string[] };
  error?: string;
}

export interface LastSyncInfo {
  type: string;
  completedAt: string;
  duration: number;
  totalProcessed: number;
  totalErrors: number;
}

export interface SyncStatusResponse {
  isRunning: boolean;
  currentSyncType: 'full' | 'history' | 'metadata' | 'playback' | null;
  startedAt: string | null;
  tasks: SyncTask[];
  lastSync: LastSyncInfo | null;
}

export interface SchedulerStatusResponse {
  isRunning: boolean;
  jobs: string[];
  configuredServices: string[];
  connectionCount: number;
}
