import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';

let serverProcess: ChildProcess | null = null;
let tempDir: string | null = null;

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a test port')));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function waitForServer(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/__test__/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the child finishes booting or times out.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for test server at ${baseUrl}`);
}

async function stopChildProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill('SIGTERM');

  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ]);

  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));
  }
}

export async function setup() {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'base-gym-test-'));

  const testPort = String(await findFreePort());
  const testDbPath = path.join(tempDir, 'test.db');
  const baseUrl = `http://localhost:${testPort}`;

  process.env.TEST_BASE_URL = baseUrl;
  process.env.TEST_PORT = testPort;
  process.env.TEST_DB_PATH = testDbPath;

  serverProcess = spawn(
    process.execPath,
    [path.resolve('node_modules/tsx/dist/cli.mjs'), 'src/test-server.ts'],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_PORT: testPort,
        TEST_DB_PATH: testDbPath,
      },
    }
  );

  serverProcess.once('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error(`[tests] test server exited early with code=${code} signal=${signal}`);
    }
  });

  await waitForServer(baseUrl, 10_000);
}

export async function teardown() {
  if (serverProcess) {
    await stopChildProcess(serverProcess);
    serverProcess = null;
  }

  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
}
