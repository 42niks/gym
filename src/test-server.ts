/**
 * Test server — dedicated process and DB for tests only.
 * Registers /api/__test__/* endpoints for DB control.
 * Must NEVER be imported in production code.
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { ServerType } from '@hono/node-server';
import { createDatabase, seedPackages } from './db/index.js';
import { createApp } from './app.js';

export const TEST_PORT = parseInt(process.env.TEST_PORT ?? '8002', 10);
export const TEST_DB_PATH = process.env.TEST_DB_PATH ?? './data/test.db';

let server: ServerType | null = null;

export function startTestServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const db = createDatabase(TEST_DB_PATH);
      const app = createApp(db);

      // ─── Test-only endpoints ───────────────────────────────────────────────

      app.get('/api/__test__/health', (c) => {
        return c.json({ ok: true, port: TEST_PORT, dbPath: TEST_DB_PATH });
      });

      // Reset: wipe all data except packages, re-seed packages
      app.post('/api/__test__/reset', (c) => {
        db.exec(`
          DELETE FROM user_sessions;
          DELETE FROM sessions;
          DELETE FROM subscriptions;
          DELETE FROM members;
        `);
        seedPackages(db);
        return c.json({ ok: true });
      });

      // Seed a member (bypasses validation, owner or member)
      app.post('/api/__test__/member', async (c) => {
        const body = await c.req.json();
        const result = db.prepare(
          `INSERT INTO members (role, full_name, email, phone, join_date, status)
           VALUES (?, ?, LOWER(?), ?, ?, ?)`
        ).run(
          body.role ?? 'member',
          body.full_name ?? 'Test User',
          body.email ?? 'test@test.com',
          body.phone ?? '1234567890',
          body.join_date ?? '2026-01-01',
          body.status ?? 'active'
        );
        return c.json({ id: Number(result.lastInsertRowid) }, 201);
      });

      // Seed a subscription (bypasses business logic)
      app.post('/api/__test__/subscription', async (c) => {
        const body = await c.req.json();
        const result = db.prepare(
          `INSERT INTO subscriptions (member_id, package_id, start_date, end_date, total_sessions, attended_sessions, amount, owner_completed)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          body.member_id,
          body.package_id,
          body.start_date,
          body.end_date,
          body.total_sessions,
          body.attended_sessions ?? 0,
          body.amount,
          body.owner_completed ?? 0
        );
        return c.json({ id: Number(result.lastInsertRowid) }, 201);
      });

      // Seed an attendance session (bypasses business logic)
      app.post('/api/__test__/session', async (c) => {
        const body = await c.req.json();
        const result = db.prepare(
          `INSERT INTO sessions (member_id, subscription_id, date) VALUES (?, ?, ?)`
        ).run(body.member_id, body.subscription_id, body.date);
        return c.json({ id: Number(result.lastInsertRowid) }, 201);
      });

      // Seed a user_session with explicit token + expiry (for auth edge-case tests)
      app.post('/api/__test__/user-session', async (c) => {
        const body = await c.req.json();
        db.prepare(
          `INSERT INTO user_sessions (id, member_id, expires_at) VALUES (?, ?, ?)`
        ).run(body.id, body.member_id, body.expires_at);
        return c.json({ ok: true }, 201);
      });

      // Read a user_session by token
      app.get('/api/__test__/user-session/:token', (c) => {
        const token = c.req.param('token');
        const row = db.prepare(`SELECT id, expires_at FROM user_sessions WHERE id = ?`).get(token) as any;
        if (!row) return c.json({ exists: false }, 200);
        return c.json({ exists: true, expires_at: row.expires_at });
      });

      // Count user_sessions for a member
      app.get('/api/__test__/user-sessions/member/:memberId', (c) => {
        const memberId = parseInt(c.req.param('memberId'), 10);
        const row = db.prepare(`SELECT COUNT(*) as count FROM user_sessions WHERE member_id = ?`).get(memberId) as any;
        return c.json({ count: row.count });
      });

      // Read a subscription by id
      app.get('/api/__test__/subscription/:id', (c) => {
        const id = parseInt(c.req.param('id'), 10);
        const row = db.prepare(`SELECT * FROM subscriptions WHERE id = ?`).get(id);
        if (!row) return c.json({ error: 'not found' }, 404);
        return c.json(row);
      });

      // ─── Start ────────────────────────────────────────────────────────────

      const s = serve({ fetch: app.fetch, port: TEST_PORT }, () => {
        console.log(`BASE Gym (test) running on http://localhost:${TEST_PORT}  DB: ${TEST_DB_PATH}`);
        resolve();
      });
      server = s;
    } catch (err) {
      reject(err);
    }
  });
}

export function stopTestServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => {
      server = null;
      resolve();
    });
  });
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
