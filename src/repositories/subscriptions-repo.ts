import Database from 'better-sqlite3';

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

export function findSubscriptionById(db: Database.Database, id: number): SubscriptionWithType | undefined {
  return db.prepare(
    `SELECT s.*, p.service_type
     FROM subscriptions s
     JOIN packages p ON p.id = s.package_id
     WHERE s.id = ?`
  ).get(id) as SubscriptionWithType | undefined;
}

export function listSubscriptionsForMember(db: Database.Database, memberId: number): SubscriptionWithType[] {
  return db.prepare(
    `SELECT s.*, p.service_type
     FROM subscriptions s
     JOIN packages p ON p.id = s.package_id
     WHERE s.member_id = ?
     ORDER BY s.start_date DESC, s.id DESC`
  ).all(memberId) as SubscriptionWithType[];
}

export function createSubscription(
  db: Database.Database,
  data: {
    member_id: number;
    package_id: number;
    start_date: string;
    end_date: string;
    total_sessions: number;
    amount: number;
  }
): number {
  const result = db.prepare(
    `INSERT INTO subscriptions (member_id, package_id, start_date, end_date, total_sessions, amount)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(data.member_id, data.package_id, data.start_date, data.end_date, data.total_sessions, data.amount);
  return Number(result.lastInsertRowid);
}

export function markSubscriptionCompleted(db: Database.Database, id: number): void {
  db.prepare(`UPDATE subscriptions SET owner_completed = 1 WHERE id = ?`).run(id);
}

export function incrementAttendedSessions(db: Database.Database, id: number): void {
  db.prepare(
    `UPDATE subscriptions SET attended_sessions = attended_sessions + 1
     WHERE id = ? AND attended_sessions < total_sessions`
  ).run(id);
}

export function getEarliestSubscriptionStart(db: Database.Database, memberId: number): string | undefined {
  const row = db.prepare(
    `SELECT MIN(start_date) as earliest FROM subscriptions WHERE member_id = ?`
  ).get(memberId) as any;
  return row?.earliest ?? undefined;
}
