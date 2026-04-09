import { createApp } from '../app.js';
import { createLocalDatabase } from '../db/index.js';

export function createServerRuntime(
  dbPath: string,
  { allowPasswordlessLogin = false }: { allowPasswordlessLogin?: boolean } = {},
) {
  const db = createLocalDatabase(dbPath);
  const app = createApp(db, { secureCookies: false, allowPasswordlessLogin });

  return { db, app };
}
