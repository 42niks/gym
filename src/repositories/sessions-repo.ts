import Database from 'better-sqlite3';

export interface SessionRow {
  id: number;
  member_id: number;
  subscription_id: number;
  date: string;
  created_at: string;
}

export function hasAttendanceForDate(db: Database.Database, memberId: number, date: string): boolean {
  const row = db.prepare(
    `SELECT 1 FROM sessions WHERE member_id = ? AND date = ?`
  ).get(memberId, date);
  return !!row;
}

export function insertSession(db: Database.Database, memberId: number, subscriptionId: number, date: string): number {
  const result = db.prepare(
    `INSERT INTO sessions (member_id, subscription_id, date) VALUES (?, ?, ?)`
  ).run(memberId, subscriptionId, date);
  return Number(result.lastInsertRowid);
}

export function listAttendanceDatesForMember(db: Database.Database, memberId: number): string[] {
  const rows = db.prepare(
    `SELECT date FROM sessions WHERE member_id = ? ORDER BY date ASC`
  ).all(memberId) as { date: string }[];
  return rows.map(r => r.date);
}

export function getMembersCheckedInToday(db: Database.Database, date: string): { member_id: number; created_at: string }[] {
  return db.prepare(
    `SELECT member_id, created_at FROM sessions WHERE date = ? ORDER BY created_at DESC, member_id ASC`
  ).all(date) as any[];
}
