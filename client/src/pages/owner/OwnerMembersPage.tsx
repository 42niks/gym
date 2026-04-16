import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type MemberListItem, type OwnerMemberListView } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Icon from '../../components/Icon.js';
import Spinner from '../../components/Spinner.js';
import { ownerLinks } from './ownerLinks.js';

const ALL_VIEWS: OwnerMemberListView[] = [
  'all',
  'no-plan',
  'renewal',
  'at-risk',
  'building',
  'consistent',
  'today',
  'archived',
];

const VIEW_META: Record<OwnerMemberListView, {
  label: string;
  tabLabel: string;
  description: string;
  icon: string;
  emptyState: string;
}> = {
  all: {
    label: 'All',
    tabLabel: 'All',
    description: 'All non-archived members. This is the everyday roster with plans, consistency, and attendance.',
    icon: 'groups',
    emptyState: 'No members found',
  },
  'no-plan': {
    label: 'No Plan',
    tabLabel: 'No plan',
    description: 'Members who need a new plan or are waiting for an upcoming one to start.',
    icon: 'credit_card_off',
    emptyState: 'No members without an active subscription',
  },
  renewal: {
    label: 'Renewal',
    tabLabel: 'Renewal',
    description: 'Members whose current plan ends soon and do not yet have an upcoming renewal.',
    icon: 'notification_important',
    emptyState: 'No renewal alerts right now',
  },
  'at-risk': {
    label: 'At Risk',
    tabLabel: 'At risk',
    description: 'Members who should attend today to protect their current streak.',
    icon: 'warning',
    emptyState: 'No members are at immediate consistency risk today',
  },
  building: {
    label: 'Building',
    tabLabel: 'Building',
    description: 'Members with an active plan who are still building their rhythm.',
    icon: 'timeline',
    emptyState: 'No members are currently building consistency',
  },
  consistent: {
    label: 'Consistent',
    tabLabel: 'Consistent',
    description: 'Members currently meeting the attendance rhythm of their active package.',
    icon: 'moving',
    emptyState: 'No members are currently marked consistent',
  },
  today: {
    label: 'Today',
    tabLabel: 'Today',
    description: 'Members who have already marked attendance for the current day.',
    icon: 'today',
    emptyState: 'No members have checked in today',
  },
  archived: {
    label: 'Archived',
    tabLabel: 'Archived',
    description: 'Older member records kept separate from the everyday roster.',
    icon: 'archive',
    emptyState: 'No archived members',
  },
};

function isOwnerMemberListView(value: string | null): value is OwnerMemberListView {
  return value !== null && ALL_VIEWS.includes(value as OwnerMemberListView);
}

function resolveCurrentView(searchParams: URLSearchParams): OwnerMemberListView {
  const rawView = searchParams.get('view');
  if (rawView === 'active') return 'all';
  if (rawView === 'no-subscription') return 'no-plan';
  if (rawView === 'renewal-alert') return 'renewal';
  if (rawView === 'consistency-risk') return 'at-risk';
  if (rawView === 'not-consistent') return 'building';
  if (isOwnerMemberListView(rawView)) {
    return rawView;
  }

  return searchParams.get('status') === 'archived' ? 'archived' : 'all';
}

function formatJoinDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function getMemberHref(memberId: number, view: OwnerMemberListView) {
  return view === 'all' ? `/members/${memberId}` : `/members/${memberId}?view=${encodeURIComponent(view)}`;
}

function getViewLead(member: MemberListItem, view: OwnerMemberListView) {
  switch (view) {
    case 'no-plan':
      return member.renewal?.message ?? 'No active subscription yet.';
    case 'renewal':
      return member.renewal?.message ?? 'Needs renewal follow-up.';
    case 'at-risk':
      return member.consistency_risk_today?.message ?? null;
    case 'building':
      return member.consistency?.message ?? 'Still building consistency.';
    case 'consistent':
      return member.consistency?.message ?? null;
    case 'today':
      return member.consistency?.message ?? member.renewal?.message ?? 'Checked in today.';
    case 'all':
      return member.consistency?.message ?? member.renewal?.message ?? null;
    case 'archived':
      return null;
  }
}

