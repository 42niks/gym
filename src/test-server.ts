/**
 * Test server — dedicated process and DB for tests only.
 * Registers /api/__test__/* endpoints for DB control.
 * Must NEVER be imported in production code.
 */
import type { RunningNodeServer } from './server/node-server.js';
import { startNodeServer } from './server/node-server.js';
import { createServerRuntime } from './server/runtime.js';
import { registerTestRoutes } from './server/test-routes.js';

export const TEST_PORT = parseInt(process.env.TEST_PORT ?? '8002', 10);
export const TEST_DB_PATH = process.env.TEST_DB_PATH ?? './data/test.db';

let server: RunningNodeServer | null = null;

export async function startTestServer(): Promise<void> {
  if (server) {
    return;
  }

  const { db, app } = createServerRuntime(TEST_DB_PATH, { allowPasswordlessLogin: false });
  registerTestRoutes(app, db, { testPort: TEST_PORT, dbPath: TEST_DB_PATH });
  server = await startNodeServer({ app, port: TEST_PORT, name: 'test', dbPath: TEST_DB_PATH });
}

export function stopTestServer(): Promise<void> {
  if (!server) {
    return Promise.resolve();
  }

  const activeServer = server;
  server = null;
  return activeServer.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startTestServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });

  const shutdown = async () => {
    await stopTestServer();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
