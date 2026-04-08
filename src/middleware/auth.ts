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
  const session = await findSession(db, token);
  const secureCookies = c.get('secureCookies');

  if (!session) {
    clearSessionCookie(c, secureCookies);
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Check expiry
  const expiresAt = new Date(session.expires_at + 'Z');
  if (expiresAt <= new Date()) {
    await deleteSession(db, token);
    clearSessionCookie(c, secureCookies);
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Check archived
  if (session.status === 'archived') {
    await deleteSession(db, token);
    clearSessionCookie(c, secureCookies);
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Refresh sliding expiry
  await refreshSession(db, token);
  setCookie(c, 'session_id', token, {
    httpOnly: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    secure: secureCookies,
  });

  c.set('user', {
    member_id: session.member_id,
    role: session.role,
    status: session.status,
  });

  await next();
}

function clearSessionCookie(c: Context, secureCookies: boolean) {
  setCookie(c, 'session_id', '', {
    httpOnly: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 0,
    secure: secureCookies,
  });
}