function getMembershipSummary(member: MemberListItem) {
  if (member.active_subscription) {
    return {
      primary: `${member.active_subscription.remaining_sessions} left`,
      secondary: member.active_subscription.service_type,
      className: 'text-brand-600 dark:text-brand-300',
    };
  }

  if (member.renewal?.kind === 'starts_on' && member.renewal.upcoming_start_date) {
    return {
      primary: 'Starts soon',
      secondary: formatShortDate(member.renewal.upcoming_start_date),
      className: 'text-sky-700 dark:text-sky-300',
    };
  }

  return {
    primary: 'No plan',
    secondary: null,
    className: 'text-black/65 dark:text-white/75',
  };
}

function getViewBadge(member: MemberListItem, view: OwnerMemberListView) {
  switch (view) {
    case 'no-plan':
      return {
        label: member.renewal?.kind === 'starts_on' ? 'Upcoming' : 'No plan',
        className: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
      };
    case 'renewal':
      return {
        label: 'Renew soon',
        className: 'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300',
      };
    case 'at-risk':
      return {
        label: 'Attend today',
        className: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
      };
    case 'building':
      return {
        label: 'Building',
        className: 'border-stone-500/25 bg-stone-500/10 text-stone-700 dark:text-stone-300',
      };
    case 'consistent':
      return {
        label: member.consistency?.status === 'consistent' && member.consistency.days
          ? `${member.consistency.days}d streak`
          : 'Consistent',
        className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      };
    case 'today':
      return {
        label: 'In today',
        className: 'border-brand-500/25 bg-brand-500/10 text-brand-700 dark:text-brand-300',
      };
    default:
      return null;
  }
}

