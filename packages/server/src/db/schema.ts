import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ============================================
// Media Items (Movies + Series)
// ============================================
export const mediaItems = sqliteTable('media_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  externalId: text('external_id').notNull(),
  connectionId: integer('connection_id').references(() => serviceConnections.id, { onDelete: 'set null' }),
  source: text('source').notNull(), // 'radarr' | 'sonarr'
  type: text('type').notNull(), // 'movie' | 'series'
  title: text('title').notNull(),
  year: integer('year'),
  tmdbId: integer('tmdb_id'),
  imdbId: text('imdb_id'),
  tvdbId: integer('tvdb_id'),
  runtimeMinutes: integer('runtime_minutes'),
  addedAt: text('added_at').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  quality: text('quality'),
  posterUrl: text('poster_url'),
  genres: text('genres'), // JSON array
  metadata: text('metadata'), // JSON
}, (table) => [
  uniqueIndex('media_items_connection_external_idx').on(table.connectionId, table.externalId),
  index('media_items_tmdb_idx').on(table.tmdbId),
  index('media_items_type_idx').on(table.type),
  index('media_items_year_idx').on(table.year),
  index('media_items_source_type_idx').on(table.source, table.type),
  index('media_items_connection_idx').on(table.connectionId),
]);

// ============================================
// Episodes (for Sonarr series)
// ============================================
export const episodes = sqliteTable('episodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mediaItemId: integer('media_item_id').notNull().references(() => mediaItems.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(),
  season: integer('season').notNull(),
  episode: integer('episode').notNull(),
  title: text('title'),
  sizeBytes: integer('size_bytes').notNull().default(0),
  quality: text('quality'),
  airDate: text('air_date'),
}, (table) => [
  index('episodes_media_item_idx').on(table.mediaItemId),
  uniqueIndex('episodes_media_season_ep_idx').on(table.mediaItemId, table.season, table.episode),
]);

// ============================================
// Download Events
// ============================================
export const downloadEvents = sqliteTable('download_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mediaItemId: integer('media_item_id').notNull().references(() => mediaItems.id, { onDelete: 'cascade' }),
  episodeId: integer('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
  connectionId: integer('connection_id').references(() => serviceConnections.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(), // 'grabbed' | 'downloaded' | 'upgraded' | 'deleted' | 'imported'
  timestamp: text('timestamp').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  quality: text('quality'),
  qualitySource: text('quality_source'), // 'BluRay' | 'WEB-DL' | etc.
  resolution: text('resolution'), // '1080p' | '4K' | etc.
  videoCodec: text('video_codec'),
  audioCodec: text('audio_codec'),
  releaseGroup: text('release_group'),
  releaseTitle: text('release_title'),
  indexer: text('indexer'),
  downloadClient: text('download_client'),
  sourceApp: text('source_app').notNull(),
  qualityScore: integer('quality_score'),
  rawData: text('raw_data'), // JSON
  // Upgrade tracking (for net growth calculations)
  isUpgrade: integer('is_upgrade', { mode: 'boolean' }).default(false),
  previousSizeBytes: integer('previous_size_bytes'), // Size of replaced file (null if new)
}, (table) => [
  index('download_events_media_item_idx').on(table.mediaItemId),
  index('download_events_timestamp_idx').on(table.timestamp),
  index('download_events_event_type_idx').on(table.eventType),
  index('download_events_release_group_idx').on(table.releaseGroup),
  index('download_events_indexer_idx').on(table.indexer),
  index('download_events_source_app_idx').on(table.sourceApp),
  index('download_events_source_app_timestamp_idx').on(table.sourceApp, table.timestamp),
  index('download_events_connection_idx').on(table.connectionId),
  index('download_events_connection_timestamp_idx').on(table.connectionId, table.timestamp),
]);

// ============================================
// Jellyseerr Requests
// ============================================
export const requests = sqliteTable('requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  externalId: text('external_id').notNull().unique(),
  mediaItemId: integer('media_item_id').references(() => mediaItems.id, { onDelete: 'set null' }),
  type: text('type').notNull(), // 'movie' | 'tv'
  title: text('title').notNull(),
  tmdbId: integer('tmdb_id'),
  status: text('status').notNull(), // 'pending' | 'approved' | 'available' | 'declined'
  requestedAt: text('requested_at').notNull(),
  approvedAt: text('approved_at'),
  availableAt: text('available_at'),
}, (table) => [
  index('requests_status_idx').on(table.status),
  index('requests_requested_at_idx').on(table.requestedAt),
]);

