import Database from 'better-sqlite3';
import crypto from 'crypto';

export interface UserSessionRow {
  id: string;
  member_id: number;
  created_at: string;
  expires_at: string;
}

export function createSession(db: Database.Database, memberId: number): { token: string; expiresAt: string } {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  db.prepare(
    `INSERT INTO user_sessions (id, member_id, expires_at) VALUES (?, ?, ?)`
  ).run(token, memberId, expiresAt);
  return { token, expiresAt };
}

export function findSession(db: Database.Database, token: string): (UserSessionRow & { role: string; status: string }) | undefined {
  return db.prepare(
    `SELECT us.id, us.member_id, us.created_at, us.expires_at, m.role, m.status
     FROM user_sessions us
     JOIN members m ON m.id = us.member_id
     WHERE us.id = ?`
  ).get(token) as any;
}

export function deleteSession(db: Database.Database, token: string): void {
  db.prepare(`DELETE FROM user_sessions WHERE id = ?`).run(token);
}

export function deleteExpiredSessions(db: Database.Database, memberId: number): void {
  db.prepare(
    `DELETE FROM user_sessions WHERE member_id = ? AND expires_at < datetime('now')`
  ).run(memberId);
}

export function deleteAllSessionsForMember(db: Database.Database, memberId: number): void {
  db.prepare(`DELETE FROM user_sessions WHERE member_id = ?`).run(memberId);
}

export function refreshSession(db: Database.Database, token: string): string {
  const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  db.prepare(`UPDATE user_sessions SET expires_at = ? WHERE id = ?`).run(expiresAt, token);
  return expiresAt;
}
