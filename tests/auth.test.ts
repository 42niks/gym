import { describe, it, expect, beforeEach } from 'vitest';
import { api, reset, seedOwner, seedMember, seedUserSession, getUserSession, getUserSessionCount, utcDatetime } from './setup.js';
import { createApp } from '../src/app.js';
import { createLocalDatabase } from '../src/db/index.js';

describe('Auth', () => {
  beforeEach(async () => {
    await reset();
  });

  describe('Passwordless dev login', () => {
    it('should allow email-only login when explicitly enabled', async () => {
      const db = createLocalDatabase(':memory:');
      await db.run(
        `INSERT INTO members (role, full_name, email, phone, join_date, status)
         VALUES (?, ?, LOWER(?), ?, ?, ?)`,
        ['owner', 'Dev Owner', 'dev@base.gym', '9999999999', '2026-01-01', 'active'],
      );

      const app = createApp(db, { secureCookies: false, allowPasswordlessLogin: true });
      const res = await app.request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dev@base.gym' }),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        role: 'owner',
        email: 'dev@base.gym',
      });
    });

    it('should still require password when passwordless login is disabled', async () => {
      const db = createLocalDatabase(':memory:');
      await db.run(
        `INSERT INTO members (role, full_name, email, phone, join_date, status)
         VALUES (?, ?, LOWER(?), ?, ?, ?)`,
        ['owner', 'Prod Owner', 'prod@base.gym', '9999999999', '2026-01-01', 'active'],
      );

      const app = createApp(db, { secureCookies: false, allowPasswordlessLogin: false });
      const res = await app.request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'prod@base.gym' }),
      });

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Password is required');
    });
  });

  // ─── POST /api/auth/login ───

  describe('POST /api/auth/login', () => {
    it('should login with valid email and phone as password', async () => {
      await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
      const res = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@base.gym', password: '9999999999' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        id: expect.any(Number),
        role: 'owner',
        full_name: 'Test Owner',
        email: 'owner@base.gym',
      });
      const cookie = res.headers.get('set-cookie');
      expect(cookie).toBeTruthy();
      expect(cookie).toContain('session_id=');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Max-Age=864000');
    });

    it('should login case-insensitively', async () => {
      await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
      const res = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '  Owner@BASE.gym  ', password: '9999999999' }),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).email).toBe('owner@base.gym');
    });

    it('should trim password before comparison', async () => {
      await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
      const res = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@base.gym', password: '  9999999999  ' }),
      });
      expect(res.status).toBe(200);
    });

    it('should return 401 for wrong password', async () => {
      await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
      const res = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@base.gym', password: 'wrongpass' }),
      });
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('Invalid email or password');
    });

    it('should return 401 for non-existent email', async () => {
      const res = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nobody@test.com', password: 'anything' }),
      });
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('Invalid email or password');
    });

    it('should return 401 for archived member', async () => {
      await seedMember({ email: 'archived@test.com', phone: '1111111111', status: 'archived' });
      const res = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'archived@test.com', password: '1111111111' }),
      });
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('Invalid email or password');
    });

    it('should return 400 for missing email', async () => {
      const res = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: '9999999999' }),
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const res = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@base.gym' }),
      });
      expect(res.status).toBe(400);
    });

    it('should clean up expired sessions for the member on login', async () => {
      const ownerId = await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
      await seedUserSession({ id: 'old-token', member_id: ownerId, expires_at: utcDatetime(-86400) });

      await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@base.gym', password: '9999999999' }),
      });

      const session = await getUserSession('old-token');
      expect(session.exists).toBe(false);
    });

    it('should allow multiple concurrent sessions', async () => {
      await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
      const res1 = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@base.gym', password: '9999999999' }),
      });
      const res2 = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@base.gym', password: '9999999999' }),
      });
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const token1 = res1.headers.get('set-cookie')!.match(/session_id=([^;]+)/)![1];
      const token2 = res2.headers.get('set-cookie')!.match(/session_id=([^;]+)/)![1];
      expect(token1).not.toBe(token2);
    });

    it('should login member (non-owner)', async () => {
      await seedMember({ email: 'member@test.com', phone: '1234567890' });
      const res = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'member@test.com', password: '1234567890' }),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).role).toBe('member');
    });
  });

  // ─── POST /api/auth/logout ───

  describe('POST /api/auth/logout', () => {
    it('should logout and clear cookie', async () => {
      await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
      const loginRes = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@base.gym', password: '9999999999' }),
      });
      const token = loginRes.headers.get('set-cookie')!.match(/session_id=([^;]+)/)![1];

      const res = await api('/api/auth/logout', {
        method: 'POST',
        headers: { Cookie: `session_id=${token}` },
      });
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);

      const session = await getUserSession(token);
      expect(session.exists).toBe(false);

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('session_id=');
      expect(setCookie).toContain('Max-Age=0');
    });

    it('should be idempotent (no cookie)', async () => {
      const res = await api('/api/auth/logout', { method: 'POST' });
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
    });

    it('should be idempotent (invalid cookie)', async () => {
      const res = await api('/api/auth/logout', {
        method: 'POST',
        headers: { Cookie: 'session_id=nonexistent-token' },
      });
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
    });
  });

  // ─── GET /api/auth/me ───

  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated', async () => {
      await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
      const loginRes = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@base.gym', password: '9999999999' }),
      });
      const token = loginRes.headers.get('set-cookie')!.match(/session_id=([^;]+)/)![1];

      const res = await api('/api/auth/me', { headers: { Cookie: `session_id=${token}` } });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        id: expect.any(Number),
        role: 'owner',
        full_name: 'Test Owner',
        email: 'owner@base.gym',
      });
    });

    it('should return 401 when not authenticated', async () => {
      const res = await api('/api/auth/me');
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('Not authenticated');
    });

    it('should return 401 for expired session and delete it', async () => {
      const ownerId = await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
      await seedUserSession({ id: 'expired-tok', member_id: ownerId, expires_at: utcDatetime(-3600) });

      const res = await api('/api/auth/me', { headers: { Cookie: 'session_id=expired-tok' } });
      expect(res.status).toBe(401);

      const session = await getUserSession('expired-tok');
      expect(session.exists).toBe(false);
    });

    it('should return 401 for archived member session and delete it', async () => {
      const memberId = await seedMember({ email: 'archived@test.com', phone: '111', status: 'archived' });
      await seedUserSession({ id: 'arch-tok', member_id: memberId, expires_at: utcDatetime(864000) });

      const res = await api('/api/auth/me', { headers: { Cookie: 'session_id=arch-tok' } });
      expect(res.status).toBe(401);

      const session = await getUserSession('arch-tok');
      expect(session.exists).toBe(false);
    });

    it('should refresh session sliding expiry on each request', async () => {
      const ownerId = await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
      await seedUserSession({ id: 'slide-tok', member_id: ownerId, expires_at: utcDatetime(86400) });

      const res = await api('/api/auth/me', { headers: { Cookie: 'session_id=slide-tok' } });
      expect(res.status).toBe(200);

      const session = await getUserSession('slide-tok');
      expect(session.exists).toBe(true);
      const expiresAt = new Date(session.expires_at! + 'Z');
      const diffDays = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(9);
      expect(diffDays).toBeLessThanOrEqual(10.1);

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('Max-Age=864000');
    });
  });

  // ─── Auth middleware on protected routes ───

  describe('Protected route middleware', () => {
    it('should reject unauthenticated request to /api/packages', async () => {
      expect((await api('/api/packages')).status).toBe(401);
    });

    it('should allow owner request to /api/packages with 14 packages', async () => {
      await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
      const loginRes = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@base.gym', password: '9999999999' }),
      });
      const token = loginRes.headers.get('set-cookie')!.match(/session_id=([^;]+)/)![1];

      const res = await api('/api/packages', { headers: { Cookie: `session_id=${token}` } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(14);
    });

    it('should reject member request to /api/packages with 403', async () => {
      await seedMember({ email: 'member@test.com', phone: '1234567890' });
      const loginRes = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'member@test.com', password: '1234567890' }),
      });
      const token = loginRes.headers.get('set-cookie')!.match(/session_id=([^;]+)/)![1];

      const res = await api('/api/packages', { headers: { Cookie: `session_id=${token}` } });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Forbidden' });
    });

    it('should reject member from owner routes with 403', async () => {
      await seedMember({ email: 'member@test.com', phone: '1234567890' });
      const loginRes = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'member@test.com', password: '1234567890' }),
      });
      const token = loginRes.headers.get('set-cookie')!.match(/session_id=([^;]+)/)![1];

      expect((await api('/api/members', { headers: { Cookie: `session_id=${token}` } })).status).toBe(403);
    });

    it('should reject owner from member-only routes with 403', async () => {
      await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
      const loginRes = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@base.gym', password: '9999999999' }),
      });
      const token = loginRes.headers.get('set-cookie')!.match(/session_id=([^;]+)/)![1];

      expect((await api('/api/member/home', { headers: { Cookie: `session_id=${token}` } })).status).toBe(403);
    });
  });
});
