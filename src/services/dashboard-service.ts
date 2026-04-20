import type { AppDatabase } from '../db/client.js';
import { listMembersByStatus } from '../repositories/members-repo.js';
import { hasAttendanceForDate, getMembersCheckedInOnDate } from '../repositories/sessions-repo.js';
import { addDays, getIstDate } from '../lib/date.js';
import { computeMemberEnrichment } from './member-service.js';

export async function getDashboard(db: AppDatabase) {
  const today = getIstDate();
  const yesterday = addDays(today, -1);
  const activeMembers = await listMembersByStatus(db, 'active');
  const archivedMembers = await listMembersByStatus(db, 'archived');

  const renewalNoActive: any[] = [];
  const renewalNearingEnd: any[] = [];
  const activeMembersList: any[] = [];
  const consistencyPipeline = {
    not_consistent: 0,
    building: 0,
    consistent: 0,
  };
  const atRisk = {
    total: 0,
    building: 0,
    consistent: 0,
  };
  let renewalDueCount = 0;
  let noActivePlanCount = 0;

  for (const member of activeMembers) {
    const enrichment = await computeMemberEnrichment(db, member.id, today);
    const ownerState = enrichment.owner_consistency_state;

    // Populate renewal sections
    if (enrichment.renewal?.kind === 'ends_soon') {
      renewalNearingEnd.push({
        member_id: member.id,
        full_name: member.full_name,
        status: member.status,
        active_subscription: enrichment.active_subscription,
        renewal: enrichment.renewal,
      });
      renewalDueCount += 1;
    }
    if (enrichment.renewal?.kind === 'no_active' || enrichment.renewal?.kind === 'starts_on') {
      renewalNoActive.push({
        member_id: member.id,
        full_name: member.full_name,
        status: member.status,
        renewal: enrichment.renewal,
      });
    }

    if (enrichment.active_subscription === null) {
      noActivePlanCount += 1;
    }

    if (ownerState?.stage === 'consistent') consistencyPipeline.consistent += 1;
    if (ownerState?.stage === 'building') consistencyPipeline.building += 1;
    if (ownerState?.stage === 'not_consistent') consistencyPipeline.not_consistent += 1;

    if (ownerState?.at_risk) {
      atRisk.total += 1;
      if (ownerState.stage === 'consistent') atRisk.consistent += 1;
      if (ownerState.stage === 'building') atRisk.building += 1;
    }

    activeMembersList.push({
      member_id: member.id,
      full_name: member.full_name,
      status: member.status,
      active_subscription: enrichment.active_subscription,
      consistency: enrichment.consistency,
      owner_consistency_state: enrichment.owner_consistency_state,
      consistency_risk_today: enrichment.consistency_risk_today,
      marked_attendance_today: enrichment.marked_attendance_today,
      renewal: enrichment.renewal,
    });
  }

  // Checked in today
  const checkedInRows = await getMembersCheckedInOnDate(db, today);
  const checkedInYesterday = await getMembersCheckedInOnDate(db, yesterday);
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
  const archivedList = await Promise.all(archivedMembers.map(async (m) => ({
    member_id: m.id,
    full_name: m.full_name,
    status: m.status,
    marked_attendance_today: await hasAttendanceForDate(db, m.id, today),
  })));

  return {
    attendance_summary: {
      present_today: checkedInToday.length,
      present_yesterday: checkedInYesterday.length,
      delta: checkedInToday.length - checkedInYesterday.length,
    },
    consistency_pipeline: consistencyPipeline,
    at_risk: atRisk,
    renewal_due_count: renewalDueCount,
    no_active_plan_count: noActivePlanCount,
    renewal_no_active: renewalNoActive,
    renewal_nearing_end: renewalNearingEnd,
    checked_in_today: checkedInToday,
    active_members: activeMembersList,
    archived_members: archivedList,
  };
}
