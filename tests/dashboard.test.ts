import { describe, it, expect, beforeEach } from 'vitest';
import { api, reset, seedOwner, seedMember } from './setup.js';
import { loginAs, seedSubscription, seedSession } from './helpers.js';
import { getIstDate } from '../src/lib/date.js';

describe('Owner Dashboard', () => {
  let ownerCookie: string;

  beforeEach(async () => {
    await reset();
    await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
    ownerCookie = await loginAs('owner@base.gym', '9999999999');
  });

  describe('GET /api/owner/dashboard', () => {
    it('should return attendance summary and dashboard sections', async () => {
      const body = await (await api('/api/owner/dashboard', { headers: { Cookie: ownerCookie } })).json();
      expect(body).toHaveProperty('attendance_summary');
      expect(body).toHaveProperty('renewal_no_active');
      expect(body).toHaveProperty('renewal_nearing_end');
      expect(body).toHaveProperty('checked_in_today');
      expect(body).toHaveProperty('active_members');
      expect(body).toHaveProperty('archived_members');
    });

    it('should show member with no subscription in renewal_no_active', async () => {
      await seedMember({ email: 'a@test.com', full_name: 'Alpha', phone: '111' });

      const body = await (await api('/api/owner/dashboard', { headers: { Cookie: ownerCookie } })).json();
      const found = body.renewal_no_active.find((m: any) => m.full_name === 'Alpha');
      expect(found).toBeTruthy();
      expect(found.renewal.kind).toBe('no_active');
    });

    it('should show member nearing end in renewal_nearing_end', async () => {
      const memberId = await seedMember({ email: 'a@test.com', full_name: 'Alpha', phone: '111' });
      // 6 attended out of 8 => remaining = 2 < 3 => nearing end
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, attended_sessions: 6, amount: 19900 });

      const body = await (await api('/api/owner/dashboard', { headers: { Cookie: ownerCookie } })).json();
      const found = body.renewal_nearing_end.find((m: any) => m.full_name === 'Alpha');
      expect(found).toBeTruthy();
      expect(found.renewal.kind).toBe('ends_soon');
    });

    it('should show member who checked in today', async () => {
      const today = getIstDate();
      const memberId = await seedMember({ email: 'a@test.com', full_name: 'Alpha', phone: '111' });
      const subId = await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, attended_sessions: 1, amount: 19900 });
      await seedSession({ member_id: memberId, subscription_id: subId, date: today });

      const body = await (await api('/api/owner/dashboard', { headers: { Cookie: ownerCookie } })).json();
      const found = body.checked_in_today.find((m: any) => m.full_name === 'Alpha');
      expect(found).toBeTruthy();
      expect(found.marked_attendance_today).toBe(true);
      expect(body.attendance_summary.present_today).toBe(1);
      expect(body.attendance_summary.delta).toBe(1);
    });

    it('should show active members with subscription and consistency', async () => {
      const memberId = await seedMember({ email: 'a@test.com', full_name: 'Alpha', phone: '111' });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });

      const body = await (await api('/api/owner/dashboard', { headers: { Cookie: ownerCookie } })).json();
      const found = body.active_members.find((m: any) => m.full_name === 'Alpha');
      expect(found).toBeTruthy();
      expect(found).toHaveProperty('active_subscription');
      expect(found).toHaveProperty('consistency');
      expect(found).toHaveProperty('marked_attendance_today');
    });

    it('should show archived members', async () => {
      await seedMember({ email: 'a@test.com', full_name: 'Archived Guy', phone: '111', status: 'archived' });

      const body = await (await api('/api/owner/dashboard', { headers: { Cookie: ownerCookie } })).json();
      const found = body.archived_members.find((m: any) => m.full_name === 'Archived Guy');
      expect(found).toBeTruthy();
    });

    it('should sort active_members alphabetically', async () => {
      await seedMember({ email: 'z@test.com', full_name: 'Zara', phone: '111' });
      await seedMember({ email: 'a@test.com', full_name: 'Alpha', phone: '222' });

      const body = await (await api('/api/owner/dashboard', { headers: { Cookie: ownerCookie } })).json();
      const names = body.active_members.map((m: any) => m.full_name);
      expect(names).toEqual([...names].sort());
    });
  });
});
