import fs from 'node:fs';
import path from 'node:path';
import { startNodeServer } from './server/node-server.js';
import { createServerRuntime } from './server/runtime.js';
import { applyCredentialsSeed } from './db/index.js';

const DB_PATH = process.env.DB_PATH ?? './data/dev.db';
const PORT = parseInt(process.env.PORT ?? '8099', 10);

async function seedInitialCredentials(db: import('./db/client.js').AppDatabase): Promise<void> {
  const memberCount = await db.get<{ c: number }>('SELECT COUNT(*) as c FROM members');
  if ((memberCount?.c ?? 0) !== 0) {
    return;
  }

  const credentialsFile = path.resolve(import.meta.dirname, 'db/seed.credentials.sql');
  if (!fs.existsSync(credentialsFile)) {
    return;
  }

  await applyCredentialsSeed(db);
  console.log('First run: applied seed.credentials.sql');
}

async function main() {
  const { db, app } = createServerRuntime(DB_PATH, {
    allowPasswordlessLogin: process.env.DEV_PASSWORDLESS_LOGIN !== '0',
  });
  await seedInitialCredentials(db);
  await startNodeServer({ app, port: PORT, name: 'dev', dbPath: DB_PATH });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
