import type { AppDatabase } from '../db/client.js';

export interface SessionRow {
  id: number;
  member_id: number;
  subscription_id: number;
  date: string;
  created_at: string;
}

export async function hasAttendanceForDate(db: AppDatabase, memberId: number, date: string): Promise<boolean> {
  const row = await db.get(
    `SELECT 1 FROM sessions WHERE member_id = ? AND date = ?`
  , [memberId, date]);
  return !!row;
}

export async function insertSession(db: AppDatabase, memberId: number, subscriptionId: number, date: string): Promise<number> {
  const result = await db.run(
    `INSERT INTO sessions (member_id, subscription_id, date) VALUES (?, ?, ?)`
  , [memberId, subscriptionId, date]);
  return result.lastRowId;
}

export async function listAttendanceDatesForMember(db: AppDatabase, memberId: number): Promise<string[]> {
  const rows = await db.all<{ date: string }>(
    `SELECT date FROM sessions WHERE member_id = ? ORDER BY date ASC`
  , [memberId]);
  return rows.map(r => r.date);
}

export async function listAttendanceDatesForSubscription(
  db: AppDatabase,
  memberId: number,
  subscriptionId: number,
): Promise<string[]> {
  const rows = await db.all<{ date: string }>(
    `SELECT date
     FROM sessions
     WHERE member_id = ? AND subscription_id = ?
     ORDER BY date ASC`
  , [memberId, subscriptionId]);
  return rows.map(r => r.date);
}

export async function getMembersCheckedInOnDate(db: AppDatabase, date: string): Promise<{ member_id: number; created_at: string }[]> {
  return db.all(
    `SELECT member_id, created_at FROM sessions WHERE date = ? ORDER BY created_at DESC, member_id ASC`
  , [date]);
}
