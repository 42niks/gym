import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';

export interface NodeFetchApp {
  fetch: (request: Request, env?: any, executionCtx?: any) => Response | Promise<Response>;
}

export interface RunningNodeServer {
  server: ServerType;
  close: () => Promise<void>;
}

function toListenError(error: unknown, port: number): Error {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'EADDRINUSE'
  ) {
    return new Error(`Port ${port} is already in use.`);
  }

  return error instanceof Error ? error : new Error(`Failed to start server on port ${port}`);
}

export function closeNodeServer(server: ServerType): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export function startNodeServer({
  app,
  port,
  name,
  dbPath,
}: {
  app: NodeFetchApp;
  port: number;
  name: string;
  dbPath: string;
}): Promise<RunningNodeServer> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const server = serve({ fetch: app.fetch, port }, () => {
      if (settled) {
        return;
      }

      settled = true;
      console.log(`BASE Gym (${name}) running on http://localhost:${port}  DB: ${dbPath}`);
      resolve({
        server,
        close: () => closeNodeServer(server),
      });
    });

    server.once('error', (error) => {
      if (settled) {
        console.error(error);
        return;
      }

      settled = true;
      reject(toListenError(error, port));
    });
  });
}
