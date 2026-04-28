import { describe, it, expect, beforeEach } from 'vitest';
import { api, reset, seedOwner, seedMember, seedUserSession, getUserSessionCount, utcDatetime } from './setup.js';
import { loginAs, seedSession, seedSubscription } from './helpers.js';
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
    full_name: input.full_name,
    email: input.email,
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

async function seedMembersViewFixtures() {
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

  await seedMember({
    full_name: 'No Plan Nina',
    email: 'nina@test.com',
    phone: '6666666666',
  });

  const upcomingUmaId = await seedMember({
    full_name: 'Upcoming Uma',
    email: 'uma@test.com',
    phone: '7777777777',
  });

  await seedSubscription({
    member_id: upcomingUmaId,
    package_id: 8,
    start_date: addDays(today, 4),
    end_date: computeEndDate(addDays(today, 4), 1),
    total_sessions: 12,
    amount: 14500,
  });

  await seedMember({
    full_name: 'Archived Aria',
    email: 'aria@test.com',
    phone: '8888888888',
    status: 'archived',
  });
}

async function seedNotConsistentMemberFixture() {
  const today = getIstDate();

  await seedMemberWithSubscriptionAndAttendance({
    full_name: 'Not Consistent Nora',
    email: 'nora@test.com',
    phone: '9999999998',
    package_id: 2,
    start_date: addDays(today, -20),
    end_date: computeEndDate(addDays(today, -20), 1),
    total_sessions: 12,
    amount: 29500,
    attendance_dates: [-15, -13, -12].map((offset) => addDays(today, offset)),
  });
}

async function seedBuildingAtRiskMemberFixture() {
  const today = getIstDate();

  await seedMemberWithSubscriptionAndAttendance({
    full_name: 'At Risk Asha',
    email: 'asha-risk@test.com',
    phone: '9999999997',
    package_id: 2,
    start_date: addDays(today, -20),
    end_date: computeEndDate(addDays(today, -20), 1),
    total_sessions: 12,
    amount: 29500,
    attendance_dates: [addDays(today, -6)],
  });
}

