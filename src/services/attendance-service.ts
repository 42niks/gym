import type { AppDatabase } from '../db/client.js';
import { findMemberById } from '../repositories/members-repo.js';
import { findSubscriptionById, listSubscriptionsForMember } from '../repositories/subscriptions-repo.js';
import {
  hasAttendanceForDate,
  hasAttendanceForSubscriptionDate,
  listAttendanceDatesForSubscription,
} from '../repositories/sessions-repo.js';
import { deriveLifecycleState } from '../lib/subscription.js';
import { getIstDate, isValidYmdDate } from '../lib/date.js';

export async function markAttendance(db: AppDatabase, memberId: number) {
  const today = getIstDate();
  const member = await findMemberById(db, memberId);
  if (!member) return { error: 'Member not found', status: 404 as const };

  if (member.status === 'archived') {
    return { error: 'Cannot mark attendance for an archived member', status: 400 as const };
  }

  // Find active subscription
  const subs = await listSubscriptionsForMember(db, memberId);
  const activeSubs = subs.filter(s => deriveLifecycleState(s, today) === 'active');

  if (activeSubs.length === 0) {
    return { error: 'No active subscription', status: 400 as const };
  }
  if (activeSubs.length > 1) {
    return { error: 'Multiple active subscriptions found', status: 500 as const };
  }

  const activeSub = activeSubs[0];

  // Check for duplicate
  if (await hasAttendanceForDate(db, memberId, today)) {
    return { error: 'Attendance already marked for today', status: 409 as const };
  }

  try {
    await db.batch([
      {
        sql: `INSERT INTO sessions (member_id, subscription_id, date) VALUES (?, ?, ?)`,
        params: [memberId, activeSub.id, today],
      },
      {
        sql: `UPDATE subscriptions SET attended_sessions = attended_sessions + 1
              WHERE id = ? AND attended_sessions < total_sessions`,
        params: [activeSub.id],
      },
    ]);
  } catch (e: any) {
    // UNIQUE constraint violation on (member_id, date)
    if (e.message?.includes('UNIQUE constraint failed')) {
      return { error: 'Attendance already marked for today', status: 409 as const };
    }
    throw e;
  }

  return { data: { ok: true }, status: 200 as const };
}

export async function addAttendanceDate(
  db: AppDatabase,
  memberId: number,
  subscriptionId: number,
  date: string,
) {
  if (!isValidYmdDate(date)) {
    return { error: 'Invalid attendance date format', status: 400 as const };
  }
  const subscription = await findSubscriptionById(db, subscriptionId);
  if (!subscription || subscription.member_id !== memberId) {
    return { error: 'Subscription not found', status: 404 as const };
  }
  if (date < subscription.start_date || date > subscription.end_date) {
    return { error: 'Attendance date must fall within the subscription period', status: 400 as const };
  }

  if (await hasAttendanceForDate(db, memberId, date)) {
    return { error: 'Attendance already marked for this date', status: 409 as const };
  }
  if (subscription.attended_sessions >= subscription.total_sessions) {
    return { error: 'Cannot exceed total sessions for this subscription', status: 409 as const };
  }

  await db.batch([
    {
      sql: `INSERT INTO sessions (member_id, subscription_id, date) VALUES (?, ?, ?)`,
      params: [memberId, subscriptionId, date],
    },
    {
      sql: `UPDATE subscriptions SET attended_sessions = attended_sessions + 1
            WHERE id = ? AND attended_sessions < total_sessions`,
      params: [subscriptionId],
    },
  ]);

  return { data: { ok: true }, status: 200 as const };
}

export async function removeAttendanceDate(
  db: AppDatabase,
  memberId: number,
  subscriptionId: number,
  date: string,
) {
  if (!isValidYmdDate(date)) {
    return { error: 'Invalid attendance date format', status: 400 as const };
  }
  const subscription = await findSubscriptionById(db, subscriptionId);
  if (!subscription || subscription.member_id !== memberId) {
    return { error: 'Subscription not found', status: 404 as const };
  }

  const exists = await hasAttendanceForSubscriptionDate(db, memberId, subscriptionId, date);
  if (!exists) {
    return { error: 'Attendance is not marked for this date', status: 404 as const };
  }

  await db.batch([
    {
      sql: `DELETE FROM sessions WHERE member_id = ? AND subscription_id = ? AND date = ?`,
      params: [memberId, subscriptionId, date],
    },
    {
      sql: `UPDATE subscriptions
            SET attended_sessions = CASE WHEN attended_sessions > 0 THEN attended_sessions - 1 ELSE 0 END
            WHERE id = ?`,
      params: [subscriptionId],
    },
  ]);

  return { data: { ok: true }, status: 200 as const };
}

export async function getOwnerSubscriptionAttendance(
  db: AppDatabase,
  memberId: number,
  subscriptionId: number,
) {
  const subscription = await findSubscriptionById(db, subscriptionId);
  if (!subscription || subscription.member_id !== memberId) return null;
  const attendedDates = await listAttendanceDatesForSubscription(db, memberId, subscriptionId);
  return {
    attended_dates: attendedDates,
  };
}
