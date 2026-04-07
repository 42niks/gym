import { serve } from '@hono/node-server';
import fs from 'fs';
import path from 'path';
import { createDatabase } from './db/index.js';
import { createApp } from './app.js';

const DB_PATH = process.env.DB_PATH ?? './data/dev.db';
const PORT = parseInt(process.env.PORT ?? '8099', 10);

const db = createDatabase(DB_PATH);

// Seed credentials only on first-time setup (no members exist yet)
const memberCount = (db.prepare('SELECT COUNT(*) as c FROM members').get() as { c: number }).c;
if (memberCount === 0) {
  const credentialsFile = path.resolve(import.meta.dirname, 'db/seed.credentials.sql');
  if (fs.existsSync(credentialsFile)) {
    const sql = fs.readFileSync(credentialsFile, 'utf-8')
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim() !== '')
      .join('\n');
    db.exec(sql);
    console.log('First run: applied seed.credentials.sql');
  }
}

const app = createApp(db);

console.log(`BASE Gym (dev) running on http://localhost:${PORT}  DB: ${DB_PATH}`);
serve({ fetch: app.fetch, port: PORT });
