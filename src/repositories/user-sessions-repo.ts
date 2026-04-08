import type { AppDatabase } from '../db/client.js';

export interface UserSessionRow {
  id: string;
  member_id: number;
  created_at: string;
  expires_at: string;
}

export async function createSession(db: AppDatabase, memberId: number): Promise<{ token: string; expiresAt: string }> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  await db.run(
    `INSERT INTO user_sessions (id, member_id, expires_at) VALUES (?, ?, ?)`
  , [token, memberId, expiresAt]);
  return { token, expiresAt };
}

export async function findSession(db: AppDatabase, token: string): Promise<(UserSessionRow & { role: string; status: string }) | undefined> {
  return db.get(
    `SELECT us.id, us.member_id, us.created_at, us.expires_at, m.role, m.status
     FROM user_sessions us
     JOIN members m ON m.id = us.member_id
     WHERE us.id = ?`
  , [token]);
}

export async function deleteSession(db: AppDatabase, token: string): Promise<void> {
  await db.run(`DELETE FROM user_sessions WHERE id = ?`, [token]);
}

export async function deleteExpiredSessions(db: AppDatabase, memberId: number): Promise<void> {
  await db.run(
    `DELETE FROM user_sessions WHERE member_id = ? AND expires_at < datetime('now')`
  , [memberId]);
}

export async function deleteAllSessionsForMember(db: AppDatabase, memberId: number): Promise<void> {
  await db.run(`DELETE FROM user_sessions WHERE member_id = ?`, [memberId]);
}

export async function refreshSession(db: AppDatabase, token: string): Promise<string> {
  const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  await db.run(`UPDATE user_sessions SET expires_at = ? WHERE id = ?`, [expiresAt, token]);
  return expiresAt;
}
