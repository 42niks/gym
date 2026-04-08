import { createApp } from '../app.js';
import { createLocalDatabase } from '../db/index.js';

export function createServerRuntime(dbPath: string) {
  const db = createLocalDatabase(dbPath);
  const app = createApp(db, { secureCookies: false });

  return { db, app };
}
