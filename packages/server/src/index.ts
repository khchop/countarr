import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { registerRoutes } from './api/index.js';
import { scheduler } from './scheduler/index.js';
import { db, closeDatabase } from './db/index.js';
import { sql } from 'drizzle-orm';
import { registerAuth } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function initDatabase() {
  console.log('Initializing database...');
  
  // Create tables if they don't exist
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS media_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL,
      source TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      tmdb_id INTEGER,
      imdb_id TEXT,
      tvdb_id INTEGER,
      runtime_minutes INTEGER,
      added_at TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      quality TEXT,
      poster_url TEXT,
      genres TEXT,
      metadata TEXT
    )
  `);

  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS media_items_source_external_idx 
    ON media_items(source, external_id)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_item_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      external_id TEXT NOT NULL,
      season INTEGER NOT NULL,
      episode INTEGER NOT NULL,
      title TEXT,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      quality TEXT,
      air_date TEXT
    )
  `);

  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS episodes_media_season_ep_idx 
    ON episodes(media_item_id, season, episode)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS download_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_item_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      quality TEXT,
      quality_source TEXT,
      resolution TEXT,
      video_codec TEXT,
      audio_codec TEXT,
      release_group TEXT,
      release_title TEXT,
      indexer TEXT,
      download_client TEXT,
      source_app TEXT NOT NULL,
      quality_score INTEGER,
      is_upgrade INTEGER DEFAULT 0,
      previous_size_bytes INTEGER,
      raw_data TEXT
    )
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS download_events_media_item_idx 
    ON download_events(media_item_id)
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS download_events_timestamp_idx 
    ON download_events(timestamp)
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS download_events_release_group_idx 
    ON download_events(release_group)
  `);

  // Critical index for time-based queries filtering by event type
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS download_events_type_timestamp_idx 
    ON download_events(event_type, timestamp)
  `);

  // Index for upgrade tracking queries
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS download_events_is_upgrade_idx 
    ON download_events(is_upgrade) WHERE is_upgrade = 1
  `);

  // Index for source app filtering
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS download_events_source_app_idx 
    ON download_events(source_app)
  `);

  // Index for quality score aggregations
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS download_events_quality_score_idx 
    ON download_events(quality_score) WHERE quality_score IS NOT NULL
  `);

  // Unique constraint to prevent duplicate events (used for ON CONFLICT)
  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS download_events_unique_idx 
    ON download_events(source_app, media_item_id, timestamp, event_type)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL UNIQUE,
      media_item_id INTEGER REFERENCES media_items(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      tmdb_id INTEGER,
      status TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      approved_at TEXT,
      available_at TEXT
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS playback_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_item_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
      external_id TEXT,
      user_id TEXT,
      user_name TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      play_duration_seconds INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      play_method TEXT,
      source_app TEXT NOT NULL
    )
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS playback_events_media_item_idx 
    ON playback_events(media_item_id)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS subtitle_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_item_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
      language TEXT NOT NULL,
      provider TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      score INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS indexer_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indexer_name TEXT NOT NULL,
      date TEXT NOT NULL,
      searches INTEGER NOT NULL DEFAULT 0,
      grabs INTEGER NOT NULL DEFAULT 0,
      failed_grabs INTEGER NOT NULL DEFAULT 0,
      avg_response_ms INTEGER
    )
  `);

  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS indexer_stats_name_date_idx 
    ON indexer_stats(indexer_name, date)
  `);

  // Index for date range queries on indexer stats
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS indexer_stats_date_idx 
    ON indexer_stats(date)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      downloads INTEGER NOT NULL DEFAULT 0,
      upgrades INTEGER NOT NULL DEFAULT 0,
      total_bytes INTEGER NOT NULL DEFAULT 0,
      movies_added INTEGER NOT NULL DEFAULT 0,
      episodes_added INTEGER NOT NULL DEFAULT 0,
      avg_quality_score REAL
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS service_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      last_test_at TEXT,
      last_test_success INTEGER,
      last_test_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS service_connections_type_idx 
    ON service_connections(type)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS sync_state (
      connection_id INTEGER PRIMARY KEY REFERENCES service_connections(id) ON DELETE CASCADE,
      last_sync_at TEXT,
      last_history_id INTEGER,
      status TEXT NOT NULL DEFAULT 'idle',
      error TEXT
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS discord_webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      webhook_url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      send_daily INTEGER NOT NULL DEFAULT 1,
      send_weekly INTEGER NOT NULL DEFAULT 1,
      send_monthly INTEGER NOT NULL DEFAULT 1,
      send_yearly INTEGER NOT NULL DEFAULT 1,
      include_movies INTEGER NOT NULL DEFAULT 1,
      include_tv INTEGER NOT NULL DEFAULT 1,
      include_subtitles INTEGER NOT NULL DEFAULT 1,
      include_playback INTEGER NOT NULL DEFAULT 1,
      include_indexers INTEGER NOT NULL DEFAULT 1,
      include_release_groups INTEGER NOT NULL DEFAULT 1,
      include_genres INTEGER NOT NULL DEFAULT 1,
      include_quirky INTEGER NOT NULL DEFAULT 1,
      mention_role_id TEXT,
      mention_user_id TEXT,
      mention_only_yearly INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_sent_at TEXT
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS discord_schedule (
      id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      hour INTEGER NOT NULL DEFAULT 23,
      minute INTEGER NOT NULL DEFAULT 0,
      day_of_week INTEGER,
      day_of_month INTEGER,
      month INTEGER
    )
  `);

  console.log('Database initialized');
}

async function main() {
  const fastify = Fastify({
    logger: config.nodeEnv === 'development',
  });

  // Register CORS with configurable origins
  const corsOrigin = config.allowedOrigins
    ? config.allowedOrigins.split(',').map(o => o.trim())
    : config.nodeEnv === 'production'
      ? false // Disable CORS in production unless explicitly configured
      : true; // Allow all origins in development

  await fastify.register(cors, {
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Api-Key', 'Authorization'],
  });

  // Register rate limiting
  fastify.addHook('preHandler', rateLimitMiddleware);

  // Register authentication
  registerAuth(fastify);

  // Initialize database
  await initDatabase();

  // Register API routes
  await registerRoutes(fastify);

  // Serve static files in production (web UI)
  if (config.nodeEnv === 'production') {
    const webDistPath = path.join(__dirname, '../../web/dist');
    await fastify.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    });

    // SPA fallback
    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  // Start server
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║   Countarr server running on port ${config.port}   ║
║                                           ║
║   API:  http://localhost:${config.port}/api       ║
║   Web:  http://localhost:${config.port}           ║
║                                           ║
╚═══════════════════════════════════════════╝
`);

    // Start scheduler
    await scheduler.start();
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Handle shutdown gracefully
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  
  // Stop accepting new requests
  scheduler.stop();
  
  // Close database connection to ensure WAL is checkpointed
  closeDatabase();
  
  console.log('[Shutdown] Cleanup complete');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejection, but log it
});

main();
