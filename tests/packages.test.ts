import { beforeEach, describe, expect, it } from 'vitest';
import { api, reset, seedOwner, seedMember } from './setup.js';
import { loginAs, seedSubscription } from './helpers.js';
import { addDays, getIstDate } from '../src/lib/date.js';
import { computeEndDate } from '../src/lib/subscription.js';

describe('Package Management', () => {
  let ownerCookie: string;
  let memberId: number;
  let today: string;

  beforeEach(async () => {
    await reset();
    await seedOwner({ email: 'owner@base.gym', phone: '9999999999' });
    memberId = await seedMember({ email: 'member@test.com', phone: '1234567890' });
    ownerCookie = await loginAs('owner@base.gym', '9999999999');
    today = getIstDate();
  });

  it('lists only active packages for the sellable package endpoint', async () => {
    await api('/api/owner/packages/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ is_active: false }),
    });

    const res = await api('/api/packages', { headers: { Cookie: ownerCookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.some((pkg: any) => pkg.id === 1)).toBe(false);
  });

  it('creates a package for owner management', async () => {
    const res = await api('/api/owner/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({
        service_type: 'Mobility Coaching',
        sessions: 10,
        duration_months: 2,
        price: 12000,
        consistency_window_days: 7,
        consistency_min_days: 2,
        is_active: true,
      }),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      service_type: 'Mobility Coaching',
      sessions: 10,
      duration_months: 2,
      price: 12000,
      consistency_window_days: 7,
      consistency_min_days: 2,
      is_active: true,
      subscription_count: 0,
    });
  });

  it('blocks commercial edits for packages already in use', async () => {
    await seedSubscription({
      member_id: memberId,
      package_id: 1,
      start_date: today,
      end_date: computeEndDate(today, 1),
      total_sessions: 8,
      amount: 19900,
    });

    const res = await api('/api/owner/packages/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ price: 20900 }),
    });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('already in use');
  });

  it('allows rule updates and retirement for packages already in use', async () => {
    await seedSubscription({
      member_id: memberId,
      package_id: 1,
      start_date: today,
      end_date: computeEndDate(today, 1),
      total_sessions: 8,
      amount: 19900,
    });

    const res = await api('/api/owner/packages/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({
        consistency_min_days: 4,
        is_active: false,
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: 1,
      consistency_min_days: 4,
      is_active: false,
      subscription_count: 1,
    });
  });

  it('deletes unused packages', async () => {
    const created = await (await api('/api/owner/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({
        service_type: 'Mobility Coaching',
        sessions: 10,
        duration_months: 2,
        price: 12000,
        consistency_window_days: 7,
        consistency_min_days: 2,
        is_active: true,
      }),
    })).json();

    const deleteRes = await api(`/api/owner/packages/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: ownerCookie },
    });

    expect(deleteRes.status).toBe(200);

    const listRes = await api('/api/owner/packages', { headers: { Cookie: ownerCookie } });
    const body = await listRes.json();
    expect(body.some((pkg: any) => pkg.id === created.id)).toBe(false);
  });

  it('rejects subscription creation on retired packages', async () => {
    await api('/api/owner/packages/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ is_active: false }),
    });

    const res = await api(`/api/members/${memberId}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({
        package_id: 1,
        start_date: addDays(today, 1),
      }),
    });

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Package not found');
  });
});
