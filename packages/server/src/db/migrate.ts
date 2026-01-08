import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Running migrations...');

migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });

console.log('Migrations complete!');
