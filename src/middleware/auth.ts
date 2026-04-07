import { Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { findSession, deleteSession, refreshSession } from '../repositories/user-sessions-repo.js';
import type { AppEnv } from '../app.js';

const SESSION_MAX_AGE = 864000; // 10 days in seconds

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const token = getCookie(c, 'session_id');
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const db = c.get('db');
  const session = findSession(db, token);

  if (!session) {
    clearSessionCookie(c);
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Check expiry
  const expiresAt = new Date(session.expires_at + 'Z');
  if (expiresAt <= new Date()) {
    deleteSession(db, token);
    clearSessionCookie(c);
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Check archived
  if (session.status === 'archived') {
    deleteSession(db, token);
    clearSessionCookie(c);
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Refresh sliding expiry
  refreshSession(db, token);
  setCookie(c, 'session_id', token, {
    httpOnly: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    secure: false, // local dev
  });

  c.set('user', {
    member_id: session.member_id,
    role: session.role,
    status: session.status,
  });

  await next();
}

function clearSessionCookie(c: Context) {
  setCookie(c, 'session_id', '', {
    httpOnly: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 0,
    secure: false,
  });
}
