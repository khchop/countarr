import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { config } from '../config.js';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let sqlite: DatabaseType;

try {
  sqlite = new Database(config.databasePath);

  // Enable WAL mode for better concurrent access
  sqlite.pragma('journal_mode = WAL');

  // Enable foreign keys
  sqlite.pragma('foreign_keys = ON');
} catch (err) {
  console.error('Failed to initialize database:', err);
  throw new Error(`Database initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
}

export const db = drizzle(sqlite, { schema });

// Export raw sqlite for complex queries that Drizzle doesn't support well
export const rawDb: DatabaseType = sqlite;

export { schema };
export type DB = typeof db;

// Cleanup function for graceful shutdown
export function closeDatabase(): void {
  try {
    sqlite.close();
  } catch (err) {
    console.error('Error closing database:', err);
  }
}
