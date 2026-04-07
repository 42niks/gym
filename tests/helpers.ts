import { api, BASE_URL } from './setup.js';

/** Login and return cookie string for subsequent requests */
export async function loginAs(email: string, password: string): Promise<string> {
  const res = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status}`);
  const cookie = res.headers.get('set-cookie')!;
  const token = cookie.match(/session_id=([^;]+)/)![1];
  return `session_id=${token}`;
}

export async function seedSubscription(data: {
  member_id: number;
  package_id: number;
  start_date: string;
  end_date: string;
  total_sessions: number;
  attended_sessions?: number;
  amount: number;
  owner_completed?: number;
}): Promise<number> {
  const res = await api('/api/__test__/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  return body.id;
}

export async function seedSession(data: {
  member_id: number;
  subscription_id: number;
  date: string;
}): Promise<number> {
  const res = await api('/api/__test__/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  return body.id;
}

export async function getSubscription(id: number): Promise<any> {
  const res = await api(`/api/__test__/subscription/${id}`);
  return res.json();
}