function BottomViewTabs({
  currentView,
  onSelect,
}: {
  currentView: OwnerMemberListView;
  onSelect: (view: OwnerMemberListView) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div
        className="mx-auto max-w-5xl px-3 sm:px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <div className="members-view-dock pointer-events-auto overflow-hidden rounded-[1.7rem] border border-black backdrop-blur-xl dark:border-white">
          <div className="members-view-tabs-scroll overflow-x-auto px-3 py-3">
            <div className="flex min-w-max gap-2">
              {ALL_VIEWS.map((view) => {
                const meta = VIEW_META[view];
                const active = view === currentView;

                return (
                  <div key={view} className="flex items-center gap-2">
                    {view === 'archived' ? (
                      <span aria-hidden="true" className="h-7 w-px shrink-0 rounded-full bg-gray-500/65 dark:bg-gray-300/55" />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onSelect(view)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2.5 font-label text-[0.7rem] font-bold italic uppercase tracking-[0.18em] transition-all ${
                        active
                          ? 'members-view-tab-active border-black bg-white text-black shadow-panel dark:border-white dark:text-white'
                          : 'members-view-tab-inactive border-black/15 text-black/70 hover:border-black/25 hover:text-black dark:border-white/15 dark:text-white/75 dark:hover:border-white/25 dark:hover:text-white'
                      }`}
                    >
                      <Icon name={meta.icon} className="text-[0.95rem]" />
                      {meta.tabLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OwnerMembersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = resolveCurrentView(searchParams);
  const currentMeta = VIEW_META[currentView];

  const { data: members = [], isLoading } = useQuery<MemberListItem[]>({
    queryKey: ['owner-members', currentView],
    queryFn: () => api.get(currentView === 'all'
      ? '/api/members'
      : `/api/members?view=${encodeURIComponent(currentView)}`),
  });

  function handleViewSelect(view: OwnerMemberListView) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('status');

    if (view === 'all') {
      nextParams.delete('view');
    } else {
      nextParams.set('view', view);
    }

    setSearchParams(nextParams);
  }

  return (
    <AppShell links={ownerLinks}>
      <div
        className="page-stack"
        style={{ paddingBottom: 'calc(8.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="page-title">MEMBERS</h2>
          <Link
            to="/members/new"
            className="owner-packages-cta-frame inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-black font-label text-[0.72rem] font-bold italic uppercase tracking-[0.18em] text-black shadow-panel transition-all hover:shadow-glow-brand dark:border-white dark:text-white"
          >
            <span aria-hidden="true" className="owner-packages-cta-surface brand-duotone-button-sm" />
            <span className="relative z-10 inline-flex h-full w-full items-center justify-center gap-1.5 rounded-[calc(9999px-1px)] px-3.5">
              <Icon name="add" className="text-[0.95rem]" />
              NEW
            </span>
          </Link>
        </div>

        <div className="px-1">
          <p className="section-eyebrow">Showing</p>
          <div className="mt-3 flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-black bg-white/80 shadow-sm shadow-black/5 dark:border-white dark:bg-white/[0.05]">
              <Icon name={currentMeta.icon} className="text-[1.25rem] text-black/80 dark:text-white/85" />
            </span>
            <div className="min-w-0">
              <h3 className="font-headline text-[2rem] font-black italic leading-[0.92] tracking-[-0.04em] text-black dark:text-white sm:text-[2.3rem]">
                {currentMeta.label}
              </h3>
              <p className="mt-2 max-w-[28rem] text-xs leading-snug text-black/60 dark:text-white/70">
                {currentMeta.description}
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : members.length === 0 ? (
          <div className="empty-state">{currentMeta.emptyState}</div>
        ) : currentView === 'archived' ? (
          <Card className="space-y-1.5 p-3">
            {members.map((member) => (
              <Link
                key={member.id}
                to={getMemberHref(member.id, currentView)}
                className="block rounded-2xl px-4 py-4 transition-all hover:bg-surface-raised/80 dark:hover:bg-surface-raised/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-black dark:text-white">{member.full_name}</p>
                    <p className="mt-0.5 break-all text-xs text-black/60 dark:text-white/70">{member.email}</p>
                    <p className="mt-0.5 text-xs text-black/60 dark:text-white/70">{member.phone}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-full border border-black/15 bg-black/[0.04] px-2.5 py-1 font-label text-[0.64rem] font-bold italic uppercase tracking-[0.16em] text-black/70 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/75">
                    Archived
                  </span>
                </div>
                <p className="mt-3 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-black/50 dark:text-white/50">
                  Joined {formatJoinDate(member.join_date)}
                </p>
              </Link>
            ))}
          </Card>
        ) : (
          <Card className="space-y-1.5 p-3">
            {members.map((member) => {
              const summary = getMembershipSummary(member);
              const lead = getViewLead(member, currentView);
              const badge = getViewBadge(member, currentView);

              return (
                <Link
                  key={member.id}
                  to={getMemberHref(member.id, currentView)}
                  className="flex items-center justify-between gap-4 rounded-2xl px-4 py-4 transition-all hover:bg-surface-raised/80 dark:hover:bg-surface-raised/60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-black dark:text-white">{member.full_name}</p>
                      {badge ? (
                        <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 font-label text-[0.64rem] font-bold italic uppercase tracking-[0.16em] ${badge.className}`}>
                          {badge.label}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-black/60 dark:text-white/70">{member.email}</p>
                    {lead ? (
                      <p className="mt-1 max-w-[15rem] text-xs leading-snug text-black/65 dark:text-white/75">
                        {lead}
                      </p>
                    ) : null}
                  </div>

                  <div className="ml-2 shrink-0 text-right">
                    <p className={`text-xs font-bold ${summary.className}`}>{summary.primary}</p>
                    {summary.secondary ? (
                      <p className="mt-0.5 text-xs text-black/60 dark:text-white/70">{summary.secondary}</p>
                    ) : null}
                    {member.marked_attendance_today ? (
                      <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-300">In today</p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </Card>
        )}
      </div>

      <BottomViewTabs currentView={currentView} onSelect={handleViewSelect} />
    </AppShell>
  );
}
