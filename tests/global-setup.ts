import { startTestServer, stopTestServer } from '../src/test-server.js';

export async function setup() {
  await startTestServer();
}

export async function teardown() {
  await stopTestServer();
}
