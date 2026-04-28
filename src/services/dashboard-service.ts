import type { AppDatabase } from '../db/client.js';
import { addDays, getIstDate } from '../lib/date.js';
import { loadOwnerMemberSnapshot, type OwnerMemberSnapshot } from './member-service.js';

export interface OwnerHomeMetrics {
  attendance_summary?: {
    present_today: number;
    present_yesterday: number;
    delta: number;
  };
  consistency_pipeline?: {
    not_consistent: number;
    building: number;
    consistent: number;
  };
  at_risk?: {
    total: number;
    building: number;
    consistent: number;
  };
  renewal_due_count?: number;
  no_active_plan_count?: number;
}

export type OwnerHomeMetricSection = 'attendance' | 'consistency' | 'renewals';

export const OWNER_HOME_METRIC_SECTIONS: OwnerHomeMetricSection[] = [
  'attendance',
  'consistency',
  'renewals',
];

function includesSection(sections: ReadonlySet<OwnerHomeMetricSection>, section: OwnerHomeMetricSection) {
  return sections.has(section);
}

function buildDashboardMetrics(
  snapshot: OwnerMemberSnapshot,
  sections: OwnerHomeMetricSection[] = OWNER_HOME_METRIC_SECTIONS,
): OwnerHomeMetrics {
  const today = snapshot.today;
  const yesterday = addDays(today, -1);
  const requestedSections = new Set(sections);

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

  for (const member of snapshot.activeMembers) {
    const ownerState = member.owner_consistency_state;

    if (member.renewal?.kind === 'ends_soon') {
      renewalDueCount += 1;
    }

    if (member.active_subscription === null) {
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

  }

  const activeMemberIds = new Set(snapshot.activeMembers.map((member) => member.id));
  const presentToday = new Set(
    snapshot.attendanceRows
      .filter((row) => row.date === today && activeMemberIds.has(row.member_id))
      .map((row) => row.member_id),
  );
  const presentYesterday = new Set(
    snapshot.attendanceRows
      .filter((row) => row.date === yesterday && activeMemberIds.has(row.member_id))
      .map((row) => row.member_id),
  );

  const metrics: OwnerHomeMetrics = {};

  if (includesSection(requestedSections, 'attendance')) {
    metrics.attendance_summary = {
      present_today: presentToday.size,
      present_yesterday: presentYesterday.size,
      delta: presentToday.size - presentYesterday.size,
    };
  }

  if (includesSection(requestedSections, 'consistency')) {
    metrics.consistency_pipeline = consistencyPipeline;
    metrics.at_risk = atRisk;
  }

  if (includesSection(requestedSections, 'renewals')) {
    metrics.renewal_due_count = renewalDueCount;
    metrics.no_active_plan_count = noActivePlanCount;
  }

  return metrics;
}

export async function getDashboardMetrics(
  db: AppDatabase,
  sections: OwnerHomeMetricSection[] = OWNER_HOME_METRIC_SECTIONS,
): Promise<OwnerHomeMetrics> {
  return buildDashboardMetrics(await loadOwnerMemberSnapshot(db), sections);
}

export async function getDashboard(db: AppDatabase) {
  const today = getIstDate();
  const snapshot = await loadOwnerMemberSnapshot(db, today);
  const metrics = buildDashboardMetrics(snapshot);

  const renewalNoActive: any[] = [];
  const renewalNearingEnd: any[] = [];
  const activeMembersList: any[] = [];

  for (const member of snapshot.activeMembers) {
    if (member.renewal?.kind === 'ends_soon') {
      renewalNearingEnd.push({
        member_id: member.id,
        full_name: member.full_name,
        status: member.status,
        active_subscription: member.active_subscription,
        renewal: member.renewal,
      });
    }
    if (member.renewal?.kind === 'no_active' || member.renewal?.kind === 'starts_on') {
      renewalNoActive.push({
        member_id: member.id,
        full_name: member.full_name,
        status: member.status,
        renewal: member.renewal,
      });
    }

    activeMembersList.push({
      member_id: member.id,
      full_name: member.full_name,
      status: member.status,
      active_subscription: member.active_subscription,
      consistency: member.consistency,
      owner_consistency_state: member.owner_consistency_state,
      consistency_risk_today: member.consistency_risk_today,
      marked_attendance_today: member.marked_attendance_today,
      renewal: member.renewal,
    });
  }

  const checkedInToday = activeMembersList
    .filter((member) => member.marked_attendance_today)
    .map((member) => ({
      member_id: member.member_id,
      full_name: member.full_name,
      marked_attendance_today: true,
      consistency: member.consistency,
    }));

  const archivedList = snapshot.archivedMembers.map((member) => ({
    member_id: member.id,
    full_name: member.full_name,
    status: member.status,
    marked_attendance_today: member.marked_attendance_today,
  }));

  return {
    attendance_summary: metrics.attendance_summary!,
    consistency_pipeline: metrics.consistency_pipeline!,
    at_risk: metrics.at_risk!,
    renewal_due_count: metrics.renewal_due_count!,
    no_active_plan_count: metrics.no_active_plan_count!,
    renewal_no_active: renewalNoActive,
    renewal_nearing_end: renewalNearingEnd,
    checked_in_today: checkedInToday,
    active_members: activeMembersList,
    archived_members: archivedList,
  };
}
