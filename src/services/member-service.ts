import type { AppDatabase } from '../db/client.js';
import { findMemberById, listMembersByStatus, createMember as repoCreateMember, updateMember as repoUpdateMember, archiveMember as repoArchiveMember, type MemberRow } from '../repositories/members-repo.js';
import { listSubscriptionsForMember, getEarliestSubscriptionStart, type SubscriptionWithType } from '../repositories/subscriptions-repo.js';
import { listAttendanceDatesForMember, hasAttendanceForDate } from '../repositories/sessions-repo.js';
import { deleteAllSessionsForMember } from '../repositories/user-sessions-repo.js';
import { deriveLifecycleState } from '../lib/subscription.js';
import { computeRenewal } from '../lib/renewal.js';
import { computeConsistency } from '../lib/consistency.js';
import { addDays, getIstDate } from '../lib/date.js';
import { findPackageById } from '../repositories/packages-repo.js';

export interface MemberProfile {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  join_date: string;
  status: string;
}

export function toProfile(m: MemberRow): MemberProfile {
  return { id: m.id, full_name: m.full_name, email: m.email, phone: m.phone, join_date: m.join_date, status: m.status };
}

export function formatSubscription(sub: SubscriptionWithType, today: string) {
  const lifecycle = deriveLifecycleState(sub, today);
  return {
    id: sub.id,
    package_id: sub.package_id,
    service_type: sub.service_type,
    start_date: sub.start_date,
    end_date: sub.end_date,
    total_sessions: sub.total_sessions,
    attended_sessions: sub.attended_sessions,
    remaining_sessions: sub.total_sessions - sub.attended_sessions,
    amount: sub.amount,
    owner_completed: sub.owner_completed === 1 ? true : false,
    lifecycle_state: lifecycle,
  };
}

export function getActiveSub(subs: SubscriptionWithType[], today: string): SubscriptionWithType | null {
  const actives = subs.filter(s => deriveLifecycleState(s, today) === 'active');
  if (actives.length > 1) throw new Error('Multiple active subscriptions found');
  return actives[0] ?? null;
}

export function getUpcomingSubs(subs: SubscriptionWithType[], today: string): SubscriptionWithType[] {
  return subs
    .filter(s => deriveLifecycleState(s, today) === 'upcoming')
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id);
}

function buildRecentAttendance(attendanceDates: string[], today: string, days: number) {
  const attendanceSet = new Set(attendanceDates);
  const result: { date: string; attended: boolean }[] = [];

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = addDays(today, -offset);
    result.push({
      date,
      attended: attendanceSet.has(date),
    });
  }

  return result;
}

export async function computeMemberEnrichment(db: AppDatabase, memberId: number, today: string) {
  const subs = await listSubscriptionsForMember(db, memberId);
  const activeSub = getActiveSub(subs, today);
  const upcomingSubs = getUpcomingSubs(subs, today);
  const markedToday = await hasAttendanceForDate(db, memberId, today);
  const attendanceDates = await listAttendanceDatesForMember(db, memberId);

  let consistency = null;
  if (activeSub) {
    const pkg = await findPackageById(db, activeSub.package_id);
    if (pkg) {
      const earliest = await getEarliestSubscriptionStart(db, memberId);
      consistency = computeConsistency({
        hasActiveSubscription: true,
        windowDays: pkg.consistency_window_days,
        minDays: pkg.consistency_min_days,
        earliestSubscriptionStart: earliest!,
        attendanceDates,
        today,
      });
    }
  }

  const renewal = computeRenewal({
    active: activeSub ? {
      end_date: activeSub.end_date,
      total_sessions: activeSub.total_sessions,
      attended_sessions: activeSub.attended_sessions,
    } : null,
    upcomingStartDate: upcomingSubs[0]?.start_date ?? null,
    today,
  });

  return {
    active_subscription: activeSub ? formatSubscription(activeSub, today) : null,
    consistency,
    renewal,
    marked_attendance_today: markedToday,
    recent_attendance: activeSub ? buildRecentAttendance(attendanceDates, today, 7) : [],
  };
}

export async function getMemberDetail(db: AppDatabase, id: number) {
  const member = await findMemberById(db, id);
  if (!member) return null;

  const today = getIstDate();

  if (member.status === 'archived') {
    return {
      ...toProfile(member),
      active_subscription: null,
      consistency: null,
      renewal: null,
      marked_attendance_today: await hasAttendanceForDate(db, member.id, today),
    };
  }

  const enrichment = await computeMemberEnrichment(db, member.id, today);
  return { ...toProfile(member), ...enrichment };
}

export async function listMembers(db: AppDatabase, status: string) {
  const members = await listMembersByStatus(db, status);
  const today = getIstDate();

  if (status === 'archived') {
    return members.map(m => toProfile(m));
  }

  return Promise.all(members.map(async (m) => {
    const enrichment = await computeMemberEnrichment(db, m.id, today);
    return { ...toProfile(m), ...enrichment };
  }));
}

export async function createNewMember(db: AppDatabase, data: { full_name: string; email: string; phone: string }) {
  const today = getIstDate();
  const member = await repoCreateMember(db, { ...data, join_date: today });
  return toProfile(member);
}

export async function updateExistingMember(db: AppDatabase, id: number, data: { full_name?: string; phone?: string }) {
  const member = await repoUpdateMember(db, id, data);
  if (!member) return null;
  return toProfile(member);
}

export async function archiveMemberById(db: AppDatabase, id: number): Promise<{ error?: string }> {
  const member = await findMemberById(db, id);
  if (!member) return { error: 'Member not found' };
  if (member.status === 'archived') return { error: 'Member is already archived' };

  const today = getIstDate();
  const subs = await listSubscriptionsForMember(db, member.id);
  const hasActiveOrUpcoming = subs.some(s => {
    const state = deriveLifecycleState(s, today);
    return state === 'active' || state === 'upcoming';
  });

  if (hasActiveOrUpcoming) {
    return { error: 'Cannot archive member with active or upcoming subscriptions' };
  }

  await db.batch([
    { sql: `UPDATE members SET status = 'archived' WHERE id = ?`, params: [id] },
    { sql: `DELETE FROM user_sessions WHERE member_id = ?`, params: [id] },
  ]);
  return {};
}

export async function listFormattedSubscriptions(db: AppDatabase, memberId: number) {
  const subs = await listSubscriptionsForMember(db, memberId);
  const today = getIstDate();
  return subs.map(sub => formatSubscription(sub, today));
}