// ============================================
// Playback Events (Emby/Jellyfin)
// ============================================
export const playbackEvents = sqliteTable('playback_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mediaItemId: integer('media_item_id').notNull().references(() => mediaItems.id, { onDelete: 'cascade' }),
  episodeId: integer('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
  connectionId: integer('connection_id').references(() => serviceConnections.id, { onDelete: 'set null' }),
  externalId: text('external_id'), // Emby/Jellyfin item ID
  userId: text('user_id'), // Emby/Jellyfin user ID
  userName: text('user_name'), // User display name
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  playDurationSeconds: integer('play_duration_seconds').notNull().default(0),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  playMethod: text('play_method'), // 'DirectPlay' | 'Transcode'
  sourceApp: text('source_app').notNull(), // 'emby' | 'jellyfin'
}, (table) => [
  index('playback_events_media_item_idx').on(table.mediaItemId),
  index('playback_events_started_at_idx').on(table.startedAt),
  index('playback_events_user_idx').on(table.userName),
  index('playback_events_connection_idx').on(table.connectionId),
]);

// ============================================
// Subtitle Events (Bazarr)
// ============================================
export const subtitleEvents = sqliteTable('subtitle_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mediaItemId: integer('media_item_id').notNull().references(() => mediaItems.id, { onDelete: 'cascade' }),
  episodeId: integer('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
  connectionId: integer('connection_id').references(() => serviceConnections.id, { onDelete: 'set null' }),
  language: text('language').notNull(),
  provider: text('provider').notNull(),
  timestamp: text('timestamp').notNull(),
  score: integer('score'),
}, (table) => [
  index('subtitle_events_media_item_idx').on(table.mediaItemId),
  index('subtitle_events_timestamp_idx').on(table.timestamp),
  index('subtitle_events_language_idx').on(table.language),
  index('subtitle_events_provider_idx').on(table.provider),
  index('subtitle_events_connection_idx').on(table.connectionId),
]);

// ============================================
// Indexer Stats (Prowlarr)
// ============================================
export const indexerStats = sqliteTable('indexer_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  connectionId: integer('connection_id').references(() => serviceConnections.id, { onDelete: 'set null' }),
  indexerName: text('indexer_name').notNull(),
  date: text('date').notNull(),
  searches: integer('searches').notNull().default(0),
  grabs: integer('grabs').notNull().default(0),
  failedGrabs: integer('failed_grabs').notNull().default(0),
  avgResponseMs: integer('avg_response_ms'),
}, (table) => [
  uniqueIndex('indexer_stats_connection_name_date_idx').on(table.connectionId, table.indexerName, table.date),
  index('indexer_stats_connection_idx').on(table.connectionId),
]);

// ============================================
// Daily Aggregated Stats (for fast queries)
// ============================================
export const dailyStats = sqliteTable('daily_stats', {
  date: text('date').primaryKey(),
  downloads: integer('downloads').notNull().default(0),
  upgrades: integer('upgrades').notNull().default(0),
  totalBytes: integer('total_bytes').notNull().default(0),
  moviesAdded: integer('movies_added').notNull().default(0),
  episodesAdded: integer('episodes_added').notNull().default(0),
  avgQualityScore: real('avg_quality_score'),
});

// ============================================
// Service Connections (configured via UI)
// ============================================
export const serviceConnections = sqliteTable('service_connections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // User-friendly name
  type: text('type').notNull(), // 'radarr' | 'sonarr' | 'bazarr' | 'prowlarr' | 'jellyseerr' | 'emby' | 'jellyfin'
  url: text('url').notNull(),
  apiKey: text('api_key').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false), // For multiple instances
  lastTestAt: text('last_test_at'),
  lastTestSuccess: integer('last_test_success', { mode: 'boolean' }),
  lastTestError: text('last_test_error'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('service_connections_type_idx').on(table.type),
]);

// ============================================
// Settings
// ============================================
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON
});

