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

  // ─── POST /api/me/sessions (member self) ───

  describe('POST /api/me/sessions', () => {
    it('should mark attendance when member has active subscription', async () => {
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });

      const res = await api('/api/me/sessions', { method: 'POST', headers: { Cookie: memberCookie } });
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
    });

    it('should increment attended_sessions after marking', async () => {
      const subId = await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });

      await api('/api/me/sessions', { method: 'POST', headers: { Cookie: memberCookie } });

      const sub = await getSubscription(subId);
      expect(sub.attended_sessions).toBe(1);
    });

    it('should reject when no active subscription', async () => {
      const res = await api('/api/me/sessions', { method: 'POST', headers: { Cookie: memberCookie } });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('No active subscription');
    });

    it('should reject double check-in on same day', async () => {
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });

      await api('/api/me/sessions', { method: 'POST', headers: { Cookie: memberCookie } });
      const res = await api('/api/me/sessions', { method: 'POST', headers: { Cookie: memberCookie } });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('Attendance already marked for today');
    });

    it('should reject when all sessions used up (subscription becomes completed)', async () => {
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, attended_sessions: 8, amount: 19900 });

      const res = await api('/api/me/sessions', { method: 'POST', headers: { Cookie: memberCookie } });
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
      const archivedId = await seedMember({ email: 'archived@test.com', phone: '111', status: 'archived' });
      const res = await api(`/api/members/${archivedId}/sessions`, { method: 'POST', headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Cannot mark attendance for an archived member');
    });

    it('should reject double attendance when owner and member both try same day', async () => {
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });

      await api('/api/me/sessions', { method: 'POST', headers: { Cookie: memberCookie } });
      const res = await api(`/api/members/${memberId}/sessions`, { method: 'POST', headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('Attendance already marked for today');
    });

    it('should return 404 for non-existent member', async () => {
      expect((await api('/api/members/9999/sessions', { method: 'POST', headers: { Cookie: ownerCookie } })).status).toBe(404);
    });
  });
});
