import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { AppDatabase } from './db/client.js';
import { findMemberByEmail, findMemberById } from './repositories/members-repo.js';
import { createSession, deleteSession, deleteExpiredSessions } from './repositories/user-sessions-repo.js';
import { listPackages } from './repositories/packages-repo.js';
import { authMiddleware } from './middleware/auth.js';
import { requireOwner } from './middleware/require-owner.js';
import { requireMember } from './middleware/require-member.js';
import {
  getMemberDetail, listMembers, createNewMember, updateExistingMember,
  archiveMemberById, getGroupedSubscriptions, toProfile, computeMemberEnrichment,
} from './services/member-service.js';
import { createNewSubscription, completeSubscription } from './services/subscription-service.js';
import { markAttendance } from './services/attendance-service.js';
import { getDashboard } from './services/dashboard-service.js';
import { getIstDate } from './lib/date.js';

const SESSION_MAX_AGE = 864000;

export type AppEnv = {
  Bindings: {
    DB: D1Database;
    ASSETS?: Fetcher;
  };
  Variables: {
    db: AppDatabase;
    secureCookies: boolean;
    user: {
      member_id: number;
      role: string;
      status: string;
    };
  };
};

interface CreateAppOptions {
  secureCookies: boolean;
  allowPasswordlessLogin?: boolean;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function createApp(
  db: AppDatabase,
  { secureCookies, allowPasswordlessLogin = false }: CreateAppOptions,
) {
  const app = new Hono<AppEnv>();

  // Inject DB
  app.use('*', async (c, next) => {
    c.set('db', db);
    c.set('secureCookies', secureCookies);
    await next();
  });

  // ─── Public auth routes ───

  app.post('/api/auth/login', async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (!email) return c.json({ error: 'Email is required' }, 400);
    if (!password && !allowPasswordlessLogin) return c.json({ error: 'Password is required' }, 400);

    const member = await findMemberByEmail(db, email);
    const passwordMatches = allowPasswordlessLogin
      ? password.length === 0 || member?.phone === password
      : member?.phone === password;

    if (!member || member.status === 'archived' || !passwordMatches) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    await deleteExpiredSessions(db, member.id);
    const { token } = await createSession(db, member.id);

    setCookie(c, 'session_id', token, {
      httpOnly: true, sameSite: 'Strict', path: '/', maxAge: SESSION_MAX_AGE, secure: secureCookies,
    });

    return c.json({ id: member.id, role: member.role, full_name: member.full_name, email: member.email });
  });

  app.post('/api/auth/logout', async (c) => {
    const token = getCookie(c, 'session_id');
    if (token) await deleteSession(db, token);
    setCookie(c, 'session_id', '', {
      httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 0, secure: secureCookies,
    });
    return c.json({ ok: true });
  });

  app.get('/api/auth/me', authMiddleware, async (c) => {
    const user = c.get('user');
    const row = await findMemberById(db, user.member_id);
    if (!row) return c.json({ error: 'Not authenticated' }, 401);
    return c.json({ id: row.id, role: row.role, full_name: row.full_name, email: row.email });
  });

  // ─── Packages ───

  app.get('/api/packages', authMiddleware, async (c) => {
    return c.json(await listPackages(db));
  });

  // ─── Member self routes ───

  app.get('/api/me/profile', authMiddleware, requireMember, async (c) => {
    const user = c.get('user');
    const member = await findMemberById(db, user.member_id);
    if (!member) return c.json({ error: 'Not found' }, 404);
    return c.json(toProfile(member));
  });

  app.get('/api/me/home', authMiddleware, requireMember, async (c) => {
    const user = c.get('user');
    const member = await findMemberById(db, user.member_id);
    if (!member) return c.json({ error: 'Not found' }, 404);

    const today = getIstDate();
    const enrichment = await computeMemberEnrichment(db, member.id, today);

    return c.json({
      member: toProfile(member),
      ...enrichment,
    });
  });

  app.get('/api/me/subscriptions', authMiddleware, requireMember, async (c) => {
    const user = c.get('user');
    return c.json(await getGroupedSubscriptions(db, user.member_id));
  });

  app.post('/api/me/sessions', authMiddleware, requireMember, async (c) => {
    const user = c.get('user');
    const result = await markAttendance(db, user.member_id);
    if ('error' in result) return c.json({ error: result.error }, result.status);
    return c.json(result.data);
  });

  // ─── Owner: Members ───

  app.get('/api/members', authMiddleware, requireOwner, async (c) => {
    const status = c.req.query('status') ?? 'active';
    if (status !== 'active' && status !== 'archived') {
      return c.json({ error: 'Invalid status parameter' }, 400);
    }
    return c.json(await listMembers(db, status));
  });

