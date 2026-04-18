import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { AppDatabase } from './db/client.js';
import { findMemberByEmail, findMemberById } from './repositories/members-repo.js';
import { createSession, deleteSession, deleteExpiredSessions } from './repositories/user-sessions-repo.js';
import { authMiddleware } from './middleware/auth.js';
import { requireOwner } from './middleware/require-owner.js';
import { requireMember } from './middleware/require-member.js';
import {
  getMemberDetail, listMembers, createNewMember, updateExistingMember,
  archiveMemberById, unarchiveMemberById, listFormattedSubscriptions, getFormattedSubscriptionAttendance, toProfile, computeMemberEnrichment,
  normalizeMemberListView, MEMBER_LIST_VIEWS,
} from './services/member-service.js';
import { createNewSubscription, completeSubscription } from './services/subscription-service.js';
import { addAttendanceDate, markAttendance, removeAttendanceDate } from './services/attendance-service.js';
import { getDashboard } from './services/dashboard-service.js';
import { getIstDate } from './lib/date.js';
import { isValidYmdDate } from './lib/date.js';
import {
  createManagedPackage,
  listManagedPackages,
  updateManagedPackage,
} from './services/package-service.js';

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

function isValidPhone(phone: string): boolean {
  return /^\d{10}$/.test(phone);
}

function isJsonObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getUnsupportedFields(body: Record<string, any>, supportedFields: readonly string[]) {
  const supported = new Set(supportedFields);
  return Object.keys(body).filter((key) => !supported.has(key));
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
    if (!isJsonObject(body)) {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (!email) return c.json({ error: 'Email is required' }, 400);
    if (!isValidEmail(email)) return c.json({ error: 'Invalid email format' }, 400);
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

  app.get('/api/packages', authMiddleware, requireOwner, async (c) => {
    return c.json(await listManagedPackages(db));
  });

  app.post('/api/packages', authMiddleware, requireOwner, async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    if (!isJsonObject(body)) {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const result = await createManagedPackage(db, body);
    if ('error' in result) return c.json({ error: result.error }, result.status);
    return c.json(result.data, result.status);
  });

  app.patch('/api/packages/:id', authMiddleware, requireOwner, async (c) => {
    const id = parseInt(c.req.param('id') ?? '', 10);
    if (isNaN(id) || id <= 0) return c.json({ error: 'Invalid package id' }, 400);

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    if (!isJsonObject(body)) {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const result = await updateManagedPackage(db, id, body);
    if ('error' in result) return c.json({ error: result.error }, result.status);
    return c.json(result.data, result.status);
  });

  // ─── Member self routes ───

  app.get('/api/member/profile', authMiddleware, requireMember, async (c) => {
    const user = c.get('user');
    const member = await findMemberById(db, user.member_id);
    if (!member) return c.json({ error: 'Not found' }, 404);
    return c.json(toProfile(member));
  });

  app.get('/api/member/home', authMiddleware, requireMember, async (c) => {
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

  app.get('/api/member/subscription', authMiddleware, requireMember, async (c) => {
    const user = c.get('user');
    return c.json(await listFormattedSubscriptions(db, user.member_id));
  });

  app.get('/api/member/subscription/:id/attendance', authMiddleware, requireMember, async (c) => {
    const user = c.get('user');
    const member = await findMemberById(db, user.member_id);
    if (!member) return c.json({ error: 'Not found' }, 404);

    const id = parseInt(c.req.param('id') ?? '', 10);
    if (isNaN(id) || id <= 0) return c.json({ error: 'Invalid subscription id' }, 400);

    const attendance = await getFormattedSubscriptionAttendance(db, user.member_id, id);
    if (!attendance) return c.json({ error: 'Subscription not found' }, 404);

    return c.json(attendance);
  });

  app.post('/api/member/session', authMiddleware, requireMember, async (c) => {
    const user = c.get('user');
    const result = await markAttendance(db, user.member_id);
    if ('error' in result) return c.json({ error: result.error }, result.status);
    return c.json(result.data);
  });

  // ─── Owner: Members ───

  app.get('/api/members', authMiddleware, requireOwner, async (c) => {
    const view = c.req.query('view');
    const legacyStatus = c.req.query('status');

    if (view) {
      const normalizedView = normalizeMemberListView(view);
      if (!normalizedView) {
        return c.json({ error: `Invalid view parameter. Expected one of: ${MEMBER_LIST_VIEWS.join(', ')}` }, 400);
      }
      return c.json(await listMembers(db, normalizedView));
    }

    if (legacyStatus && legacyStatus !== 'active' && legacyStatus !== 'archived') {
      return c.json({ error: 'Invalid status parameter' }, 400);
    }

    return c.json(await listMembers(db, legacyStatus === 'archived' ? 'archived' : 'all'));
  });

  app.post('/api/members', authMiddleware, requireOwner, async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    if (!isJsonObject(body)) {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const joinDateRaw = typeof body.join_date === 'string' ? body.join_date.trim() : '';
    const joinDate = joinDateRaw || getIstDate();

    if (!fullName) return c.json({ error: 'full_name is required' }, 400);
    if (!email) return c.json({ error: 'email is required' }, 400);
    if (!isValidEmail(email)) return c.json({ error: 'Invalid email format' }, 400);
    if (!phone) return c.json({ error: 'phone is required' }, 400);
    if (!isValidPhone(phone)) return c.json({ error: 'phone must be exactly 10 digits' }, 400);
    if (!isValidYmdDate(joinDate)) return c.json({ error: 'Invalid join_date format' }, 400);
    if (fullName.length > 120) return c.json({ error: 'full_name exceeds 120 characters' }, 400);
    if (email.length > 254) return c.json({ error: 'email exceeds 254 characters' }, 400);

    try {
      const member = await createNewMember(db, { full_name: fullName, email, phone, join_date: joinDate });
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

    if (!isJsonObject(body)) {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const supportedFields = new Set(['full_name', 'phone']);
    const unsupportedFields = Object.keys(body).filter((key) => !supportedFields.has(key));
    if (unsupportedFields.length > 0) {
      return c.json({
        error: `Unsupported editable field${unsupportedFields.length > 1 ? 's' : ''}: ${unsupportedFields.join(', ')}`,
      }, 400);
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
      if (!isValidPhone(trimmed)) return c.json({ error: 'phone must be exactly 10 digits' }, 400);
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

  app.post('/api/members/:id/unarchive', authMiddleware, requireOwner, async (c) => {
    const id = parseInt(c.req.param('id') ?? '', 10);
    if (isNaN(id) || id <= 0) return c.json({ error: 'Invalid member id' }, 400);
    const result = await unarchiveMemberById(db, id);
    if (result.error) {
      const status = result.error === 'Member not found' ? 404 : 409;
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
    return c.json(await listFormattedSubscriptions(db, id));
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
    if (!isJsonObject(body)) {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const unsupportedRootFields = getUnsupportedFields(body, ['package_id', 'start_date', 'end_date', 'amount', 'custom_package']);
    if (unsupportedRootFields.length > 0) {
      return c.json({
        error: `Unsupported subscription field${unsupportedRootFields.length > 1 ? 's' : ''}: ${unsupportedRootFields.join(', ')}`,
      }, 400);
    }

    if (body.custom_package !== undefined && !isJsonObject(body.custom_package)) {
      return c.json({ error: 'custom_package must be an object' }, 400);
    }
    if (body.custom_package !== undefined && body.package_id !== undefined) {
      return c.json({ error: 'custom_package cannot be combined with package_id' }, 400);
    }
    if (body.custom_package !== undefined && (body.start_date !== undefined || body.end_date !== undefined || body.amount !== undefined)) {
      return c.json({ error: 'custom_package cannot be combined with root start_date, end_date, or amount' }, 400);
    }
    if (body.amount !== undefined && !(typeof body.amount === 'number' || typeof body.amount === 'string')) {
      return c.json({ error: 'amount must be a positive integer' }, 400);
    }
    if (body.start_date !== undefined && typeof body.start_date !== 'string') {
      return c.json({ error: 'Invalid start_date format' }, 400);
    }
    if (body.end_date !== undefined && typeof body.end_date !== 'string') {
      return c.json({ error: 'Invalid end_date format' }, 400);
    }
    if (isJsonObject(body.custom_package)) {
      const unsupportedCustomFields = getUnsupportedFields(body.custom_package, [
        'service_type',
        'sessions',
        'start_date',
        'end_date',
        'amount',
        'consistency_window_days',
        'consistency_min_days',
      ]);
      if (unsupportedCustomFields.length > 0) {
        return c.json({
          error: `Unsupported custom_package field${unsupportedCustomFields.length > 1 ? 's' : ''}: ${unsupportedCustomFields.join(', ')}`,
        }, 400);
      }
      if (body.custom_package.service_type !== undefined && typeof body.custom_package.service_type !== 'string') {
        return c.json({ error: 'custom_package.service_type is required' }, 400);
      }
      if (body.custom_package.start_date !== undefined && typeof body.custom_package.start_date !== 'string') {
        return c.json({ error: 'Invalid start_date format' }, 400);
      }
      if (body.custom_package.end_date !== undefined && typeof body.custom_package.end_date !== 'string') {
        return c.json({ error: 'Invalid end_date format' }, 400);
      }
      const customPositiveIntegerFields = [
        'sessions',
        'amount',
        'consistency_window_days',
        'consistency_min_days',
      ] as const;
      for (const field of customPositiveIntegerFields) {
        const value = body.custom_package[field];
        if (value !== undefined && !(typeof value === 'number' || typeof value === 'string')) {
          return c.json({ error: `custom_package.${field} must be a positive integer` }, 400);
        }
      }
    }

    const packageId = typeof body.package_id === 'number' ? body.package_id : parseInt(body.package_id, 10);
    const startDate = typeof body.start_date === 'string' ? body.start_date.trim() : undefined;
    const endDate = typeof body.end_date === 'string' ? body.end_date.trim() : undefined;
    const amountRaw = typeof body.amount === 'number' ? body.amount : parseInt(body.amount, 10);
    if (body.amount !== undefined && (!Number.isInteger(amountRaw) || amountRaw <= 0)) {
      return c.json({ error: 'amount must be a positive integer' }, 400);
    }
    const amount = amountRaw;
    const customPackage = isJsonObject(body.custom_package) ? {
      service_type: typeof body.custom_package.service_type === 'string' ? body.custom_package.service_type.trim() : '',
      sessions: typeof body.custom_package.sessions === 'number' ? body.custom_package.sessions : parseInt(body.custom_package.sessions, 10),
      start_date: typeof body.custom_package.start_date === 'string' ? body.custom_package.start_date.trim() : '',
      end_date: typeof body.custom_package.end_date === 'string' ? body.custom_package.end_date.trim() : '',
      amount: typeof body.custom_package.amount === 'number' ? body.custom_package.amount : parseInt(body.custom_package.amount, 10),
      consistency_window_days: typeof body.custom_package.consistency_window_days === 'number' ? body.custom_package.consistency_window_days : parseInt(body.custom_package.consistency_window_days, 10),
      consistency_min_days: typeof body.custom_package.consistency_min_days === 'number' ? body.custom_package.consistency_min_days : parseInt(body.custom_package.consistency_min_days, 10),
    } : undefined;
    const result = await createNewSubscription(db, {
      member_id: memberId,
      package_id: Number.isInteger(packageId) && packageId > 0 ? packageId : undefined,
      start_date: startDate,
      end_date: endDate,
      amount: Number.isInteger(amount) && amount > 0 ? amount : undefined,
      custom_package: customPackage,
    });
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

  app.get('/api/members/:memberId/subscriptions/:subscriptionId/attendance', authMiddleware, requireOwner, async (c) => {
    const memberId = parseInt(c.req.param('memberId') ?? '', 10);
    const subscriptionId = parseInt(c.req.param('subscriptionId') ?? '', 10);
    if (isNaN(memberId) || memberId <= 0) return c.json({ error: 'Invalid member id' }, 400);
    if (isNaN(subscriptionId) || subscriptionId <= 0) return c.json({ error: 'Invalid subscription id' }, 400);
    const attendance = await getFormattedSubscriptionAttendance(db, memberId, subscriptionId);
    if (!attendance) return c.json({ error: 'Subscription not found' }, 404);
    return c.json(attendance);
  });

  app.post('/api/members/:memberId/subscriptions/:subscriptionId/attendance', authMiddleware, requireOwner, async (c) => {
    const memberId = parseInt(c.req.param('memberId') ?? '', 10);
    const subscriptionId = parseInt(c.req.param('subscriptionId') ?? '', 10);
    if (isNaN(memberId) || memberId <= 0) return c.json({ error: 'Invalid member id' }, 400);
    if (isNaN(subscriptionId) || subscriptionId <= 0) return c.json({ error: 'Invalid subscription id' }, 400);
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    if (!isJsonObject(body)) {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    const date = typeof body.date === 'string' ? body.date.trim() : '';
    const result = await addAttendanceDate(db, memberId, subscriptionId, date);
    if ('error' in result) return c.json({ error: result.error }, result.status);
    return c.json(result.data, result.status);
  });

  app.delete('/api/members/:memberId/subscriptions/:subscriptionId/attendance/:date', authMiddleware, requireOwner, async (c) => {
    const memberId = parseInt(c.req.param('memberId') ?? '', 10);
    const subscriptionId = parseInt(c.req.param('subscriptionId') ?? '', 10);
    const date = c.req.param('date') ?? '';
    if (isNaN(memberId) || memberId <= 0) return c.json({ error: 'Invalid member id' }, 400);
    if (isNaN(subscriptionId) || subscriptionId <= 0) return c.json({ error: 'Invalid subscription id' }, 400);
    const result = await removeAttendanceDate(db, memberId, subscriptionId, date);
    if ('error' in result) return c.json({ error: result.error }, result.status);
    return c.json(result.data, result.status);
  });

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

  app.get('/api/owner/home', authMiddleware, requireOwner, async (c) => {
    return c.json(await getDashboard(db));
  });

  return app;
}
