import type { AppDatabase } from '../db/client.js';

export interface SubscriptionRow {
  id: number;
  member_id: number;
  package_id: number;
  start_date: string;
  end_date: string;
  total_sessions: number;
  attended_sessions: number;
  amount: number;
  owner_completed: number;
  created_at: string;
}

export interface SubscriptionWithType extends SubscriptionRow {
  service_type: string;
}

export async function findSubscriptionById(db: AppDatabase, id: number): Promise<SubscriptionWithType | undefined> {
  return db.get(
    `SELECT s.*, p.service_type
     FROM subscriptions s
     JOIN packages p ON p.id = s.package_id
     WHERE s.id = ?`
  , [id]);
}

export async function listSubscriptionsForMember(db: AppDatabase, memberId: number): Promise<SubscriptionWithType[]> {
  return db.all(
    `SELECT s.*, p.service_type
     FROM subscriptions s
     JOIN packages p ON p.id = s.package_id
     WHERE s.member_id = ?
     ORDER BY s.start_date DESC, s.id DESC`
  , [memberId]);
}

export async function createSubscription(
  db: AppDatabase,
  data: {
    member_id: number;
    package_id: number;
    start_date: string;
    end_date: string;
    total_sessions: number;
    amount: number;
  }
): Promise<number> {
  const result = await db.run(
    `INSERT INTO subscriptions (member_id, package_id, start_date, end_date, total_sessions, amount)
     VALUES (?, ?, ?, ?, ?, ?)`
  , [data.member_id, data.package_id, data.start_date, data.end_date, data.total_sessions, data.amount]);
  return result.lastRowId;
}

export async function markSubscriptionCompleted(db: AppDatabase, id: number): Promise<void> {
  await db.run(`UPDATE subscriptions SET owner_completed = 1 WHERE id = ?`, [id]);
}

export async function incrementAttendedSessions(db: AppDatabase, id: number): Promise<void> {
  await db.run(
    `UPDATE subscriptions SET attended_sessions = attended_sessions + 1
     WHERE id = ? AND attended_sessions < total_sessions`
  , [id]);
}

export async function getEarliestSubscriptionStart(db: AppDatabase, memberId: number): Promise<string | undefined> {
  const row = await db.get<{ earliest: string | null }>(
    `SELECT MIN(start_date) as earliest FROM subscriptions WHERE member_id = ?`
  , [memberId]);
  return row?.earliest ?? undefined;
}