  app.post('/api/members', authMiddleware, requireOwner, async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

    if (!fullName) return c.json({ error: 'full_name is required' }, 400);
    if (!email) return c.json({ error: 'email is required' }, 400);
    if (!isValidEmail(email)) return c.json({ error: 'Invalid email format' }, 400);
    if (!phone) return c.json({ error: 'phone is required' }, 400);
    if (fullName.length > 120) return c.json({ error: 'full_name exceeds 120 characters' }, 400);
    if (email.length > 254) return c.json({ error: 'email exceeds 254 characters' }, 400);
    if (phone.length > 32) return c.json({ error: 'phone exceeds 32 characters' }, 400);

    try {
      const member = await createNewMember(db, { full_name: fullName, email, phone });
      return c.json(member, 201);
    } catch (e: any) {
      if (e.message?.includes('UNIQUE constraint failed')) {
        return c.json({ error: 'A member with this email already exists' }, 409);
      }
      throw e;
    }
  });

  app.get('/api/members/:id', authMiddleware, requireOwner, async (c) => {
    const id = parseInt(c.req.param('id') ?? '', 10);
    if (isNaN(id) || id <= 0) return c.json({ error: 'Invalid member id' }, 400);
    const detail = await getMemberDetail(db, id);
    if (!detail) return c.json({ error: 'Member not found' }, 404);
    return c.json(detail);
  });

  app.patch('/api/members/:id', authMiddleware, requireOwner, async (c) => {
    const id = parseInt(c.req.param('id') ?? '', 10);
    if (isNaN(id) || id <= 0) return c.json({ error: 'Invalid member id' }, 400);

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const updates: { full_name?: string; phone?: string } = {};
    if (body.full_name !== undefined) {
      const trimmed = typeof body.full_name === 'string' ? body.full_name.trim() : '';
      if (!trimmed) return c.json({ error: 'full_name cannot be empty' }, 400);
      if (trimmed.length > 120) return c.json({ error: 'full_name exceeds 120 characters' }, 400);
      updates.full_name = trimmed;
    }
    if (body.phone !== undefined) {
      const trimmed = typeof body.phone === 'string' ? body.phone.trim() : '';
      if (!trimmed) return c.json({ error: 'phone cannot be empty' }, 400);
      if (trimmed.length > 32) return c.json({ error: 'phone exceeds 32 characters' }, 400);
      updates.phone = trimmed;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No editable field provided' }, 400);
    }

    const existing = await findMemberById(db, id);
    if (!existing) return c.json({ error: 'Member not found' }, 404);

    const member = await updateExistingMember(db, id, updates);
    return c.json(member);
  });

  app.post('/api/members/:id/archive', authMiddleware, requireOwner, async (c) => {
    const id = parseInt(c.req.param('id') ?? '', 10);
    if (isNaN(id) || id <= 0) return c.json({ error: 'Invalid member id' }, 400);
    const result = await archiveMemberById(db, id);
    if (result.error) {
      const status = result.error === 'Member not found' ? 404 :  409;
      return c.json({ error: result.error }, status);
    }
    return c.json({ ok: true });
  });

  // ─── Owner: Subscriptions ───

  app.get('/api/members/:id/subscriptions', authMiddleware, requireOwner, async (c) => {
    const id = parseInt(c.req.param('id') ?? '', 10);
    if (isNaN(id) || id <= 0) return c.json({ error: 'Invalid member id' }, 400);
    const member = await findMemberById(db, id);
    if (!member) return c.json({ error: 'Member not found' }, 404);
    return c.json(await getGroupedSubscriptions(db, id));
  });

  app.post('/api/members/:id/subscriptions', authMiddleware, requireOwner, async (c) => {
    const memberId = parseInt(c.req.param('id') ?? '', 10);
    if (isNaN(memberId) || memberId <= 0) return c.json({ error: 'Invalid member id' }, 400);

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const packageId = typeof body.package_id === 'number' ? body.package_id : parseInt(body.package_id, 10);
    const startDate = typeof body.start_date === 'string' ? body.start_date : '';

    if (!packageId || isNaN(packageId) || packageId <= 0) {
      return c.json({ error: 'package_id is required' }, 400);
    }
    if (!startDate) return c.json({ error: 'start_date is required' }, 400);

    const result = await createNewSubscription(db, { member_id: memberId, package_id: packageId, start_date: startDate });
    if ('error' in result) return c.json({ error: result.error }, result.status);
    return c.json(result.data, result.status);
  });

  app.post('/api/subscriptions/:id/complete', authMiddleware, requireOwner, async (c) => {
    const id = parseInt(c.req.param('id') ?? '', 10);
    if (isNaN(id) || id <= 0) return c.json({ error: 'Invalid subscription id' }, 400);
    const result = await completeSubscription(db, id);
    if ('error' in result) return c.json({ error: result.error }, result.status);
    return c.json(result.data);
  });

  // ─── Owner: Attendance ───

  app.post('/api/members/:id/sessions', authMiddleware, requireOwner, async (c) => {
    const memberId = parseInt(c.req.param('id') ?? '', 10);
    if (isNaN(memberId) || memberId <= 0) return c.json({ error: 'Invalid member id' }, 400);

    const member = await findMemberById(db, memberId);
    if (!member) return c.json({ error: 'Member not found' }, 404);

    const result = await markAttendance(db, memberId);
    if ('error' in result) return c.json({ error: result.error }, result.status);
    return c.json(result.data);
  });

  // ─── Owner: Dashboard ───

  app.get('/api/owner/dashboard', authMiddleware, requireOwner, async (c) => {
    return c.json(await getDashboard(db));
  });

  return app;
}
