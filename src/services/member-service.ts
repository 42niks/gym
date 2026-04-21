import type { AppDatabase } from '../db/client.js';
import { findMemberById, listMembersByStatus, createMember as repoCreateMember, updateMember as repoUpdateMember, unarchiveMember as repoUnarchiveMember, type MemberRow } from '../repositories/members-repo.js';
import { listSubscriptionsForMember, getEarliestSubscriptionStart, type SubscriptionWithType } from '../repositories/subscriptions-repo.js';
import {
  listAttendanceDatesForMember,
  listAttendanceDatesForSubscription,
  hasAttendanceForDate,
} from '../repositories/sessions-repo.js';
import { deriveLifecycleState } from '../lib/subscription.js';
import { computeRenewal } from '../lib/renewal.js';
import { computeConsistency, computeConsistencyWindow } from '../lib/consistency.js';
import { addDays, diffDays, getIstDate } from '../lib/date.js';
import { findPackageById } from '../repositories/packages-repo.js';

export const MEMBER_LIST_VIEWS = [
  'all',
  'no-plan',
  'renewal',
  'at-risk',
  'not-consistent',
  'building',
  'consistent',
  'today',
  'archived',
] as const;

export type MemberListView = typeof MEMBER_LIST_VIEWS[number];

const LEGACY_MEMBER_LIST_VIEW_ALIASES = {
  active: 'all',
  'no-subscription': 'no-plan',
  'renewal-alert': 'renewal',
  'not-consistent': 'not-consistent',
  'consistency-risk': 'at-risk',
} as const satisfies Record<string, MemberListView>;

export interface MemberProfile {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  join_date: string;
  status: string;
  archived_at: string | null;
}

export interface ConsistencyRiskToday {
  streak_days: number;
  message: string;
}

interface OwnerConsistencyState {
  stage: 'consistent' | 'building' | 'not_consistent';
  days: number | null;
  at_risk: boolean;
}

interface OwnerConsistencyStage {
  stage: OwnerConsistencyState['stage'];
  days: number | null;
}

export interface OwnerStatusHighlight {
  key:
    | 'no_active_subscription'
    | 'upcoming_renewal'
    | 'consistency_at_risk'
    | 'consistency_building'
    | 'consistent';
  label: string;
  tone: 'neutral' | 'warning' | 'info' | 'success';
  detail: string | null;
}

export interface OwnerArchiveBlocker {
  subscription_id: number;
  service_type: string;
  lifecycle_state: 'active' | 'upcoming';
  start_date: string;
  end_date: string;
}

export interface OwnerArchiveAction {
  kind: 'archive' | 'unarchive';
  allowed: boolean;
  reason: string | null;
  blocked_by: OwnerArchiveBlocker[];
}

export function toProfile(m: MemberRow): MemberProfile {
  return {
    id: m.id,
    full_name: m.full_name,
    email: m.email,
    phone: m.phone,
    join_date: m.join_date,
    status: m.status,
    archived_at: m.archived_at,
  };
}

function sortMembersLexically<T extends { id: number; full_name: string }>(members: T[]) {
  return [...members].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, 'en', { sensitivity: 'base' }) || a.id - b.id
  );
}

export function isMemberListView(value: string): value is MemberListView {
  return MEMBER_LIST_VIEWS.includes(value as MemberListView);
}

