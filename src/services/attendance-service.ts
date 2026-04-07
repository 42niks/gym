import Database from 'better-sqlite3';
import { findMemberById } from '../repositories/members-repo.js';
import { listSubscriptionsForMember, incrementAttendedSessions } from '../repositories/subscriptions-repo.js';
import { hasAttendanceForDate, insertSession } from '../repositories/sessions-repo.js';
import { deriveLifecycleState } from '../lib/subscription.js';
import { getIstDate } from '../lib/date.js';

export function markAttendance(db: Database.Database, memberId: number) {
  const today = getIstDate();
  const member = findMemberById(db, memberId);
  if (!member) return { error: 'Member not found', status: 404 as const };

  if (member.status === 'archived') {
    return { error: 'Cannot mark attendance for an archived member', status: 400 as const };
  }

  // Find active subscription
  const subs = listSubscriptionsForMember(db, memberId);
  const activeSubs = subs.filter(s => deriveLifecycleState(s, today) === 'active');

  if (activeSubs.length === 0) {
    return { error: 'No active subscription', status: 400 as const };
  }
  if (activeSubs.length > 1) {
    return { error: 'Multiple active subscriptions found', status: 500 as const };
  }

  const activeSub = activeSubs[0];

  // Check for duplicate
  if (hasAttendanceForDate(db, memberId, today)) {
    return { error: 'Attendance already marked for today', status: 409 as const };
  }

  // Atomic insert + increment
  const doMark = db.transaction(() => {
    insertSession(db, memberId, activeSub.id, today);
    incrementAttendedSessions(db, activeSub.id);
  });

  try {
    doMark();
  } catch (e: any) {
    // UNIQUE constraint violation on (member_id, date)
    if (e.message?.includes('UNIQUE constraint failed')) {
      return { error: 'Attendance already marked for today', status: 409 as const };
    }
    throw e;
  }

  return { data: { ok: true }, status: 200 as const };
}
