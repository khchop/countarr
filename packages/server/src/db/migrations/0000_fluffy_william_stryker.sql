CREATE TABLE `daily_stats` (
	`date` text PRIMARY KEY NOT NULL,
	`downloads` integer DEFAULT 0 NOT NULL,
	`upgrades` integer DEFAULT 0 NOT NULL,
	`total_bytes` integer DEFAULT 0 NOT NULL,
	`movies_added` integer DEFAULT 0 NOT NULL,
	`episodes_added` integer DEFAULT 0 NOT NULL,
	`avg_quality_score` real
);
--> statement-breakpoint
CREATE TABLE `discord_schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`hour` integer DEFAULT 23 NOT NULL,
	`minute` integer DEFAULT 0 NOT NULL,
	`day_of_week` integer,
	`day_of_month` integer,
	`month` integer
);
--> statement-breakpoint
CREATE TABLE `discord_webhooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`webhook_url` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`send_daily` integer DEFAULT true NOT NULL,
	`send_weekly` integer DEFAULT true NOT NULL,
	`send_monthly` integer DEFAULT true NOT NULL,
	`send_yearly` integer DEFAULT true NOT NULL,
	`include_movies` integer DEFAULT true NOT NULL,
	`include_tv` integer DEFAULT true NOT NULL,
	`include_subtitles` integer DEFAULT true NOT NULL,
	`include_playback` integer DEFAULT true NOT NULL,
	`include_indexers` integer DEFAULT true NOT NULL,
	`include_release_groups` integer DEFAULT true NOT NULL,
	`include_genres` integer DEFAULT true NOT NULL,
	`include_quirky` integer DEFAULT true NOT NULL,
	`mention_role_id` text,
	`mention_user_id` text,
	`mention_only_yearly` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_sent_at` text
);
--> statement-breakpoint
CREATE TABLE `download_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_item_id` integer NOT NULL,
	`episode_id` integer,
	`event_type` text NOT NULL,
	`timestamp` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`quality` text,
	`quality_source` text,
	`resolution` text,
	`video_codec` text,
	`audio_codec` text,
	`release_group` text,
	`release_title` text,
	`indexer` text,
	`download_client` text,
	`source_app` text NOT NULL,
	`quality_score` integer,
	`raw_data` text,
	`is_upgrade` integer DEFAULT false,
	`previous_size_bytes` integer,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `download_events_media_item_idx` ON `download_events` (`media_item_id`);--> statement-breakpoint
CREATE INDEX `download_events_timestamp_idx` ON `download_events` (`timestamp`);--> statement-breakpoint
CREATE INDEX `download_events_event_type_idx` ON `download_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `download_events_release_group_idx` ON `download_events` (`release_group`);--> statement-breakpoint
CREATE INDEX `download_events_indexer_idx` ON `download_events` (`indexer`);--> statement-breakpoint
CREATE INDEX `download_events_source_app_idx` ON `download_events` (`source_app`);--> statement-breakpoint
CREATE INDEX `download_events_source_app_timestamp_idx` ON `download_events` (`source_app`,`timestamp`);--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_item_id` integer NOT NULL,
	`external_id` text NOT NULL,
	`season` integer NOT NULL,
	`episode` integer NOT NULL,
	`title` text,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`quality` text,
	`air_date` text,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `episodes_media_item_idx` ON `episodes` (`media_item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `episodes_media_season_ep_idx` ON `episodes` (`media_item_id`,`season`,`episode`);--> statement-breakpoint
CREATE TABLE `indexer_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`indexer_name` text NOT NULL,
	`date` text NOT NULL,
	`searches` integer DEFAULT 0 NOT NULL,
	`grabs` integer DEFAULT 0 NOT NULL,
	`failed_grabs` integer DEFAULT 0 NOT NULL,
	`avg_response_ms` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `indexer_stats_name_date_idx` ON `indexer_stats` (`indexer_name`,`date`);--> statement-breakpoint
CREATE TABLE `media_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`source` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`tmdb_id` integer,
	`imdb_id` text,
	`tvdb_id` integer,
	`runtime_minutes` integer,
	`added_at` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`quality` text,
	`poster_url` text,
	`genres` text,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_items_source_external_idx` ON `media_items` (`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `media_items_tmdb_idx` ON `media_items` (`tmdb_id`);--> statement-breakpoint
CREATE INDEX `media_items_type_idx` ON `media_items` (`type`);--> statement-breakpoint
CREATE INDEX `media_items_year_idx` ON `media_items` (`year`);--> statement-breakpoint
CREATE INDEX `media_items_source_type_idx` ON `media_items` (`source`,`type`);--> statement-breakpoint
CREATE TABLE `playback_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_item_id` integer NOT NULL,
	`episode_id` integer,
	`external_id` text,
	`started_at` text NOT NULL,
	`ended_at` text,
	`play_duration_seconds` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`play_method` text,
	`source_app` text NOT NULL,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `playback_events_media_item_idx` ON `playback_events` (`media_item_id`);--> statement-breakpoint
CREATE INDEX `playback_events_started_at_idx` ON `playback_events` (`started_at`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`media_item_id` integer,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`tmdb_id` integer,
	`status` text NOT NULL,
	`requested_at` text NOT NULL,
	`approved_at` text,
	`available_at` text,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `requests_external_id_unique` ON `requests` (`external_id`);--> statement-breakpoint
CREATE INDEX `requests_status_idx` ON `requests` (`status`);--> statement-breakpoint
CREATE INDEX `requests_requested_at_idx` ON `requests` (`requested_at`);--> statement-breakpoint
CREATE TABLE `service_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`api_key` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`last_test_at` text,
	`last_test_success` integer,
	`last_test_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `service_connections_type_idx` ON `service_connections` (`type`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subtitle_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_item_id` integer NOT NULL,
	`episode_id` integer,
	`language` text NOT NULL,
	`provider` text NOT NULL,
	`timestamp` text NOT NULL,
	`score` integer,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subtitle_events_media_item_idx` ON `subtitle_events` (`media_item_id`);--> statement-breakpoint
CREATE INDEX `subtitle_events_timestamp_idx` ON `subtitle_events` (`timestamp`);--> statement-breakpoint
CREATE INDEX `subtitle_events_language_idx` ON `subtitle_events` (`language`);--> statement-breakpoint
CREATE INDEX `subtitle_events_provider_idx` ON `subtitle_events` (`provider`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`connection_id` integer PRIMARY KEY NOT NULL,
	`last_sync_at` text,
	`last_history_id` integer,
	`status` text DEFAULT 'idle' NOT NULL,
	`error` text,
	FOREIGN KEY (`connection_id`) REFERENCES `service_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
