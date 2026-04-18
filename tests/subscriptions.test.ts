import { describe, it, expect, beforeEach } from 'vitest';
import { api, reset, seedOwner, seedMember } from './setup.js';
import { loginAs, seedSubscription, getSubscription } from './helpers.js';
import { addDays, getIstDate } from '../src/lib/date.js';
import { computeEndDate } from '../src/lib/subscription.js';

describe('Subscriptions', () => {
  let ownerCookie: string;
  let memberId: number;
  let today: string;
  let tomorrow: string;

  beforeEach(async () => {
    today = getIstDate();
    tomorrow = addDays(today, 1);
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
        body: JSON.stringify({ package_id: 1, start_date: tomorrow }),
      });
      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({
        id: expect.any(Number),
        package_id: 1,
        service_type: '1:1 Personal Training',
        start_date: tomorrow,
        end_date: computeEndDate(tomorrow, 1),
        total_sessions: 8,
        attended_sessions: 0,
        remaining_sessions: 8,
        amount: 19900,
        owner_completed: false,
        lifecycle_state: expect.any(String),
      });
    });

    it('should reject non-object subscription payloads', async () => {
      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify(['not', 'an', 'object']),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Invalid JSON body');
    });

    it('should snapshot price and sessions from package', async () => {
      const body = await (await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 2, start_date: tomorrow }),
      })).json();
      expect(body.total_sessions).toBe(12);
      expect(body.amount).toBe(29500);
    });

    it('should allow owner to override amount for existing package subscription', async () => {
      const body = await (await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 2, start_date: tomorrow, amount: 31000 }),
      })).json();
      expect(body.amount).toBe(31000);
      expect(body.total_sessions).toBe(12);
    });

    it('should allow owner to override end_date for existing package subscription', async () => {
      const customEndDate = addDays(tomorrow, 45);
      const body = await (await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 2, start_date: tomorrow, end_date: customEndDate }),
      })).json();
      expect(body.end_date).toBe(customEndDate);
    });

    it('should create a custom package-backed subscription', async () => {
      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          custom_package: {
            service_type: 'Custom Plan',
            sessions: 15,
            start_date: tomorrow,
            end_date: addDays(tomorrow, 29),
            amount: 21000,
            consistency_window_days: 7,
            consistency_min_days: 3,
          },
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.service_type).toBe('Custom Plan');
      expect(body.total_sessions).toBe(15);
      expect(body.amount).toBe(21000);
    });

    it('should reject unsupported subscription fields', async () => {
      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: tomorrow, notes: 'typo' }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('Unsupported subscription field');
    });

    it('should reject mixed package and custom subscription payloads', async () => {
      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          package_id: 1,
          custom_package: {
            service_type: 'Custom Plan',
            sessions: 15,
            start_date: tomorrow,
            end_date: addDays(tomorrow, 29),
            amount: 21000,
            consistency_window_days: 7,
            consistency_min_days: 3,
          },
        }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('custom_package cannot be combined with package_id');
    });

    it('should reject root override fields with custom package subscriptions', async () => {
      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          start_date: tomorrow,
          custom_package: {
            service_type: 'Custom Plan',
            sessions: 15,
            start_date: tomorrow,
            end_date: addDays(tomorrow, 29),
            amount: 21000,
            consistency_window_days: 7,
            consistency_min_days: 3,
          },
        }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('custom_package cannot be combined with root start_date, end_date, or amount');
    });

    it('should reject unsupported custom package fields', async () => {
      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          custom_package: {
            service_type: 'Custom Plan',
            sessions: 15,
            start_date: tomorrow,
            end_date: addDays(tomorrow, 29),
            amount: 21000,
            consistency_window_days: 7,
            consistency_min_days: 3,
            weird_flag: true,
          },
        }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('Unsupported custom_package field');
    });

    it('should compute end_date correctly for 3-month package', async () => {
      const body = await (await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 3, start_date: tomorrow }),
      })).json();
      expect(body.end_date).toBe(computeEndDate(tomorrow, 3));
    });

    it('should allow past start_date when it is on or after join_date', async () => {
      expect((await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: addDays(today, -1) }),
      })).status).toBe(201);
    });

    it('should reject invalid start_date format', async () => {
      expect((await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: 'not-a-date' }),
      })).status).toBe(400);
    });

    it('should reject invalid end_date format for existing package', async () => {
      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: tomorrow, end_date: 'not-a-date' }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Invalid end_date format');
    });

    it('should reject invalid custom package numeric field types', async () => {
      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          custom_package: {
            service_type: 'Custom Plan',
            sessions: { count: 15 },
            start_date: tomorrow,
            end_date: addDays(tomorrow, 29),
            amount: 21000,
            consistency_window_days: 7,
            consistency_min_days: 3,
          },
        }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('custom_package.sessions must be a positive integer');
    });

    it('should reject non-object custom_package payloads', async () => {
      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ custom_package: 'custom plan' }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('custom_package must be an object');
    });

    it('should reject invalid amount field types', async () => {
      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: tomorrow, amount: { total: 21000 } }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('amount must be a positive integer');
    });

    it('should reject end_date before start_date for existing package', async () => {
      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: tomorrow, end_date: addDays(tomorrow, -1) }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('end_date cannot be before start_date');
    });

    it('should reject non-existent package_id', async () => {
      expect((await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 999, start_date: tomorrow }),
      })).status).toBe(404);
    });

    it('should reject non-existent member', async () => {
      expect((await api('/api/members/9999/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: tomorrow }),
      })).status).toBe(404);
    });

    it('should reject overlapping subscription (boundary inclusive)', async () => {
      const existingStart = tomorrow;
      const existingEnd = computeEndDate(existingStart, 1);
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: existingStart, end_date: existingEnd, total_sessions: 8, amount: 19900 });

      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: existingEnd }), // same as end_date
      });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toContain('overlap');
    });

    it('should allow non-overlapping subscription (start after existing ends)', async () => {
      const existingStart = tomorrow;
      const existingEnd = computeEndDate(existingStart, 1);
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: existingStart, end_date: existingEnd, total_sessions: 8, amount: 19900 });

      expect((await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: addDays(existingEnd, 1) }),
      })).status).toBe(201);
    });

    it('should allow same-day replacement after completion', async () => {
      const subId = await seedSubscription({ member_id: memberId, package_id: 1, start_date: today, end_date: computeEndDate(today, 1), total_sessions: 8, amount: 19900 });

      await api(`/api/subscriptions/${subId}/complete`, { method: 'POST', headers: { Cookie: ownerCookie } });

      expect((await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: today }),
      })).status).toBe(201);
    });

    it('should reject start_date before member join_date', async () => {
      const earlyDate = addDays('2026-01-15', -1);
      const res = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: earlyDate }),
      });

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('start_date cannot be before member join_date');
    });

    it('should reject subscription creation for archived member', async () => {
      const archivedId = await seedMember({ email: 'archived@test.com', phone: '1111111111', status: 'archived' });

      const res = await api(`/api/members/${archivedId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ package_id: 1, start_date: tomorrow }),
      });

      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('Cannot create subscription for an archived member');
      const detail = await (await api(`/api/members/${archivedId}`, { headers: { Cookie: ownerCookie } })).json();
      expect(detail.status).toBe('archived');
    });
  });

  // ─── GET /api/members/:id/subscriptions ───

  describe('GET /api/members/:id/subscriptions', () => {
    it('should return a flat subscription list for a member', async () => {
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: addDays(today, -7), end_date: addDays(today, 7), total_sessions: 8, amount: 19900 });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: addDays(today, 20), end_date: addDays(today, 50), total_sessions: 8, amount: 19900 });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: addDays(today, -50), end_date: addDays(today, -20), total_sessions: 8, amount: 19900 });

      const body = await (await api(`/api/members/${memberId}/subscriptions`, { headers: { Cookie: ownerCookie } })).json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(3);
      expect(body.filter((sub: any) => sub.lifecycle_state === 'completed').length).toBe(1);
      expect(body.filter((sub: any) => sub.lifecycle_state === 'active').length).toBe(1);
      expect(body.filter((sub: any) => sub.lifecycle_state === 'upcoming').length).toBe(1);
      expect(body.find((sub: any) => sub.lifecycle_state === 'active')).toMatchObject({
        can_mark_complete: true,
        can_view_attendance: true,
      });
      expect(body.find((sub: any) => sub.lifecycle_state === 'completed')).toMatchObject({
        can_mark_complete: false,
        can_view_attendance: true,
      });
    });
  });

  // ─── POST /api/subscriptions/:id/complete ───

  describe('POST /api/subscriptions/:id/complete', () => {
    it('should mark subscription completed and preserve counters', async () => {
      const subId = await seedSubscription({ member_id: memberId, package_id: 1, start_date: addDays(today, -7), end_date: addDays(today, 7), total_sessions: 8, attended_sessions: 3, amount: 19900 });

      const res = await api(`/api/subscriptions/${subId}/complete`, { method: 'POST', headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);

      const sub = await getSubscription(subId);
      expect(sub.owner_completed).toBe(1);
      expect(sub.attended_sessions).toBe(3);
      expect(sub.total_sessions).toBe(8);
    });

    it('should reject already completed subscription', async () => {
      const subId = await seedSubscription({ member_id: memberId, package_id: 1, start_date: addDays(today, -7), end_date: addDays(today, 7), total_sessions: 8, amount: 19900, owner_completed: 1 });

      const res = await api(`/api/subscriptions/${subId}/complete`, { method: 'POST', headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('Subscription is already completed');
    });

    it('should return 404 for non-existent subscription', async () => {
      expect((await api('/api/subscriptions/9999/complete', { method: 'POST', headers: { Cookie: ownerCookie } })).status).toBe(404);
    });
  });
});