describe('Member Management', () => {
  let ownerCookie: string;

  beforeEach(async () => {
    await reset();
    await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
    ownerCookie = await loginAs('owner@base.gym', '9999999999');
  });

  // ─── POST /api/members ───

  describe('POST /api/members', () => {
    it('should create a member', async () => {
      const res = await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'Riya Patel', email: 'riya@test.com', phone: '9876543210' }),
      });
      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({
        id: expect.any(Number),
        full_name: 'Riya Patel',
        email: 'riya@test.com',
        phone: '9876543210',
        status: 'active',
        join_date: expect.any(String),
      });
    });

    it('should trim and lowercase email', async () => {
      const res = await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'Riya Patel', email: '  Riya@TEST.com  ', phone: '9876543210' }),
      });
      expect(res.status).toBe(201);
      expect((await res.json()).email).toBe('riya@test.com');
    });

    it('should accept a join_date in the past or future', async () => {
      const past = await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'Past Join', email: 'past@test.com', phone: '9876543211', join_date: '2020-01-01' }),
      });
      expect(past.status).toBe(201);
      expect((await past.json()).join_date).toBe('2020-01-01');

      const future = await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'Future Join', email: 'future@test.com', phone: '9876543212', join_date: '2030-12-31' }),
      });
      expect(future.status).toBe(201);
      expect((await future.json()).join_date).toBe('2030-12-31');
    });

    it('should reject invalid join_date format', async () => {
      const res = await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'Bad Join', email: 'badjoin@test.com', phone: '9876543213', join_date: '2026-13-40' }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Invalid join_date format');
    });

    it('should reject duplicate email', async () => {
      await seedMember({ email: 'taken@test.com', phone: '1111111111' });
      const res = await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'New Person', email: 'taken@test.com', phone: '2222222222' }),
      });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('A member with this email already exists');
    });

    it('should reject duplicate email case-insensitively', async () => {
      await seedMember({ email: 'taken@test.com', phone: '1111111111' });
      const res = await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'New Person', email: 'TAKEN@test.com', phone: '2222222222' }),
      });
      expect(res.status).toBe(409);
    });

    it('should reject missing full_name', async () => {
      expect((await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ email: 'a@b.com', phone: '1111111111' }),
      })).status).toBe(400);
    });

    it('should reject missing email', async () => {
      expect((await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'Name', phone: '1111111111' }),
      })).status).toBe(400);
    });

    it('should reject invalid email format', async () => {
      expect((await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'Name', email: 'notanemail', phone: '1111111111' }),
      })).status).toBe(400);
    });

    it('should reject non-object JSON bodies', async () => {
      const res = await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify(['bad-body']),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Invalid JSON body');
    });

    it('should reject missing phone', async () => {
      expect((await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'Name', email: 'a@b.com' }),
      })).status).toBe(400);
    });

    it('should allow duplicate phone numbers', async () => {
      await seedMember({ email: 'first@test.com', phone: '9876543210' });
      expect((await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'Second', email: 'second@test.com', phone: '9876543210' }),
      })).status).toBe(201);
    });

    it('should reject phone that is not exactly 10 digits', async () => {
      const res = await api('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'Bad Phone', email: 'badphone@test.com', phone: '12345' }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('phone must be exactly 10 digits');
    });
  });

  // ─── GET /api/members ───

  describe('GET /api/members', () => {
    it('lists all non-archived members by default, sorted by name', async () => {
      await seedMembersViewFixtures();

      const res = await api('/api/members', { headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);

      const body = await res.json() as any[];
      expect(body.map((member) => member.full_name)).toEqual([
        'Builder Ben',
        'Consistent Cora',
        'No Plan Nina',
        'Renewal Ruby',
        'Risky Riya',
        'Today Theo',
        'Upcoming Uma',
      ]);
    });

    it('sorts names lexically without case sensitivity', async () => {
      await seedMember({ full_name: 'zara', email: 'zara@test.com', phone: '1111111111' });
      await seedMember({ full_name: 'Alex', email: 'alex@test.com', phone: '2222222222' });
      await seedMember({ full_name: 'ben', email: 'ben@test.com', phone: '3333333333' });

      const res = await api('/api/members', { headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);

      const body = await res.json() as any[];
      expect(body.map((member) => member.full_name)).toEqual(['Alex', 'ben', 'zara']);
    });

    it('supports the all view explicitly and excludes archived members', async () => {
      await seedMembersViewFixtures();

      const res = await api('/api/members?view=all', { headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);

      const body = await res.json() as any[];
      expect(body).toHaveLength(7);
      expect(body.find((member) => member.full_name === 'Archived Aria')).toBeUndefined();
    });

    it('lists the no plan view, including members with only an upcoming subscription', async () => {
      await seedMembersViewFixtures();

      const res = await api('/api/members?view=no-plan', { headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);

      const body = await res.json() as any[];
      expect(body.map((member) => member.full_name)).toEqual(['No Plan Nina', 'Upcoming Uma']);
    });

    it('lists the renewal view', async () => {
      await seedMembersViewFixtures();

      const res = await api('/api/members?view=renewal', { headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);

      const body = await res.json() as any[];
      expect(body.map((member) => member.full_name)).toEqual(['Renewal Ruby']);
    });

    it('returns members and all tab counts from the overview endpoint', async () => {
      await seedMembersViewFixtures();
      await seedNotConsistentMemberFixture();
      await seedBuildingAtRiskMemberFixture();

      const res = await api('/api/members/overview?view=renewal', { headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.view).toBe('renewal');
      expect(body.members.map((member: any) => member.full_name)).toEqual(['Renewal Ruby']);
      expect(body.counts).toMatchObject({
        all: 9,
        'no-plan': 2,
        renewal: 1,
        'at-risk': 2,
        'not-consistent': 1,
        archived: 1,
      });
    });

    it('lists the at risk view', async () => {
      await seedMembersViewFixtures();
      await seedBuildingAtRiskMemberFixture();

      const res = await api('/api/members?view=at-risk', { headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);

      const body = await res.json() as any[];
      expect(body.map((member) => member.full_name)).toEqual(['At Risk Asha', 'Consistent Cora']);
      const buildingAtRiskMember = body.find((member) => member.full_name === 'At Risk Asha');
      expect(buildingAtRiskMember.owner_consistency_state).toMatchObject({
        stage: 'building',
        at_risk: true,
      });
      expect(buildingAtRiskMember.consistency_risk_today).toEqual({
        streak_days: 1,
        message: 'Attend today to avoid dropping into not consistent tomorrow.',
      });
      for (const member of body) {
        expect(member.owner_consistency_state?.at_risk).toBe(true);
        expect(member.consistency_risk_today).not.toBeNull();
        expect(member.owner_consistency_state?.at_risk === (member.consistency_risk_today !== null)).toBe(true);
        expect(member.consistency_risk_today).toMatchObject({
          streak_days: expect.any(Number),
          message: expect.stringContaining('Attend today'),
        });
      }
    });

    it('excludes members who already attended today from at risk even if they are otherwise building/consistent', async () => {
      await seedMembersViewFixtures();

      const atRiskRes = await api('/api/members?view=at-risk', { headers: { Cookie: ownerCookie } });
      const todayRes = await api('/api/members?view=today', { headers: { Cookie: ownerCookie } });
      expect(atRiskRes.status).toBe(200);
      expect(todayRes.status).toBe(200);

      const atRiskBody = await atRiskRes.json() as any[];
      const todayBody = await todayRes.json() as any[];
      expect(todayBody.map((member) => member.full_name)).toContain('Today Theo');
      expect(atRiskBody.map((member) => member.full_name)).not.toContain('Today Theo');
    });

    it('keeps no-plan members out of at risk, including members with only upcoming plans', async () => {
      await seedMembersViewFixtures();

      const atRiskRes = await api('/api/members?view=at-risk', { headers: { Cookie: ownerCookie } });
      const noPlanRes = await api('/api/members?view=no-plan', { headers: { Cookie: ownerCookie } });
      expect(atRiskRes.status).toBe(200);
      expect(noPlanRes.status).toBe(200);

      const atRiskBody = await atRiskRes.json() as any[];
      const noPlanBody = await noPlanRes.json() as any[];
      const noPlanNames = noPlanBody.map((member) => member.full_name);
      expect(noPlanNames).toEqual(['No Plan Nina', 'Upcoming Uma']);
      for (const name of noPlanNames) {
        expect(atRiskBody.map((member) => member.full_name)).not.toContain(name);
      }
    });

    it('lists the not consistent view separately from the building view', async () => {
      await seedMembersViewFixtures();
      await seedNotConsistentMemberFixture();

      const notConsistentRes = await api('/api/members?view=not-consistent', { headers: { Cookie: ownerCookie } });
      const buildingRes = await api('/api/members?view=building', { headers: { Cookie: ownerCookie } });

      expect(notConsistentRes.status).toBe(200);
      expect(buildingRes.status).toBe(200);

      const notConsistentBody = await notConsistentRes.json() as any[];
      const buildingBody = await buildingRes.json() as any[];

      expect(notConsistentBody.map((member) => member.full_name)).toEqual(['Not Consistent Nora']);
      expect(notConsistentBody[0].consistency).toMatchObject({ status: 'building' });
      expect(notConsistentBody[0].owner_consistency_state).toMatchObject({
        stage: 'not_consistent',
        at_risk: false,
      });
      expect(notConsistentBody[0].consistency_risk_today).toBeNull();
      expect(buildingBody.map((member) => member.full_name)).not.toContain('Not Consistent Nora');
    });

    it('keeps a stable owner-state view matrix for at-risk/building/not-consistent/consistent', async () => {
      await seedMembersViewFixtures();
      await seedNotConsistentMemberFixture();
      await seedBuildingAtRiskMemberFixture();

      const [atRiskRes, buildingRes, notConsistentRes, consistentRes] = await Promise.all([
        api('/api/members?view=at-risk', { headers: { Cookie: ownerCookie } }),
        api('/api/members?view=building', { headers: { Cookie: ownerCookie } }),
        api('/api/members?view=not-consistent', { headers: { Cookie: ownerCookie } }),
        api('/api/members?view=consistent', { headers: { Cookie: ownerCookie } }),
      ]);

      expect(atRiskRes.status).toBe(200);
      expect(buildingRes.status).toBe(200);
      expect(notConsistentRes.status).toBe(200);
      expect(consistentRes.status).toBe(200);

      const atRiskBody = await atRiskRes.json() as any[];
      const buildingBody = await buildingRes.json() as any[];
      const notConsistentBody = await notConsistentRes.json() as any[];
      const consistentBody = await consistentRes.json() as any[];

      expect(atRiskBody.map((member) => member.full_name)).toEqual(['At Risk Asha', 'Consistent Cora']);
      expect(buildingBody.map((member) => member.full_name)).toEqual([
        'At Risk Asha',
        'Builder Ben',
        'Renewal Ruby',
        'Risky Riya',
        'Today Theo',
      ]);
      expect(notConsistentBody.map((member) => member.full_name)).toEqual(['Not Consistent Nora']);
      expect(consistentBody.map((member) => member.full_name)).toEqual(['Consistent Cora']);
    });

    it('lists the building view', async () => {
      await seedMembersViewFixtures();

      const res = await api('/api/members?view=building', { headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);

      const body = await res.json() as any[];
      expect(body.map((member) => member.full_name)).toEqual([
        'Builder Ben',
        'Renewal Ruby',
        'Risky Riya',
        'Today Theo',
      ]);
    });

    it('lists the consistent view', async () => {
      await seedMembersViewFixtures();

      const res = await api('/api/members?view=consistent', { headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);

      const body = await res.json() as any[];
      expect(body.map((member) => member.full_name)).toEqual(['Consistent Cora']);
      expect(body[0].consistency.status).toBe('consistent');
    });

    it('lists the today view', async () => {
      await seedMembersViewFixtures();

      const res = await api('/api/members?view=today', { headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);

      const body = await res.json() as any[];
      expect(body.map((member) => member.full_name)).toEqual(['Today Theo']);
      expect(body[0].marked_attendance_today).toBe(true);
    });

    it('lists archived members from both the new and legacy archived routes', async () => {
      await seedMembersViewFixtures();

      const viewRes = await api('/api/members?view=archived', { headers: { Cookie: ownerCookie } });
      const statusRes = await api('/api/members?status=archived', { headers: { Cookie: ownerCookie } });

      expect(viewRes.status).toBe(200);
      expect(statusRes.status).toBe(200);
      expect((await viewRes.json() as any[]).map((member) => member.full_name)).toEqual(['Archived Aria']);
      expect((await statusRes.json() as any[]).map((member) => member.full_name)).toEqual(['Archived Aria']);
    });

    it('supports legacy view aliases for backwards compatibility', async () => {
      await seedMembersViewFixtures();

      const res = await api('/api/members?view=no-subscription', { headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);

      const body = await res.json() as any[];
      expect(body.map((member) => member.full_name)).toEqual(['No Plan Nina', 'Upcoming Uma']);
    });

    it('returns 400 for invalid view or invalid status', async () => {
      expect((await api('/api/members?view=invalid', { headers: { Cookie: ownerCookie } })).status).toBe(400);
      expect((await api('/api/members?status=invalid', { headers: { Cookie: ownerCookie } })).status).toBe(400);
    });

    it('does not include the owner in the member list', async () => {
      const body = await (await api('/api/members', { headers: { Cookie: ownerCookie } })).json() as any[];
      expect(body.find((m: any) => m.role === 'owner')).toBeUndefined();
    });

    it('includes enrichment fields on non-archived list rows', async () => {
      const memberId = await seedMember({ email: 'a@test.com', full_name: 'Alpha', phone: '1111111111' });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });

      const body = await (await api('/api/members', { headers: { Cookie: ownerCookie } })).json() as any[];
      expect(body[0]).toHaveProperty('active_subscription');
      expect(body[0]).toHaveProperty('consistency');
      expect(body[0]).toHaveProperty('renewal');
      expect(body[0]).toHaveProperty('owner_consistency_state');
      expect(body[0]).toHaveProperty('consistency_risk_today');
      expect(body[0]).toHaveProperty('marked_attendance_today');
      expect(body[0].owner_consistency_state).toMatchObject({
        stage: 'not_consistent',
        at_risk: false,
      });
    });
  });

  // ─── GET /api/members/:id ───

  describe('GET /api/members/:id', () => {
    it('should return member detail with enrichment fields', async () => {
      const memberId = await seedMember({ email: 'a@test.com', full_name: 'Alpha', phone: '1111111111' });
      const res = await api(`/api/members/${memberId}`, { headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.full_name).toBe('Alpha');
      expect(body).toHaveProperty('active_subscription');
      expect(body).toHaveProperty('consistency');
      expect(body).toHaveProperty('renewal');
      expect(body).toHaveProperty('marked_attendance_today');
      expect(body).toHaveProperty('status_highlights');
      expect(body).toHaveProperty('archive_action');
      expect(body.can_add_subscription).toBe(true);
      expect(body.can_edit_profile).toBe(true);
    });

    it('should expose archive blockers and owner status highlights', async () => {
      const memberId = await seedMember({ email: 'detail-flags@test.com', full_name: 'Detail Flags', phone: '1111111111' });
      await seedSubscription({
        member_id: memberId,
        package_id: 1,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        total_sessions: 8,
        amount: 19900,
      });
      await seedSubscription({
        member_id: memberId,
        package_id: 1,
        start_date: '2027-01-01',
        end_date: '2027-01-31',
        total_sessions: 8,
        amount: 19900,
      });

      const body = await (await api(`/api/members/${memberId}`, { headers: { Cookie: ownerCookie } })).json();
      expect(body.status_highlights.map((item: any) => item.key)).toContain('consistency_building');
      expect(body.archive_action).toMatchObject({
        kind: 'archive',
        allowed: false,
      });
      expect(body.archive_action.blocked_by).toHaveLength(2);
    });

    it('should resolve consistency and detail metadata for private custom packages', async () => {
      const memberId = await seedMember({ email: 'private-detail@test.com', full_name: 'Private Detail', phone: '1111111111' });
      const createRes = await api(`/api/members/${memberId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          custom_package: {
            service_type: 'Private Detail Plan',
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

      const body = await (await api(`/api/members/${memberId}`, { headers: { Cookie: ownerCookie } })).json();
      expect(body.active_subscription.service_type).toBe('Private Detail Plan');
      expect(body.consistency).toMatchObject({
        status: 'building',
      });
      expect(body.status_highlights.map((item: any) => item.key)).toContain('consistency_building');
    });

    it('should return 404 for non-existent member', async () => {
      expect((await api('/api/members/9999', { headers: { Cookie: ownerCookie } })).status).toBe(404);
    });

    it('should return nulls for archived member', async () => {
      const memberId = await seedMember({ email: 'a@test.com', full_name: 'Alpha', phone: '1111111111', status: 'archived' });
      const body = await (await api(`/api/members/${memberId}`, { headers: { Cookie: ownerCookie } })).json();
      expect(body.active_subscription).toBeNull();
      expect(body.consistency).toBeNull();
      expect(body.renewal).toBeNull();
      expect(body.archive_action.kind).toBe('unarchive');
      expect(body.can_add_subscription).toBe(false);
    });
  });

  // ─── PATCH /api/members/:id ───

  describe('PATCH /api/members/:id', () => {
    it('should update full_name', async () => {
      const memberId = await seedMember({ email: 'a@test.com', full_name: 'Old Name', phone: '1111111111' });
      const body = await (await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'New Name' }),
      })).json();
      expect(body.full_name).toBe('New Name');
    });

    it('should update phone', async () => {
      const memberId = await seedMember({ email: 'a@test.com', phone: '1111111111' });
      const body = await (await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ phone: '9999999999' }),
      })).json();
      expect(body.phone).toBe('9999999999');
    });

    it('should update join_date for active member', async () => {
      const memberId = await seedMember({ email: 'join-update@test.com', phone: '1111111111' });
      const res = await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ join_date: '2026-01-10' }),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).join_date).toBe('2026-01-10');
    });

    it('should update both full_name and phone', async () => {
      const memberId = await seedMember({ email: 'a@test.com', phone: '1111111111' });
      const body = await (await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'Updated', phone: '9999999999' }),
      })).json();
      expect(body.full_name).toBe('Updated');
      expect(body.phone).toBe('9999999999');
    });

    it('should reject when no editable field provided', async () => {
      const memberId = await seedMember({ email: 'a@test.com', phone: '1111111111' });
      expect((await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({}),
      })).status).toBe(400);
    });

    it('should reject unsupported editable fields', async () => {
      const memberId = await seedMember({ email: 'unsupported@test.com', phone: '1111111111' });
      const res = await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ email: 'updated@test.com' }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('Unsupported editable field');
    });

    it('should reject empty full_name after trim', async () => {
      const memberId = await seedMember({ email: 'a@test.com', phone: '1111111111' });
      expect((await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: '   ' }),
      })).status).toBe(400);
    });

    it('should reject empty join_date', async () => {
      const memberId = await seedMember({ email: 'join-empty@test.com', phone: '1111111111' });
      const res = await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ join_date: '   ' }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('join_date cannot be empty');
    });

    it('should reject invalid join_date format', async () => {
      const memberId = await seedMember({ email: 'join-invalid@test.com', phone: '1111111111' });
      const res = await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ join_date: '2026-13-45' }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Invalid join_date format');
    });

    it('should reject join_date after earliest subscription start_date', async () => {
      const memberId = await seedMember({ email: 'join-sub-limit@test.com', phone: '1111111111' });
      await seedSubscription({
        member_id: memberId,
        package_id: 1,
        start_date: '2026-01-10',
        end_date: '2026-02-10',
        total_sessions: 8,
        amount: 19900,
      });

      const res = await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ join_date: '2026-01-11' }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('join_date cannot be after earliest subscription start_date');
    });

    it('should reject join_date after earliest attendance date', async () => {
      const memberId = await seedMember({ email: 'join-att-limit@test.com', phone: '1111111111' });
      const subscriptionId = await seedSubscription({
        member_id: memberId,
        package_id: 1,
        start_date: '2026-01-20',
        end_date: '2026-02-20',
        total_sessions: 8,
        amount: 19900,
      });
      await seedSession({ member_id: memberId, subscription_id: subscriptionId, date: '2026-01-10' });

      const res = await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ join_date: '2026-01-11' }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('join_date cannot be after earliest attendance date');
    });

    it('should reject join_date update for archived member', async () => {
      const memberId = await seedMember({
        email: 'join-archived@test.com',
        phone: '1111111111',
        status: 'archived',
      });
      const res = await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ join_date: '2026-01-10' }),
      });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('Cannot update join_date for archived member');
    });

    it('should reject full_name update for archived member', async () => {
      const memberId = await seedMember({
        email: 'archived-name@test.com',
        phone: '1111111111',
        status: 'archived',
      });
      const res = await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'Updated Archived Name' }),
      });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('Cannot update archived member bio');
    });

    it('should reject phone update for archived member', async () => {
      const memberId = await seedMember({
        email: 'archived-phone@test.com',
        phone: '1111111111',
        status: 'archived',
      });
      const res = await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ phone: '9999999999' }),
      });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('Cannot update archived member bio');
    });

    it('should reject phone update when it is not exactly 10 digits', async () => {
      const memberId = await seedMember({ email: 'a@test.com', phone: '1111111111' });
      const res = await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ phone: '12345' }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('phone must be exactly 10 digits');
    });

    it('should reject non-object patch bodies', async () => {
      const memberId = await seedMember({ email: 'array-patch@test.com', phone: '1111111111' });
      const res = await api(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify(['bad-body']),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Invalid JSON body');
    });

    it('should return 404 for non-existent member', async () => {
      expect((await api('/api/members/9999', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ full_name: 'X' }),
      })).status).toBe(404);
    });
  });

  // ─── POST /api/members/:id/archive ───

  describe('POST /api/members/:id/archive', () => {
    it('should archive a member with no subscriptions', async () => {
      const memberId = await seedMember({ email: 'a@test.com', phone: '1111111111' });
      const res = await api(`/api/members/${memberId}/archive`, {
        method: 'POST',
        headers: { Cookie: ownerCookie },
      });
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);

      // Verify via GET
      const detail = await (await api(`/api/members/${memberId}`, { headers: { Cookie: ownerCookie } })).json();
      expect(detail.status).toBe('archived');
    });

    it('should delete user sessions on archive', async () => {
      const memberId = await seedMember({ email: 'a@test.com', phone: '1111111111' });
      await seedUserSession({ id: 'tok1', member_id: memberId, expires_at: utcDatetime(864000) });

      await api(`/api/members/${memberId}/archive`, { method: 'POST', headers: { Cookie: ownerCookie } });

      expect(await getUserSessionCount(memberId)).toBe(0);
    });

    it('should reject archive when member has active subscription', async () => {
      const memberId = await seedMember({ email: 'a@test.com', phone: '1111111111' });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });

      const res = await api(`/api/members/${memberId}/archive`, { method: 'POST', headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toContain('Mark relevant subscriptions complete first');
    });

    it('should reject archive when member has upcoming subscription', async () => {
      const memberId = await seedMember({ email: 'a@test.com', phone: '1111111111' });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2027-01-01', end_date: '2027-01-31', total_sessions: 8, amount: 19900 });

      expect((await api(`/api/members/${memberId}/archive`, { method: 'POST', headers: { Cookie: ownerCookie } })).status).toBe(409);
    });

    it('should reject already archived member', async () => {
      const memberId = await seedMember({ email: 'a@test.com', phone: '1111111111', status: 'archived' });
      const res = await api(`/api/members/${memberId}/archive`, { method: 'POST', headers: { Cookie: ownerCookie } });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('Member is already archived');
    });

    it('should allow archive when member has only completed subscriptions', async () => {
      const memberId = await seedMember({ email: 'a@test.com', phone: '1111111111' });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2025-01-01', end_date: '2025-01-31', total_sessions: 8, amount: 19900, owner_completed: 1 });

      expect((await api(`/api/members/${memberId}/archive`, { method: 'POST', headers: { Cookie: ownerCookie } })).status).toBe(200);
    });
  });

  describe('POST /api/members/:id/unarchive', () => {
    it('should unarchive an archived member', async () => {
      const memberId = await seedMember({ email: 'archived-now@test.com', phone: '7777777777', status: 'archived' });
      const res = await api(`/api/members/${memberId}/unarchive`, {
        method: 'POST',
        headers: { Cookie: ownerCookie },
      });
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
      const detail = await (await api(`/api/members/${memberId}`, { headers: { Cookie: ownerCookie } })).json();
      expect(detail.status).toBe('active');
    });
  });

  // ─── Member self routes ───

  describe('GET /api/member/profile', () => {
    it('should return own profile', async () => {
      await seedMember({ email: 'member@test.com', phone: '1234567890', full_name: 'Test Member' });
      const memberCookie = await loginAs('member@test.com', '1234567890');

      const body = await (await api('/api/member/profile', { headers: { Cookie: memberCookie } })).json();
      expect(body.full_name).toBe('Test Member');
      expect(body.email).toBe('member@test.com');
      expect(body.phone).toBe('1234567890');
      expect(body).toHaveProperty('join_date');
      expect(body).toHaveProperty('status');
    });
  });

  describe('GET /api/member/home', () => {
    it('should return all home screen fields', async () => {
      await seedMember({ email: 'member@test.com', phone: '1234567890' });
      const memberCookie = await loginAs('member@test.com', '1234567890');

      const body = await (await api('/api/member/home', { headers: { Cookie: memberCookie } })).json();
      expect(body).toHaveProperty('member');
      expect(body).toHaveProperty('active_subscription');
      expect(body).toHaveProperty('consistency');
      expect(body).toHaveProperty('renewal');
      expect(body).toHaveProperty('marked_attendance_today');
    });

    it('should show active subscription with remaining_sessions', async () => {
      const memberId = await seedMember({ email: 'member@test.com', phone: '1234567890' });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, attended_sessions: 3, amount: 19900 });
      const memberCookie = await loginAs('member@test.com', '1234567890');

      const body = await (await api('/api/member/home', { headers: { Cookie: memberCookie } })).json();
      expect(body.active_subscription).not.toBeNull();
      expect(body.active_subscription.lifecycle_state).toBe('active');
      expect(body.active_subscription.remaining_sessions).toBe(5);
    });
  });

  describe('GET /api/member/subscription', () => {
    it('should return a flat subscription list', async () => {
      const memberId = await seedMember({ email: 'member@test.com', phone: '1234567890' });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2026-01-01', end_date: '2026-12-31', total_sessions: 8, amount: 19900 });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2027-01-01', end_date: '2027-01-31', total_sessions: 8, amount: 19900 });
      await seedSubscription({ member_id: memberId, package_id: 1, start_date: '2025-01-01', end_date: '2025-01-31', total_sessions: 8, amount: 19900 });

      const memberCookie = await loginAs('member@test.com', '1234567890');
      const body = await (await api('/api/member/subscription', { headers: { Cookie: memberCookie } })).json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(3);
      expect(body.filter((sub: any) => sub.lifecycle_state === 'completed').length).toBe(1);
      expect(body.filter((sub: any) => sub.lifecycle_state === 'active').length).toBe(1);
      expect(body.filter((sub: any) => sub.lifecycle_state === 'upcoming').length).toBe(1);
    });
  });

  describe('GET /api/member/subscription/:id/attendance', () => {
    it('should return attended dates for the member subscription', async () => {
      const memberId = await seedMember({ email: 'member@test.com', phone: '1234567890' });
      const subscriptionId = await seedSubscription({
        member_id: memberId,
        package_id: 1,
        start_date: '2026-04-01',
        end_date: '2026-04-30',
        total_sessions: 8,
        attended_sessions: 2,
        amount: 19900,
      });
      await seedSession({ member_id: memberId, subscription_id: subscriptionId, date: '2026-04-03' });
      await seedSession({ member_id: memberId, subscription_id: subscriptionId, date: '2026-04-07' });

      const memberCookie = await loginAs('member@test.com', '1234567890');
      const res = await api(`/api/member/subscription/${subscriptionId}/attendance`, {
        headers: { Cookie: memberCookie },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.subscription).toMatchObject({
        id: subscriptionId,
        service_type: '1:1 Personal Training',
      });
      expect(body).toHaveProperty('consistency_window');
      expect(body.attended_dates).toEqual(['2026-04-03', '2026-04-07']);
    });

    it('should return 404 for another members subscription', async () => {
      const memberId = await seedMember({ email: 'member@test.com', phone: '1234567890' });
      const otherMemberId = await seedMember({ email: 'other@test.com', phone: '9999999998' });
      const subscriptionId = await seedSubscription({
        member_id: otherMemberId,
        package_id: 1,
        start_date: '2026-04-01',
        end_date: '2026-04-30',
        total_sessions: 8,
        amount: 19900,
      });

      const memberCookie = await loginAs('member@test.com', '1234567890');
      const res = await api(`/api/member/subscription/${subscriptionId}/attendance`, {
        headers: { Cookie: memberCookie },
      });

      expect(memberId).toBeGreaterThan(0);
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe('Subscription not found');
    });
  });
});
