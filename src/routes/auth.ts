import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { findMemberByEmail } from '../repositories/members-repo.js';
import { createSession, deleteSession, deleteExpiredSessions } from '../repositories/user-sessions-repo.js';
import type { AppEnv } from '../app.js';

const SESSION_MAX_AGE = 864000; // 10 days in seconds

const auth = new Hono<AppEnv>();

auth.post('/login', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password.trim() : '';

  if (!email) {
    return c.json({ error: 'Email is required' }, 400);
  }
  if (!password) {
    return c.json({ error: 'Password is required' }, 400);
  }

  const db = c.get('db');
  const member = findMemberByEmail(db, email);

  if (!member || member.status === 'archived' || member.phone !== password) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Clean up expired sessions for this member
  deleteExpiredSessions(db, member.id);

  // Create new session
  const { token } = createSession(db, member.id);

  setCookie(c, 'session_id', token, {
    httpOnly: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    secure: false, // local dev
  });

  return c.json({
    id: member.id,
    role: member.role,
    full_name: member.full_name,
    email: member.email,
  });
});

auth.post('/logout', async (c) => {
  const token = getCookie(c, 'session_id');
  const db = c.get('db');

  if (token) {
    deleteSession(db, token);
  }

  setCookie(c, 'session_id', '', {
    httpOnly: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 0,
    secure: false,
  });

  return c.json({ ok: true });
});

auth.get('/me', async (c) => {
  // This route uses authMiddleware applied at the app level
  const user = c.get('user');
  const db = c.get('db');
  const member = findMemberByEmail(db, ''); // dummy — we need findById
  // Actually, let's get the member from the DB
  const row = db.prepare(
    `SELECT id, role, full_name, email FROM members WHERE id = ?`
  ).get(user.member_id) as any;

  if (!row) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  return c.json({
    id: row.id,
    role: row.role,
    full_name: row.full_name,
    email: row.email,
  });
});

export default auth;