export function normalizeMemberListView(value: string | null | undefined): MemberListView | null {
  if (!value) return null;
  if (isMemberListView(value)) return value;
  return LEGACY_MEMBER_LIST_VIEW_ALIASES[value as keyof typeof LEGACY_MEMBER_LIST_VIEW_ALIASES] ?? null;
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

function formatOwnerSubscription(sub: SubscriptionWithType, today: string) {
  const formatted = formatSubscription(sub, today);
  return {
    ...formatted,
    can_mark_complete: formatted.lifecycle_state === 'active' || formatted.lifecycle_state === 'upcoming',
    can_view_attendance: true,
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

function getArchiveBlockers(subs: SubscriptionWithType[], today: string): OwnerArchiveBlocker[] {
  return subs
    .map((sub) => {
      const lifecycleState = deriveLifecycleState(sub, today);
      if (lifecycleState !== 'active' && lifecycleState !== 'upcoming') return null;
      return {
        subscription_id: sub.id,
        service_type: sub.service_type,
        lifecycle_state: lifecycleState,
        start_date: sub.start_date,
        end_date: sub.end_date,
      };
    })
    .filter((value): value is OwnerArchiveBlocker => value !== null);
}

function buildStatusHighlights(input: {
  activeSubscription: ReturnType<typeof formatSubscription> | null;
  renewal: ReturnType<typeof computeRenewal>;
  consistency: ReturnType<typeof computeConsistency>;
  consistencyRiskToday: ConsistencyRiskToday | null;
}): OwnerStatusHighlight[] {
  const highlights: OwnerStatusHighlight[] = [];

  if (input.activeSubscription === null) {
    highlights.push({
      key: 'no_active_subscription',
      label: 'No active subscription',
      tone: 'neutral',
      detail: 'This member does not have an active subscription right now.',
    });
  }

  if (input.renewal?.kind === 'ends_soon') {
    highlights.push({
      key: 'upcoming_renewal',
      label: 'Upcoming renewal',
      tone: 'warning',
      detail: input.renewal.message,
    });
  }

  if (input.consistencyRiskToday) {
    highlights.push({
      key: 'consistency_at_risk',
      label: 'Consistency at risk',
      tone: 'warning',
      detail: input.consistencyRiskToday.message,
    });
  }

  if (input.consistency?.status === 'building') {
    highlights.push({
      key: 'consistency_building',
      label: 'Consistency building',
      tone: 'info',
      detail: input.consistency.message,
    });
  }

  if (input.consistency?.status === 'consistent') {
    highlights.push({
      key: 'consistent',
      label: 'Consistent',
      tone: 'success',
      detail: input.consistency.message,
    });
  }

  return highlights;
}

function buildArchiveAction(input: {
  memberStatus: string;
  blockers: OwnerArchiveBlocker[];
}): OwnerArchiveAction {
  if (input.memberStatus === 'archived') {
    return {
      kind: 'unarchive',
      allowed: true,
      reason: null,
      blocked_by: [],
    };
  }

  if (input.blockers.length > 0) {
    return {
      kind: 'archive',
      allowed: false,
      reason: 'Complete active or upcoming subscriptions before archiving this member.',
      blocked_by: input.blockers,
    };
  }

  return {
    kind: 'archive',
    allowed: true,
    reason: null,
    blocked_by: [],
  };
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

function countTrailingWindowAttendance(attendanceDates: string[], today: string, windowDays: number) {
  const attendanceSet = new Set(attendanceDates);
  let count = 0;

  for (let offset = 0; offset < windowDays; offset += 1) {
    if (attendanceSet.has(addDays(today, -offset))) {
      count += 1;
    }
  }

  return count;
}

function classifyOwnerConsistencyStage(input: {
  activeSubscription: ReturnType<typeof formatSubscription> | null;
  attendanceDates: string[];
  earliestSubscriptionStart: string | null;
  anchorDate: string;
  windowDays: number | null;
  minDays: number | null;
}): OwnerConsistencyStage | null {
  const {
    activeSubscription,
    attendanceDates,
    earliestSubscriptionStart,
    anchorDate,
    windowDays,
    minDays,
  } = input;

  if (
    activeSubscription === null
    || earliestSubscriptionStart === null
    || windowDays === null
    || minDays === null
  ) {
    return null;
  }

  const consistency = computeConsistency({
    hasActiveSubscription: true,
    windowDays,
    minDays,
    earliestSubscriptionStart,
    attendanceDates,
    today: anchorDate,
  });

  if (consistency?.status === 'consistent') {
    return {
      stage: 'consistent',
      days: consistency.days ?? null,
    };
  }

  if (diffDays(anchorDate, earliestSubscriptionStart) < windowDays) {
    return {
      stage: 'building',
      days: null,
    };
  }

  if (countTrailingWindowAttendance(attendanceDates, anchorDate, windowDays) === 0) {
    return {
      stage: 'not_consistent',
      days: null,
    };
  }

  return {
    stage: 'building',
    days: null,
  };
}

function computeAtRiskBySkippingToday(input: {
  markedToday: boolean;
  currentStage: OwnerConsistencyStage | null;
  activeSubscription: ReturnType<typeof formatSubscription> | null;
  attendanceDates: string[];
  earliestSubscriptionStart: string | null;
  today: string;
  windowDays: number | null;
  minDays: number | null;
}) {
  const {
    markedToday,
    currentStage,
    activeSubscription,
    attendanceDates,
    earliestSubscriptionStart,
    today,
    windowDays,
    minDays,
  } = input;

  if (markedToday) return false;
  if (!currentStage) return false;
  if (currentStage.stage !== 'consistent' && currentStage.stage !== 'building') return false;

  const simulatedAttendanceDates = attendanceDates.filter((date) => date !== today);
  const nextStageIfSkipToday = classifyOwnerConsistencyStage({
    activeSubscription,
    attendanceDates: simulatedAttendanceDates,
    earliestSubscriptionStart,
    anchorDate: addDays(today, 1),
    windowDays,
    minDays,
  });

  if (!nextStageIfSkipToday) return false;

  if (currentStage.stage === 'consistent' && nextStageIfSkipToday.stage === 'building') return true;
  if (currentStage.stage === 'building' && nextStageIfSkipToday.stage === 'not_consistent') return true;
  return false;
}

function buildOwnerConsistencyState(input: {
  ownerStage: OwnerConsistencyStage | null;
  atRisk: boolean;
}): OwnerConsistencyState | null {
  if (input.ownerStage === null) {
    return null;
  }

  return {
    stage: input.ownerStage.stage,
    days: input.ownerStage.days,
    at_risk: input.atRisk,
  };
}

function buildConsistencyRiskToday(input: {
  atRisk: boolean;
  ownerStage: OwnerConsistencyStage | null;
  consistencyWindow: ReturnType<typeof computeConsistencyWindow>;
  attendanceDates: string[];
  windowDays: number | null;
  today: string;
}): ConsistencyRiskToday | null {
  const { atRisk, ownerStage, consistencyWindow, attendanceDates, windowDays, today } = input;
  if (!atRisk || ownerStage === null) return null;

  const fallbackStreakDays = windowDays === null
    ? 1
    : Math.max(1, countTrailingWindowAttendance(attendanceDates, today, windowDays));
  const streakDays = ownerStage.stage === 'consistent'
    ? (consistencyWindow?.streak_days ?? fallbackStreakDays)
    : fallbackStreakDays;
  const message = ownerStage.stage === 'consistent'
    ? `Attend today to protect the ${streakDays}-day streak.`
    : 'Attend today to avoid dropping into not consistent tomorrow.';
  return {
    streak_days: streakDays,
    message,
  };
}

export async function computeMemberEnrichment(db: AppDatabase, memberId: number, today: string) {
  const subs = await listSubscriptionsForMember(db, memberId);
  const activeSub = getActiveSub(subs, today);
  const upcomingSubs = getUpcomingSubs(subs, today);
  const archiveBlockers = getArchiveBlockers(subs, today);
  const markedToday = await hasAttendanceForDate(db, memberId, today);
  const attendanceDates = await listAttendanceDatesForMember(db, memberId);

  let consistency = null;
  let consistencyWindow = null;
  let consistencyWindowDays: number | null = null;
  let consistencyMinDays: number | null = null;
  let earliestSubscriptionStart: string | null = null;
  if (activeSub) {
    const pkg = await findPackageById(db, activeSub.package_id, { includePrivate: true });
    if (pkg) {
      consistencyWindowDays = pkg.consistency_window_days;
      consistencyMinDays = pkg.consistency_min_days;
      earliestSubscriptionStart = (await getEarliestSubscriptionStart(db, memberId)) ?? null;
      const consistencyInput = {
        hasActiveSubscription: true,
        windowDays: pkg.consistency_window_days,
        minDays: pkg.consistency_min_days,
        earliestSubscriptionStart: earliestSubscriptionStart!,
        attendanceDates,
        today,
      };
      consistency = computeConsistency(consistencyInput);
      consistencyWindow = computeConsistencyWindow(consistencyInput);
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

  const activeSubscription = activeSub ? formatSubscription(activeSub, today) : null;
  const ownerStage = classifyOwnerConsistencyStage({
    activeSubscription,
    attendanceDates,
    earliestSubscriptionStart,
    anchorDate: today,
    windowDays: consistencyWindowDays,
    minDays: consistencyMinDays,
  });
  const atRisk = computeAtRiskBySkippingToday({
    markedToday,
    currentStage: ownerStage,
    activeSubscription,
    attendanceDates,
    earliestSubscriptionStart,
    today,
    windowDays: consistencyWindowDays,
    minDays: consistencyMinDays,
  });
  const consistencyRiskToday = buildConsistencyRiskToday({
    atRisk,
    ownerStage,
    consistencyWindow,
    attendanceDates,
    windowDays: consistencyWindowDays,
    today,
  });
  const ownerConsistencyState = buildOwnerConsistencyState({
    ownerStage,
    atRisk,
  });

  return {
    active_subscription: activeSubscription,
    consistency,
    consistency_window: consistencyWindow,
    consistency_risk_today: consistencyRiskToday,
    renewal,
    marked_attendance_today: markedToday,
    recent_attendance: activeSub ? buildRecentAttendance(attendanceDates, today, 7) : [],
    owner_consistency_state: ownerConsistencyState,
    status_highlights: buildStatusHighlights({
      activeSubscription,
      renewal,
      consistency,
      consistencyRiskToday,
    }),
    archive_action: buildArchiveAction({
      memberStatus: 'active',
      blockers: archiveBlockers,
    }),
    can_add_subscription: true,
    can_edit_profile: true,
  };
}

type ActiveMemberListItem = MemberProfile & Awaited<ReturnType<typeof computeMemberEnrichment>>;

function matchesMemberView(member: ActiveMemberListItem, view: Exclude<MemberListView, 'archived'>) {
  switch (view) {
    case 'all':
      return true;
    case 'no-plan':
      return member.active_subscription === null;
    case 'renewal':
      return member.renewal?.kind === 'ends_soon';
    case 'at-risk':
      return member.owner_consistency_state?.at_risk === true;
    case 'not-consistent':
      return member.owner_consistency_state?.stage === 'not_consistent';
    case 'building':
      return member.owner_consistency_state?.stage === 'building'
        || (member.owner_consistency_state === null
          && member.active_subscription !== null
          && member.consistency?.status !== 'consistent');
    case 'consistent':
      return member.consistency?.status === 'consistent';
    case 'today':
      return member.marked_attendance_today;
  }
}

export async function getMemberDetail(db: AppDatabase, id: number) {
  const member = await findMemberById(db, id);
  if (!member) return null;

  const today = getIstDate();

  if (member.status === 'archived') {
    const markedToday = await hasAttendanceForDate(db, member.id, today);
    return {
      ...toProfile(member),
      active_subscription: null,
      consistency: null,
      renewal: null,
      consistency_risk_today: null,
      marked_attendance_today: markedToday,
      owner_consistency_state: null,
      status_highlights: buildStatusHighlights({
        activeSubscription: null,
        renewal: null,
        consistency: null,
        consistencyRiskToday: null,
      }),
      archive_action: buildArchiveAction({
        memberStatus: 'archived',
        blockers: [],
      }),
      can_add_subscription: false,
      can_edit_profile: true,
    };
  }

  const enrichment = await computeMemberEnrichment(db, member.id, today);
  return { ...toProfile(member), ...enrichment };
}

export async function listMembers(db: AppDatabase, view: MemberListView) {
  const status = view === 'archived' ? 'archived' : 'active';
  const members = await listMembersByStatus(db, status);
  const today = getIstDate();

  if (view === 'archived') {
    return sortMembersLexically(members.map(m => toProfile(m)));
  }

  const enrichedMembers = await Promise.all(members.map(async (m) => {
    const enrichment = await computeMemberEnrichment(db, m.id, today);
    return { ...toProfile(m), ...enrichment };
  }));

  return sortMembersLexically(enrichedMembers.filter(member => matchesMemberView(member, view)));
}

export async function createNewMember(db: AppDatabase, data: { full_name: string; email: string; phone: string; join_date: string }) {
  const member = await repoCreateMember(db, data);
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
  if (today < member.join_date) {
    return { error: 'Cannot archive member before their join date' };
  }
  const subs = await listSubscriptionsForMember(db, member.id);
  const hasActiveOrUpcoming = subs.some(s => {
    const state = deriveLifecycleState(s, today);
    return state === 'active' || state === 'upcoming';
  });

  if (hasActiveOrUpcoming) {
    return { error: 'Cannot archive member with active or upcoming subscriptions. Mark relevant subscriptions complete first.' };
  }

  await db.batch([
    { sql: `UPDATE members SET status = 'archived', archived_at = ? WHERE id = ?`, params: [today, id] },
    { sql: `DELETE FROM user_sessions WHERE member_id = ?`, params: [id] },
  ]);
  return {};
}

export async function unarchiveMemberById(db: AppDatabase, id: number): Promise<{ error?: string }> {
  const member = await findMemberById(db, id);
  if (!member) return { error: 'Member not found' };
  if (member.status === 'active') return { error: 'Member is already active' };
  await repoUnarchiveMember(db, id);
  return {};
}

export async function listFormattedSubscriptions(db: AppDatabase, memberId: number) {
  const subs = await listSubscriptionsForMember(db, memberId);
  const today = getIstDate();
  return subs.map(sub => formatOwnerSubscription(sub, today));
}

export async function getFormattedSubscriptionAttendance(
  db: AppDatabase,
  memberId: number,
  subscriptionId: number,
) {
  const subs = await listSubscriptionsForMember(db, memberId);
  const today = getIstDate();
  const subscription = subs.find(sub => sub.id === subscriptionId);

  if (!subscription) return null;
  const pkg = await findPackageById(db, subscription.package_id, { includePrivate: true });

  if (!pkg) return null;

  const attendedDates = await listAttendanceDatesForSubscription(db, memberId, subscriptionId);
  const consistencyAnchorDay = today > subscription.end_date ? subscription.end_date : today;
  const consistencyWindow = computeConsistencyWindow({
    hasActiveSubscription: true,
    windowDays: pkg.consistency_window_days,
    minDays: pkg.consistency_min_days,
    earliestSubscriptionStart: subscription.start_date,
    attendanceDates: attendedDates,
    today: consistencyAnchorDay,
  });

  return {
    subscription: formatSubscription(subscription, today),
    consistency_rule: {
      min_days: pkg.consistency_min_days,
      window_days: pkg.consistency_window_days,
    },
    consistency_window: consistencyWindow,
    attended_dates: attendedDates,
    can_edit_dates: true,
    editable_start_date: subscription.start_date,
    editable_end_date: subscription.end_date,
    can_mark_complete: deriveLifecycleState(subscription, today) !== 'completed',
  };
}
