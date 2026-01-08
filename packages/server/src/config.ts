import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root (optional - for server settings only)
dotenvConfig({ path: path.resolve(__dirname, '../../../.env') });

const configSchema = z.object({
  // Server
  port: z.coerce.number().default(7474),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  databasePath: z.string().default('./data/countarr.db'),

  // Default polling intervals (can be overridden in settings UI)
  defaultPollIntervalHistory: z.coerce.number().default(5),
  defaultPollIntervalMetadata: z.coerce.number().default(30),
  defaultPollIntervalPlayback: z.coerce.number().default(1),

  // Historical import
  defaultHistoryImportMonths: z.coerce.number().default(12),

  // Security
  apiKey: z.string().optional(), // Optional API key for authentication
  allowedOrigins: z.string().optional(), // Comma-separated list of allowed CORS origins
});

const rawConfig = {
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  databasePath: process.env.DATABASE_PATH,
  defaultPollIntervalHistory: process.env.DEFAULT_POLL_INTERVAL_HISTORY,
  defaultPollIntervalMetadata: process.env.DEFAULT_POLL_INTERVAL_METADATA,
  defaultPollIntervalPlayback: process.env.DEFAULT_POLL_INTERVAL_PLAYBACK,
  defaultHistoryImportMonths: process.env.DEFAULT_HISTORY_IMPORT_MONTHS,
  apiKey: process.env.STATSARR_API_KEY,
  allowedOrigins: process.env.ALLOWED_ORIGINS,
};

export const config = configSchema.parse(rawConfig);

export type Config = typeof config;
