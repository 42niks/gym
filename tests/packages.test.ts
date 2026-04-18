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

  async function createManagedPackage(body?: Record<string, unknown>) {
    return api('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({
        service_type: 'MMA/Kickboxing Personal Training',
        sessions: 10,
        duration_months: 2,
        price: 12000,
        consistency_window_days: 7,
        consistency_min_days: 2,
        is_active: true,
        ...body,
      }),
    });
  }

  it('lists managed packages including archived rows for the owner package endpoint', async () => {
    await api('/api/packages/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ is_active: false }),
    });

    const res = await api('/api/packages', { headers: { Cookie: ownerCookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.find((pkg: any) => pkg.id === 1)).toMatchObject({
      id: 1,
      is_active: false,
      subscription_count: expect.any(Number),
    });
  });

  it('creates a package for owner management', async () => {
    const res = await createManagedPackage();

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      service_type: 'MMA/Kickboxing Personal Training',
      sessions: 10,
      duration_months: 2,
      price: 12000,
      consistency_window_days: 7,
      consistency_min_days: 2,
      is_active: true,
      subscription_count: 0,
      active_subscription_count: 0,
      upcoming_subscription_count: 0,
    });
  });

  it('rejects non-object package create payloads', async () => {
    const res = await api('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify(['not', 'an', 'object']),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON body');
  });

  it('rejects unsupported package create fields', async () => {
    const res = await createManagedPackage({ typo_price: 12000 });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Unsupported package field');
  });

  it('rejects a consistency window smaller than 5 days', async () => {
    const res = await createManagedPackage({ consistency_window_days: 4, consistency_min_days: 2 });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('consistency_window_days must be at least 5');
  });

  it('rejects min days that are not strictly less than the window', async () => {
    const res = await createManagedPackage({ consistency_window_days: 7, consistency_min_days: 7 });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('consistency_min_days must be less than consistency_window_days');
  });

  it('rejects duplicate package definitions', async () => {
    await createManagedPackage();

    const res = await createManagedPackage();

    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('already exists');
  });

  it('blocks editing package fields even when the package is unused', async () => {
    const created = await (await createManagedPackage({ service_type: 'Unused Test Package' })).json();

    const res = await api(`/api/packages/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ price: 12999 }),
    });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Packages are not editable. Create a new package row instead.');
  });

  it('allows archiving a package that already has active subscriptions', async () => {
    await seedSubscription({
      member_id: memberId,
      package_id: 1,
      start_date: today,
      end_date: computeEndDate(today, 1),
      total_sessions: 8,
      amount: 19900,
    });

    const res = await api('/api/packages/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ is_active: false }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: 1,
      is_active: false,
      subscription_count: 1,
      active_subscription_count: 1,
    });

    const listRes = await api('/api/packages', { headers: { Cookie: ownerCookie } });
    const packages = await listRes.json();
    expect(packages.find((pkg: any) => pkg.id === 1)).toMatchObject({ is_active: false });
  });

  it('rejects non-object package patch payloads', async () => {
    const res = await api('/api/packages/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify(['not', 'an', 'object']),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON body');
  });

  it('rejects unsupported package patch fields', async () => {
    const res = await api('/api/packages/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ archived_at: today }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Unsupported package field');
  });

  it('rejects subscription creation on archived packages', async () => {
    await api('/api/packages/1', {
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

  it('keeps custom private packages out of the owner package catalog', async () => {
    const customSubRes = await api(`/api/members/${memberId}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({
        custom_package: {
          service_type: 'Private One-Off Package',
          sessions: 10,
          start_date: addDays(today, 1),
          end_date: addDays(today, 30),
          amount: 17000,
          consistency_window_days: 7,
          consistency_min_days: 3,
        },
      }),
    });
    expect(customSubRes.status).toBe(201);

    const res = await api('/api/packages', { headers: { Cookie: ownerCookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.find((pkg: any) => pkg.service_type === 'Private One-Off Package')).toBeUndefined();
  });
});
