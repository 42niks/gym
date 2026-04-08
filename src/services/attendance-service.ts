import type { AppDatabase } from '../db/client.js';
import { findMemberById } from '../repositories/members-repo.js';
import { listSubscriptionsForMember } from '../repositories/subscriptions-repo.js';
import { hasAttendanceForDate } from '../repositories/sessions-repo.js';
import { deriveLifecycleState } from '../lib/subscription.js';
import { getIstDate } from '../lib/date.js';

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
