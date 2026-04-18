import { describe, it, expect, beforeEach } from 'vitest';
import { api, reset, seedOwner, seedMember } from './setup.js';
import { loginAs, seedSubscription, getSubscription } from './helpers.js';

describe('Attendance', () => {
  let ownerCookie: string;
  let memberId: number;
  let memberCookie: string;

  beforeEach(async () => {
    await reset();
    await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
    memberId = await seedMember({ email: 'member@test.com', phone: '1234567890' });
    ownerCookie = await loginAs('owner@base.gym', '9999999999');
    memberCookie = await loginAs('member@test.com', '1234567890');
  });

  // ─── POST /api/member/session (member self) ───

  describe('POST /api/member/session', () => {
    it('should mark attendance when member has active subscription', async () => {
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });

      const res = await api('/api/member/session', { method: 'POST', headers: { Cookie: memberCookie } });
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
    });

    it('should increment attended_sessions after marking', async () => {
      const subId = await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });

      await api('/api/member/session', { method: 'POST', headers: { Cookie: memberCookie } });

      const sub = await getSubscription(subId);
      expect(sub.attended_sessions).toBe(1);
    });

    it('should reject when no active subscription', async () => {
      const res = await api('/api/member/session', { method: 'POST', headers: { Cookie: memberCookie } });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('No active subscription');
    });

    it('should reject double check-in on same day', async () => {
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });

      await api('/api/member/session', { method: 'POST', headers: { Cookie: memberCookie } });
      const res = await api('/api/member/session', { method: 'POST', headers: { Cookie: memberCookie } });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('Attendance already marked for today');
    });

    it('should reject when all sessions used up (subscription becomes completed)', async () => {
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, attended_sessions: 8, amount: 19900 });

      const res = await api('/api/member/session', { method: 'POST', headers: { Cookie: memberCookie } });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('No active subscription');
    });
  });

  // ─── POST /api/members/:id/sessions (owner marking for member) ───

  describe('POST /api/members/:id/sessions', () => {
    it('should allow owner to mark attendance for member', async () => {
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });

      const res = await api(`/api/members/${memberId}/sessions`, { method: 'POST', headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
    });

    it('should reject when member has no active subscription', async () => {
      const res = await api(`/api/members/${memberId}/sessions`, { method: 'POST', headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('No active subscription');
    });

    it('should reject for archived member', async () => {
      const archivedId = await seedMember({ email: 'archived@test.com', phone: '1111111111', status: 'archived' });
      const res = await api(`/api/members/${archivedId}/sessions`, { method: 'POST', headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Cannot mark attendance for an archived member');
    });

    it('should reject double attendance when owner and member both try same day', async () => {
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });

      await api('/api/member/session', { method: 'POST', headers: { Cookie: memberCookie } });
      const res = await api(`/api/members/${memberId}/sessions`, { method: 'POST', headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('Attendance already marked for today');
    });

    it('should return 404 for non-existent member', async () => {
      expect((await api('/api/members/9999/sessions', { method: 'POST', headers: { Cookie: ownerCookie } })).status).toBe(404);
    });
  });

  describe('Owner attendance dates CRUD', () => {
    it('allows owner to add and remove an attendance date for a subscription', async () => {
      const subId = await seedSubscription({
        member_id: memberId,
        package_id: 1,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        total_sessions: 8,
        amount: 19900,
      });

      const addRes = await api(`/api/members/${memberId}/subscriptions/${subId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ date: '2026-06-01' }),
      });
      expect(addRes.status).toBe(200);

      const getRes = await api(`/api/members/${memberId}/subscriptions/${subId}/attendance`, {
        headers: { Cookie: ownerCookie },
      });
      expect(getRes.status).toBe(200);
      expect((await getRes.json())).toMatchObject({
        attended_dates: expect.arrayContaining(['2026-06-01']),
        can_edit_dates: true,
        editable_start_date: '2026-01-01',
        editable_end_date: '2026-12-31',
        can_mark_complete: true,
      });

      const removeRes = await api(`/api/members/${memberId}/subscriptions/${subId}/attendance/2026-06-01`, {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      });
      expect(removeRes.status).toBe(200);
    });

    it('rejects non-object attendance create payloads', async () => {
      const subId = await seedSubscription({
        member_id: memberId,
        package_id: 1,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        total_sessions: 8,
        amount: 19900,
      });

      const res = await api(`/api/members/${memberId}/subscriptions/${subId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify(['2026-06-01']),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Invalid JSON body');
    });

    it('trims attendance dates before validation', async () => {
      const subId = await seedSubscription({
        member_id: memberId,
        package_id: 1,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        total_sessions: 8,
        amount: 19900,
      });

      const addRes = await api(`/api/members/${memberId}/subscriptions/${subId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ date: ' 2026-06-01 ' }),
      });
      expect(addRes.status).toBe(200);

      const getRes = await api(`/api/members/${memberId}/subscriptions/${subId}/attendance`, {
        headers: { Cookie: ownerCookie },
      });
      expect((await getRes.json()).attended_dates).toContain('2026-06-01');
    });

    it('resolves private custom packages for owner attendance metadata', async () => {
      const createRes = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          custom_package: {
            service_type: 'Private Attendance Plan',
            sessions: 10,
            start_date: '2026-04-01',
            end_date: '2026-04-30',
            amount: 15000,
            consistency_window_days: 7,
            consistency_min_days: 3,
          },
        }),
      });
      expect(createRes.status).toBe(201);
      const subscription = await createRes.json();

      const attendanceRes = await api(`/api/members/${memberId}/subscriptions/${subscription.id}/attendance`, {
        headers: { Cookie: ownerCookie },
      });
      expect(attendanceRes.status).toBe(200);
      expect(await attendanceRes.json()).toMatchObject({
        subscription: {
          id: subscription.id,
          service_type: 'Private Attendance Plan',
        },
        consistency_rule: {
          min_days: 3,
          window_days: 7,
        },
        can_edit_dates: true,
      });
    });
  });
});
