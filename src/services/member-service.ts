import Database from 'better-sqlite3';
import { findMemberById, listMembersByStatus, createMember as repoCreateMember, updateMember as repoUpdateMember, archiveMember as repoArchiveMember, type MemberRow } from '../repositories/members-repo.js';
import { listSubscriptionsForMember, getEarliestSubscriptionStart, type SubscriptionWithType } from '../repositories/subscriptions-repo.js';
import { listAttendanceDatesForMember, hasAttendanceForDate } from '../repositories/sessions-repo.js';
import { deleteAllSessionsForMember } from '../repositories/user-sessions-repo.js';
import { deriveLifecycleState } from '../lib/subscription.js';
import { computeRenewal } from '../lib/renewal.js';
import { computeConsistency } from '../lib/consistency.js';
import { getIstDate } from '../lib/date.js';
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

export function computeMemberEnrichment(db: Database.Database, memberId: number, today: string) {
  const subs = listSubscriptionsForMember(db, memberId);
  const activeSub = getActiveSub(subs, today);
  const upcomingSubs = getUpcomingSubs(subs, today);
  const markedToday = hasAttendanceForDate(db, memberId, today);

  let consistency = null;
  if (activeSub) {
    const pkg = findPackageById(db, activeSub.package_id);
    if (pkg) {
      const earliest = getEarliestSubscriptionStart(db, memberId);
      const attendanceDates = listAttendanceDatesForMember(db, memberId);
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
  };
}

export function getMemberDetail(db: Database.Database, id: number) {
  const member = findMemberById(db, id);
  if (!member) return null;

  const today = getIstDate();

  if (member.status === 'archived') {
    return {
      ...toProfile(member),
      active_subscription: null,
      consistency: null,
      renewal: null,
      marked_attendance_today: hasAttendanceForDate(db, member.id, today),
    };
  }

  const enrichment = computeMemberEnrichment(db, member.id, today);
  return { ...toProfile(member), ...enrichment };
}

export function listMembers(db: Database.Database, status: string) {
  const members = listMembersByStatus(db, status);
  const today = getIstDate();

  if (status === 'archived') {
    return members.map(m => toProfile(m));
  }

  return members.map(m => {
    const enrichment = computeMemberEnrichment(db, m.id, today);
    return { ...toProfile(m), ...enrichment };
  });
}

export function createNewMember(db: Database.Database, data: { full_name: string; email: string; phone: string }) {
  const today = getIstDate();
  const member = repoCreateMember(db, { ...data, join_date: today });
  return toProfile(member);
}

export function updateExistingMember(db: Database.Database, id: number, data: { full_name?: string; phone?: string }) {
  const member = repoUpdateMember(db, id, data);
  if (!member) return null;
  return toProfile(member);
}

export function archiveMemberById(db: Database.Database, id: number): { error?: string } {
  const member = findMemberById(db, id);
  if (!member) return { error: 'Member not found' };
  if (member.status === 'archived') return { error: 'Member is already archived' };

  const today = getIstDate();
  const subs = listSubscriptionsForMember(db, member.id);
  const hasActiveOrUpcoming = subs.some(s => {
    const state = deriveLifecycleState(s, today);
    return state === 'active' || state === 'upcoming';
  });

  if (hasActiveOrUpcoming) {
    return { error: 'Cannot archive member with active or upcoming subscriptions' };
  }

  const doArchive = db.transaction(() => {
    repoArchiveMember(db, id);
    deleteAllSessionsForMember(db, id);
  });
  doArchive();
  return {};
}

export function getGroupedSubscriptions(db: Database.Database, memberId: number) {
  const subs = listSubscriptionsForMember(db, memberId);
  const today = getIstDate();

  const completedAndActive: any[] = [];
  const upcoming: any[] = [];

  for (const sub of subs) {
    const formatted = formatSubscription(sub, today);
    if (formatted.lifecycle_state === 'upcoming') {
      upcoming.push(formatted);
    } else {
      completedAndActive.push(formatted);
    }
  }

  // completed_and_active: active first, then completed by start_date DESC, id DESC
  completedAndActive.sort((a, b) => {
    if (a.lifecycle_state === 'active' && b.lifecycle_state !== 'active') return -1;
    if (b.lifecycle_state === 'active' && a.lifecycle_state !== 'active') return 1;
    return b.start_date.localeCompare(a.start_date) || b.id - a.id;
  });

  // upcoming: start_date ASC, id ASC
  upcoming.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id);

  return { completed_and_active: completedAndActive, upcoming };
}
