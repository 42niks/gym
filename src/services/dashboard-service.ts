import Database from 'better-sqlite3';
import { listMembersByStatus, type MemberRow } from '../repositories/members-repo.js';
import { listSubscriptionsForMember, getEarliestSubscriptionStart } from '../repositories/subscriptions-repo.js';
import { listAttendanceDatesForMember, hasAttendanceForDate, getMembersCheckedInToday } from '../repositories/sessions-repo.js';
import { findPackageById } from '../repositories/packages-repo.js';
import { deriveLifecycleState } from '../lib/subscription.js';
import { computeRenewal } from '../lib/renewal.js';
import { computeConsistency } from '../lib/consistency.js';
import { getIstDate } from '../lib/date.js';
import { formatSubscription, getActiveSub, getUpcomingSubs } from './member-service.js';

export function getDashboard(db: Database.Database) {
  const today = getIstDate();
  const activeMembers = listMembersByStatus(db, 'active');
  const archivedMembers = listMembersByStatus(db, 'archived');

  const renewalNoActive: any[] = [];
  const renewalNearingEnd: any[] = [];
  const activeMembersList: any[] = [];

  for (const member of activeMembers) {
    const subs = listSubscriptionsForMember(db, member.id);
    const activeSub = getActiveSub(subs, today);
    const upcomingSubs = getUpcomingSubs(subs, today);
    const markedToday = hasAttendanceForDate(db, member.id, today);

    let consistency = null;
    if (activeSub) {
      const pkg = findPackageById(db, activeSub.package_id);
      if (pkg) {
        const earliest = getEarliestSubscriptionStart(db, member.id);
        const attendanceDates = listAttendanceDatesForMember(db, member.id);
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

    const formattedSub = activeSub ? formatSubscription(activeSub, today) : null;

    // Populate renewal sections
    if (renewal?.kind === 'ends_soon') {
      renewalNearingEnd.push({
        member_id: member.id,
        full_name: member.full_name,
        status: member.status,
        active_subscription: formattedSub,
        renewal,
      });
    }
    if (renewal?.kind === 'no_active' || renewal?.kind === 'starts_on') {
      renewalNoActive.push({
        member_id: member.id,
        full_name: member.full_name,
        status: member.status,
        renewal,
      });
    }

    activeMembersList.push({
      member_id: member.id,
      full_name: member.full_name,
      status: member.status,
      active_subscription: formattedSub,
      consistency,
      marked_attendance_today: markedToday,
    });
  }

  // Checked in today
  const checkedInRows = getMembersCheckedInToday(db, today);
  const checkedInToday: any[] = [];
  for (const row of checkedInRows) {
    const memberEntry = activeMembersList.find(m => m.member_id === row.member_id);
    if (memberEntry) {
      checkedInToday.push({
        member_id: memberEntry.member_id,
        full_name: memberEntry.full_name,
        marked_attendance_today: true,
        consistency: memberEntry.consistency,
      });
    }
  }

  // Archived members
  const archivedList = archivedMembers.map(m => ({
    member_id: m.id,
    full_name: m.full_name,
    status: m.status,
    marked_attendance_today: hasAttendanceForDate(db, m.id, today),
  }));

  return {
    renewal_no_active: renewalNoActive,
    renewal_nearing_end: renewalNearingEnd,
    checked_in_today: checkedInToday,
    active_members: activeMembersList,
    archived_members: archivedList,
  };
}
