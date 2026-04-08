import type { AppDatabase } from '../db/client.js';
import { applyPackageSeed } from '../db/index.js';
import { createApp } from '../app.js';

export function registerTestRoutes(
  app: ReturnType<typeof createApp>,
  db: AppDatabase,
  {
    testPort,
    dbPath,
  }: {
    testPort: number;
    dbPath: string;
  },
) {
  app.get('/api/__test__/health', (c) => {
    return c.json({ ok: true, port: testPort, dbPath });
  });

  app.post('/api/__test__/reset', (c) => {
    return db.exec(`
      DELETE FROM user_sessions;
      DELETE FROM sessions;
      DELETE FROM subscriptions;
      DELETE FROM members;
    `).then(async () => {
      await applyPackageSeed(db);
      return c.json({ ok: true });
    });
  });

  app.post('/api/__test__/member', async (c) => {
    const body = await c.req.json();
    const result = await db.run(
      `INSERT INTO members (role, full_name, email, phone, join_date, status)
       VALUES (?, ?, LOWER(?), ?, ?, ?)`,
      [
        body.role ?? 'member',
        body.full_name ?? 'Test User',
        body.email ?? 'test@test.com',
        body.phone ?? '1234567890',
        body.join_date ?? '2026-01-01',
        body.status ?? 'active',
      ],
    );
    return c.json({ id: result.lastRowId }, 201);
  });

  app.post('/api/__test__/subscription', async (c) => {
    const body = await c.req.json();
    const result = await db.run(
      `INSERT INTO subscriptions (member_id, package_id, start_date, end_date, total_sessions, attended_sessions, amount, owner_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.member_id,
        body.package_id,
        body.start_date,
        body.end_date,
        body.total_sessions,
        body.attended_sessions ?? 0,
        body.amount,
        body.owner_completed ?? 0,
      ],
    );
    return c.json({ id: result.lastRowId }, 201);
  });

  app.post('/api/__test__/session', async (c) => {
    const body = await c.req.json();
    const result = await db.run(
      `INSERT INTO sessions (member_id, subscription_id, date) VALUES (?, ?, ?)`,
      [body.member_id, body.subscription_id, body.date],
    );
    return c.json({ id: result.lastRowId }, 201);
  });

  app.post('/api/__test__/user-session', async (c) => {
    const body = await c.req.json();
    await db.run(
      `INSERT INTO user_sessions (id, member_id, expires_at) VALUES (?, ?, ?)`,
      [body.id, body.member_id, body.expires_at],
    );
    return c.json({ ok: true }, 201);
  });

  app.get('/api/__test__/user-session/:token', async (c) => {
    const token = c.req.param('token');
    const row = await db.get<{ id: string; expires_at: string }>(
      `SELECT id, expires_at FROM user_sessions WHERE id = ?`,
      [token],
    ) as
      | { id: string; expires_at: string }
      | undefined;

    if (!row) {
      return c.json({ exists: false }, 200);
    }

    return c.json({ exists: true, expires_at: row.expires_at });
  });

  app.get('/api/__test__/user-sessions/member/:memberId', async (c) => {
    const memberId = parseInt(c.req.param('memberId'), 10);
    const row = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM user_sessions WHERE member_id = ?`,
      [memberId],
    ) as {
      count: number;
    };
    return c.json({ count: row.count });
  });

  app.get('/api/__test__/subscription/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const row = await db.get(`SELECT * FROM subscriptions WHERE id = ?`, [id]);
    if (!row) {
      return c.json({ error: 'not found' }, 404);
    }

    return c.json(row);
  });
}
