import { describe, it, expect, beforeEach } from 'vitest';
import { api, reset, seedOwner, seedMember } from './setup.js';
import { loginAs, seedSubscription, seedSession } from './helpers.js';
import { addDays, getIstDate } from '../src/lib/date.js';
import { computeEndDate } from '../src/lib/subscription.js';

async function seedMemberWithSubscriptionAndAttendance(input: {
  full_name: string;
  email: string;
  phone: string;
  package_id: number;
  start_date: string;
  end_date: string;
  total_sessions: number;
  amount: number;
  attendance_dates: string[];
}) {
  const memberId = await seedMember({
    email: input.email,
    full_name: input.full_name,
    phone: input.phone,
  });

  const subscriptionId = await seedSubscription({
    member_id: memberId,
    package_id: input.package_id,
    start_date: input.start_date,
    end_date: input.end_date,
    total_sessions: input.total_sessions,
    attended_sessions: input.attendance_dates.length,
    amount: input.amount,
  });

  for (const date of input.attendance_dates) {
    await seedSession({ member_id: memberId, subscription_id: subscriptionId, date });
  }

  return { memberId, subscriptionId };
}

describe('Owner Home', () => {
  let ownerCookie: string;

  beforeEach(async () => {
    await reset();
    await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
    ownerCookie = await loginAs('owner@base.gym', '9999999999');
  });

  describe('GET /api/owner/home', () => {
    it('should return attendance summary and dashboard sections', async () => {
      const body = await (await api('/api/owner/home', { headers: { Cookie: ownerCookie } })).json();
      expect(body).toHaveProperty('attendance_summary');
      expect(body).toHaveProperty('consistency_pipeline');
      expect(body).toHaveProperty('at_risk');
      expect(body).toHaveProperty('renewal_due_count');
      expect(body).toHaveProperty('no_active_plan_count');
      expect(body).toHaveProperty('renewal_no_active');
      expect(body).toHaveProperty('renewal_nearing_end');
      expect(body).toHaveProperty('checked_in_today');
      expect(body).toHaveProperty('active_members');
      expect(body).toHaveProperty('archived_members');
    });

    it('should show member with no subscription in renewal_no_active', async () => {
      await seedMember({ email: 'a@test.com', full_name: 'Alpha', phone: '1111111111' });

      const body = await (await api('/api/owner/home', { headers: { Cookie: ownerCookie } })).json();
      const found = body.renewal_no_active.find((m: any) => m.full_name === 'Alpha');
      expect(found).toBeTruthy();
      expect(found.renewal.kind).toBe('no_active');
    });

    it('should show member nearing end in renewal_nearing_end', async () => {
      const memberId = await seedMember({ email: 'a@test.com', full_name: 'Alpha', phone: '1111111111' });
      // 6 attended out of 8 => remaining = 2 < 3 => nearing end
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, attended_sessions: 6, amount: 19900 });

      const body = await (await api('/api/owner/home', { headers: { Cookie: ownerCookie } })).json();
      const found = body.renewal_nearing_end.find((m: any) => m.full_name === 'Alpha');
      expect(found).toBeTruthy();
      expect(found.renewal.kind).toBe('ends_soon');
    });

    it('should show member who checked in today', async () => {
      const today = getIstDate();
      const memberId = await seedMember({ email: 'a@test.com', full_name: 'Alpha', phone: '1111111111' });
      const subId = await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, attended_sessions: 1, amount: 19900 });
      await seedSession({ member_id: memberId, subscription_id: subId, date: today });

      const body = await (await api('/api/owner/home', { headers: { Cookie: ownerCookie } })).json();
      const found = body.checked_in_today.find((m: any) => m.full_name === 'Alpha');
      expect(found).toBeTruthy();
      expect(found.marked_attendance_today).toBe(true);
      expect(body.attendance_summary.present_today).toBe(1);
      expect(body.attendance_summary.delta).toBe(1);
    });

    it('should show active members with subscription and consistency', async () => {
      const memberId = await seedMember({ email: 'a@test.com', full_name: 'Alpha', phone: '1111111111' });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });

      const body = await (await api('/api/owner/home', { headers: { Cookie: ownerCookie } })).json();
      const found = body.active_members.find((m: any) => m.full_name === 'Alpha');
      expect(found).toBeTruthy();
      expect(found).toHaveProperty('active_subscription');
      expect(found).toHaveProperty('consistency');
      expect(found).toHaveProperty('owner_consistency_state');
      expect(found).toHaveProperty('consistency_risk_today');
      expect(found).toHaveProperty('renewal');
      expect(found).toHaveProperty('marked_attendance_today');
    });

    it('should aggregate the new dashboard counters without mixing not consistent members into building', async () => {
      const today = getIstDate();

      await seedMemberWithSubscriptionAndAttendance({
        full_name: 'Consistent Cora',
        email: 'cora@test.com',
        phone: '1111111111',
        package_id: 4,
        start_date: addDays(today, -46),
        end_date: computeEndDate(addDays(today, -46), 3),
        total_sessions: 36,
        amount: 85800,
        attendance_dates: [-20, -18, -16, -14, -12, -10, -8, -6, -4, -2].map((offset) => addDays(today, offset)),
      });

      await seedMemberWithSubscriptionAndAttendance({
        full_name: 'Risky Riya',
        email: 'riya-risk@test.com',
        phone: '2222222222',
        package_id: 4,
        start_date: addDays(today, -46),
        end_date: computeEndDate(addDays(today, -46), 3),
        total_sessions: 36,
        amount: 85800,
        attendance_dates: [-13, -10, -8, -7, -4, -2].map((offset) => addDays(today, offset)),
      });

      await seedMemberWithSubscriptionAndAttendance({
        full_name: 'Builder Ben',
        email: 'ben@test.com',
        phone: '3333333333',
        package_id: 2,
        start_date: addDays(today, -20),
        end_date: computeEndDate(addDays(today, -20), 1),
        total_sessions: 12,
        amount: 29500,
        attendance_dates: [-5, -1].map((offset) => addDays(today, offset)),
      });

      await seedMemberWithSubscriptionAndAttendance({
        full_name: 'Renewal Ruby',
        email: 'ruby@test.com',
        phone: '4444444444',
        package_id: 8,
        start_date: addDays(today, -24),
        end_date: addDays(today, 3),
        total_sessions: 12,
        amount: 14500,
        attendance_dates: [-18, -14, -10, -6, -2].map((offset) => addDays(today, offset)),
      });

      await seedMemberWithSubscriptionAndAttendance({
        full_name: 'Today Theo',
        email: 'theo@test.com',
        phone: '5555555555',
        package_id: 2,
        start_date: addDays(today, -20),
        end_date: computeEndDate(addDays(today, -20), 1),
        total_sessions: 12,
        amount: 29500,
        attendance_dates: [-5, -2, 0].map((offset) => addDays(today, offset)),
      });

      await seedMemberWithSubscriptionAndAttendance({
        full_name: 'Not Consistent Nora',
        email: 'nora@test.com',
        phone: '6666666666',
        package_id: 2,
        start_date: addDays(today, -20),
        end_date: computeEndDate(addDays(today, -20), 1),
        total_sessions: 12,
        amount: 29500,
        attendance_dates: [-15, -13, -12].map((offset) => addDays(today, offset)),
      });

      await seedMember({
        full_name: 'No Plan Nina',
        email: 'nina@test.com',
        phone: '7777777777',
      });

      const upcomingUmaId = await seedMember({
        full_name: 'Upcoming Uma',
        email: 'uma@test.com',
        phone: '8888888888',
      });

      await seedSubscription({
        member_id: upcomingUmaId,
        package_id: 8,
        start_date: addDays(today, 4),
        end_date: computeEndDate(addDays(today, 4), 1),
        total_sessions: 12,
        amount: 14500,
      });

      const body = await (await api('/api/owner/home', { headers: { Cookie: ownerCookie } })).json();

      expect(body.consistency_pipeline).toEqual({
        not_consistent: 1,
        building: 4,
        consistent: 1,
      });
      expect(body.at_risk).toEqual({
        total: 2,
        consistent: 1,
        building: 1,
      });
      expect(body.renewal_due_count).toBe(1);
      expect(body.no_active_plan_count).toBe(2);
      expect(body.renewal_no_active.map((member: any) => member.full_name)).toEqual(['No Plan Nina', 'Upcoming Uma']);
      expect(body.renewal_nearing_end.map((member: any) => member.full_name)).toEqual(['Renewal Ruby']);

      const notConsistentMember = body.active_members.find((member: any) => member.full_name === 'Not Consistent Nora');
      expect(notConsistentMember.consistency).toMatchObject({ status: 'building' });
      expect(notConsistentMember.owner_consistency_state).toMatchObject({
        stage: 'not_consistent',
        at_risk: false,
      });
      expect(notConsistentMember.consistency_risk_today).toBeNull();

      const upcomingMember = body.active_members.find((member: any) => member.full_name === 'Upcoming Uma');
      expect(upcomingMember.active_subscription).toBeNull();
      expect(upcomingMember.renewal).toMatchObject({
        kind: 'starts_on',
        upcoming_start_date: addDays(today, 4),
      });
    });

    it('should show archived members', async () => {
      await seedMember({ email: 'a@test.com', full_name: 'Archived Guy', phone: '1111111111', status: 'archived' });

      const body = await (await api('/api/owner/home', { headers: { Cookie: ownerCookie } })).json();
      const found = body.archived_members.find((m: any) => m.full_name === 'Archived Guy');
      expect(found).toBeTruthy();
    });

    it('should sort active_members alphabetically', async () => {
      await seedMember({ email: 'z@test.com', full_name: 'Zara', phone: '1111111111' });
      await seedMember({ email: 'a@test.com', full_name: 'Alpha', phone: '2222222222' });

      const body = await (await api('/api/owner/home', { headers: { Cookie: ownerCookie } })).json();
      const names = body.active_members.map((m: any) => m.full_name);
      expect(names).toEqual([...names].sort());
    });

    it('should resolve consistency for members on private custom packages', async () => {
      const memberId = await seedMember({ email: 'private@test.com', full_name: 'Private Plan', phone: '1111111111' });
      const createRes = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          custom_package: {
            service_type: 'Private Dashboard Plan',
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

      const body = await (await api('/api/owner/home', { headers: { Cookie: ownerCookie } })).json();
      const found = body.active_members.find((member: any) => member.full_name === 'Private Plan');
      expect(found).toBeTruthy();
      expect(found.active_subscription.service_type).toBe('Private Dashboard Plan');
      expect(found.consistency).toMatchObject({
        status: 'building',
      });
    });
  });
});
