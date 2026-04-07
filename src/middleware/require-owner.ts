import { Context, Next } from 'hono';
import type { AppEnv } from '../app.js';

export async function requireOwner(c: Context<AppEnv>, next: Next) {
  const user = c.get('user');
  if (!user || user.role !== 'owner') {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
}
