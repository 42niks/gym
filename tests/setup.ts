export const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:8002';

declare global {
  interface Body {
    json<T = any>(): Promise<T>;
  }
}

export interface TestResponse extends Response {
  json<T = any>(): Promise<T>;
}

/** Raw HTTP helper — thin wrapper around fetch for the test server */
export async function api(path: string, options?: RequestInit): Promise<TestResponse> {
  const res = await fetch(BASE_URL + path, options);
  return res as TestResponse;
}

// ─── DB control ──────────────────────────────────────────────────────────────

/** Wipe all data (members, subscriptions, sessions, user_sessions), re-seed packages */
export async function reset(): Promise<void> {
  const res = await api('/api/__test__/reset', { method: 'POST' });
  if (!res.ok) throw new Error(`reset failed: ${res.status}`);
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

export async function seedOwner(overrides?: {
  full_name?: string;
  email?: string;
  phone?: string;
}): Promise<number> {
  const res = await api('/api/__test__/member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'owner',
      full_name: overrides?.full_name ?? 'Test Owner',
      email: overrides?.email ?? 'owner@base.gym',
      phone: overrides?.phone ?? '9999999999',
      join_date: '2026-01-01',
      status: 'active',
    }),
  });
  const body = await res.json();
  return body.id;
}

export async function seedMember(overrides?: {
  full_name?: string;
  email?: string;
  phone?: string;
  status?: string;
}): Promise<number> {
  const res = await api('/api/__test__/member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'member',
      full_name: overrides?.full_name ?? 'Test Member',
      email: overrides?.email ?? 'member@test.com',
      phone: overrides?.phone ?? '1234567890',
      join_date: '2026-01-15',
      status: overrides?.status ?? 'active',
    }),
  });
  const body = await res.json();
  return body.id;
}

export async function seedUserSession(data: {
  id: string;
  member_id: number;
  expires_at: string; // UTC datetime string, e.g. "2026-04-06 10:00:00"
}): Promise<void> {
  const res = await api('/api/__test__/user-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`seedUserSession failed: ${res.status}`);
}

export async function getUserSession(token: string): Promise<{ exists: boolean; expires_at?: string }> {
  const res = await api(`/api/__test__/user-session/${token}`);
  return res.json();
}

export async function getUserSessionCount(memberId: number): Promise<number> {
  const res = await api(`/api/__test__/user-sessions/member/${memberId}`);
  const body = await res.json();
  return body.count;
}

// ─── Datetime helpers for test seeding ────────────────────────────────────────

/** Returns a UTC datetime string ±offsetSeconds from now, matching SQLite format */
export function utcDatetime(offsetSeconds: number = 0): string {
  return new Date(Date.now() + offsetSeconds * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, '');
}
