import { describe, it, expect, beforeEach } from 'vitest';
import { api, reset, seedOwner, seedMember } from './setup.js';
import { loginAs, seedSubscription, getSubscription } from './helpers.js';

describe('Subscriptions', () => {
  let ownerCookie: string;
  let memberId: number;

  beforeEach(async () => {
    await reset();
    await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
    memberId = await seedMember({ email: 'member@test.com', phone: '1234567890' });
    ownerCookie = await loginAs('owner@base.gym', '9999999999');
  });

  // ─── POST /api/members/:id/subscriptions ───

  describe('POST /api/members/:id/subscriptions', () => {
    it('should create a subscription', async () => {
      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: '2026-04-07' }),
      });
      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({
        id: expect.any(Number),
        package_id: 1,
        service_type: '1:1 Personal Training',
        start_date: '2026-04-07',
        end_date: '2026-05-06',
        total_sessions: 8,
        attended_sessions: 0,
        remaining_sessions: 8,
        amount: 19900,
        owner_completed: false,
        lifecycle_state: expect.any(String),
      });
    });

    it('should snapshot price and sessions from package', async () => {
      const body = await (await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 2, start_date: '2026-04-07' }),
      })).json();
      expect(body.total_sessions).toBe(12);
      expect(body.amount).toBe(29500);
    });

    it('should compute end_date correctly for 3-month package', async () => {
      const body = await (await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 3, start_date: '2026-04-07' }),
      })).json();
      expect(body.end_date).toBe('2026-07-06');
    });

    it('should reject past start_date', async () => {
      expect((await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: '2020-01-01' }),
      })).status).toBe(400);
    });

    it('should reject invalid start_date format', async () => {
      expect((await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: 'not-a-date' }),
      })).status).toBe(400);
    });

    it('should reject non-existent package_id', async () => {
      expect((await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 999, start_date: '2026-04-07' }),
      })).status).toBe(404);
    });

    it('should reject non-existent member', async () => {
      expect((await api('/api/members/9999/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: '2026-04-07' }),
      })).status).toBe(404);
    });

    it('should reject overlapping subscription (boundary inclusive)', async () => {
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-04-07', end_date: '2026-05-06', total_sessions: 8, amount: 19900 });

      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: '2026-05-06' }), // same as end_date
      });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toContain('overlap');
    });

    it('should allow non-overlapping subscription (start after existing ends)', async () => {
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-04-07', end_date: '2026-05-06', total_sessions: 8, amount: 19900 });

      expect((await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: '2026-05-07' }),
      })).status).toBe(201);
    });

    it('should allow same-day replacement after completion', async () => {
      const subId = await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-04-07', end_date: '2026-05-06', total_sessions: 8, amount: 19900 });

      await api(`/api/subscriptions/${subId}/complete`, { method: 'POST', headers: { Cookie: ownerCookie } });

      expect((await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: '2026-04-07' }),
      })).status).toBe(201);
    });

    it('should unarchive member when creating subscription', async () => {
      const archivedId = await seedMember({ email: 'archived@test.com', phone: '111', status: 'archived' });

      expect((await api(`/api/members/${archivedId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: '2026-04-07' }),
      })).status).toBe(201);

      const detail = await (await api(`/api/members/${archivedId}`, { headers: { Cookie: ownerCookie } })).json();
      expect(detail.status).toBe('active');
    });
  });

  // ─── GET /api/members/:id/subscriptions ───

  describe('GET /api/members/:id/subscriptions', () => {
    it('should return grouped subscriptions for a member', async () => {
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2027-01-01', end_date: '2027-01-31', total_sessions: 8, amount: 19900 });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2025-01-01', end_date: '2025-01-31', total_sessions: 8, amount: 19900 });

      const body = await (await api(`/api/members/${memberId}/subscriptions`, { headers: { Cookie: ownerCookie } })).json();
      expect(body.completed_and_active.length).toBe(2);
      expect(body.upcoming.length).toBe(1);
    });
  });

  // ─── POST /api/subscriptions/:id/complete ───

  describe('POST /api/subscriptions/:id/complete', () => {
    it('should mark subscription completed and preserve counters', async () => {
      const subId = await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, attended_sessions: 3, amount: 19900 });

      const res = await api(`/api/subscriptions/${subId}/complete`, { method: 'POST', headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);

      const sub = await getSubscription(subId);
      expect(sub.owner_completed).toBe(1);
      expect(sub.attended_sessions).toBe(3);
      expect(sub.total_sessions).toBe(8);
    });

    it('should reject already completed subscription', async () => {
      const subId = await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900, owner_completed: 1 });

      const res = await api(`/api/subscriptions/${subId}/complete`, { method: 'POST', headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('Subscription is already completed');
    });

    it('should return 404 for non-existent subscription', async () => {
      expect((await api('/api/subscriptions/9999/complete', { method: 'POST', headers: { Cookie: ownerCookie } })).status).toBe(404);
    });
  });
});