// ============================================
// Sync State (track last sync per app)
// ============================================
export const syncState = sqliteTable('sync_state', {
  connectionId: integer('connection_id').primaryKey().references(() => serviceConnections.id, { onDelete: 'cascade' }),
  lastSyncAt: text('last_sync_at'),
  lastHistoryId: integer('last_history_id'),
  status: text('status').notNull().default('idle'), // 'idle' | 'syncing' | 'error'
  error: text('error'),
});

// ============================================
// Discord Webhooks
// ============================================
export const discordWebhooks = sqliteTable('discord_webhooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  webhookUrl: text('webhook_url').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  // Which summaries to send
  sendDaily: integer('send_daily', { mode: 'boolean' }).notNull().default(true),
  sendWeekly: integer('send_weekly', { mode: 'boolean' }).notNull().default(true),
  sendMonthly: integer('send_monthly', { mode: 'boolean' }).notNull().default(true),
  sendYearly: integer('send_yearly', { mode: 'boolean' }).notNull().default(true),
  // Content toggles
  includeMovies: integer('include_movies', { mode: 'boolean' }).notNull().default(true),
  includeTVShows: integer('include_tv', { mode: 'boolean' }).notNull().default(true),
  includeSubtitles: integer('include_subtitles', { mode: 'boolean' }).notNull().default(true),
  includePlayback: integer('include_playback', { mode: 'boolean' }).notNull().default(true),
  includeIndexers: integer('include_indexers', { mode: 'boolean' }).notNull().default(true),
  includeReleaseGroups: integer('include_release_groups', { mode: 'boolean' }).notNull().default(true),
  includeGenres: integer('include_genres', { mode: 'boolean' }).notNull().default(true),
  includeQuirkyStats: integer('include_quirky', { mode: 'boolean' }).notNull().default(true),
  // Mention settings
  mentionRoleId: text('mention_role_id'),
  mentionUserId: text('mention_user_id'),
  mentionOnlyYearly: integer('mention_only_yearly', { mode: 'boolean' }).notNull().default(false),
  // Timestamps
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  lastSentAt: text('last_sent_at'),
});

// ============================================
// Discord Schedule
// ============================================
export const discordSchedule = sqliteTable('discord_schedule', {
  id: text('id').primaryKey(), // 'daily' | 'weekly' | 'monthly' | 'yearly'
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  hour: integer('hour').notNull().default(23), // 0-23
  minute: integer('minute').notNull().default(0), // 0-59
  dayOfWeek: integer('day_of_week'), // 0-6 for weekly (0=Sunday, 1=Monday, etc.)
  dayOfMonth: integer('day_of_month'), // 1-31 for monthly/yearly
  month: integer('month'), // 1-12 for yearly only
});

// Type exports
export type MediaItem = typeof mediaItems.$inferSelect;
export type NewMediaItem = typeof mediaItems.$inferInsert;
export type Episode = typeof episodes.$inferSelect;
export type NewEpisode = typeof episodes.$inferInsert;
export type DownloadEvent = typeof downloadEvents.$inferSelect;
export type NewDownloadEvent = typeof downloadEvents.$inferInsert;
export type Request = typeof requests.$inferSelect;
export type NewRequest = typeof requests.$inferInsert;
export type PlaybackEvent = typeof playbackEvents.$inferSelect;
export type NewPlaybackEvent = typeof playbackEvents.$inferInsert;
export type SubtitleEvent = typeof subtitleEvents.$inferSelect;
export type NewSubtitleEvent = typeof subtitleEvents.$inferInsert;
export type IndexerStat = typeof indexerStats.$inferSelect;
export type NewIndexerStat = typeof indexerStats.$inferInsert;
export type DailyStat = typeof dailyStats.$inferSelect;
export type NewDailyStat = typeof dailyStats.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type SyncState = typeof syncState.$inferSelect;
export type ServiceConnection = typeof serviceConnections.$inferSelect;
export type NewServiceConnection = typeof serviceConnections.$inferInsert;
export type DiscordWebhook = typeof discordWebhooks.$inferSelect;
export type NewDiscordWebhook = typeof discordWebhooks.$inferInsert;
export type DiscordScheduleEntry = typeof discordSchedule.$inferSelect;
export type NewDiscordScheduleEntry = typeof discordSchedule.$inferInsert;
