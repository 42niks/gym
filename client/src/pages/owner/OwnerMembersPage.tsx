import { useEffect, useLayoutEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type MemberListItem, type OwnerMemberListView, type OwnerMemberOverview } from '../../lib/api.js';
import Card from '../../components/Card.js';
import Icon from '../../components/Icon.js';
import MemberStatusPill, { type MemberStatusPillSpec } from '../../components/MemberStatusPill.js';
import Spinner from '../../components/Spinner.js';
import { formatFullDate } from '../../components/attendance/AttendanceCalendar.js';

const ALL_VIEWS: OwnerMemberListView[] = [
  'all',
  'no-plan',
  'renewal',
  'at-risk',
  'not-consistent',
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
    label: 'All Active',
    tabLabel: 'All',
    description: 'All members (excluding archived)',
    icon: 'view_cozy',
    emptyState: 'No members found',
  },
  'no-plan': {
    label: 'No Active Plan',
    tabLabel: 'No plan',
    description: 'Members who need a new plan or are waiting for an upcoming one to start.',
    icon: 'credit_card_off',
    emptyState: 'No members without an active subscription',
  },
  renewal: {
    label: 'Upcoming Renewal',
    tabLabel: 'Renewal',
    description: 'Members whose current plan ends soon and do not yet have an upcoming subscription.',
    icon: 'notification_important',
    emptyState: 'No renewal alerts right now',
  },
  'at-risk': {
    label: 'Consistency At Risk',
    tabLabel: 'At risk',
    description: 'Members who should attend today to protect their current streak.',
    icon: 'warning',
    emptyState: 'No members are at immediate consistency risk today',
  },
  'not-consistent': {
    label: 'Not Consistent',
    tabLabel: 'Not consistent',
    description: 'Members with an active plan who are currently out of consistency habit.',
    icon: 'block',
    emptyState: 'No members are currently in the not consistent state',
  },
  building: {
    label: 'Building Consistency',
    tabLabel: 'Building',
    description: 'Members with an active plan who are still building their rhythm.',
    icon: 'timeline',
    emptyState: 'No members are currently building consistency',
  },
  consistent: {
    label: 'Consistent',
    tabLabel: 'Consistent',
    description: 'Members currently meeting the consistency rule of their active package.',
    icon: 'moving',
    emptyState: 'No members are currently marked consistent',
  },
  today: {
    label: 'Marked Today',
    tabLabel: 'Today',
    description: 'Members who have marked their attendance for the current day.',
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

const PACKAGE_ICON_META = [
  { match: '1:1 personal training', icon: 'person' },
  { match: 'group personal training', icon: 'groups' },
  { match: 'mma/kickboxing personal training', icon: 'sports_mma' },
  { match: 'boxing', icon: 'sports_mma' },
] as const;

const MEMBER_CARD_CLASS = 'member-list-card rounded-2xl border border-zinc-300 bg-white/55 px-4 py-4 shadow-sm shadow-black/5 transition-all hover:border-zinc-400 hover:bg-white/72 active:translate-y-px active:scale-[0.99] dark:border-zinc-600 dark:bg-black/20 dark:hover:border-zinc-500 dark:hover:bg-black/28';

type MemberPill = MemberStatusPillSpec;

function isOwnerMemberListView(value: string | null): value is OwnerMemberListView {
  return value !== null && ALL_VIEWS.includes(value as OwnerMemberListView);
}

function resolveCurrentView(searchParams: URLSearchParams): OwnerMemberListView {
  const rawView = searchParams.get('view');
  if (isOwnerMemberListView(rawView)) {
    return rawView;
  }

  return searchParams.get('status') === 'archived' ? 'archived' : 'all';
}

function parseDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(candidate.getTime())
    || candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function toUtcDate(value: string) {
  const parts = parseDateParts(value);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function getIstTodayDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function diffUtcDays(start: string, end: string) {
  const startDate = toUtcDate(start);
  const endDate = toUtcDate(end);
  if (!startDate || !endDate) return 0;
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
}

function formatArchivedDate(value: string | null) {
  if (!value) return 'Archived date unavailable';
  return `Archived ${formatFullDate(value)}`;
}

function formatArchivedAge(value: string | null) {
  if (!value) return null;
  const daysSinceArchive = Math.max(0, diffUtcDays(value, getIstTodayDateString()));
  return `${daysSinceArchive}d ago`;
}

function getMemberHref(memberId: number, view: OwnerMemberListView) {
  return view === 'all' ? `/members/${memberId}` : `/members/${memberId}?view=${encodeURIComponent(view)}`;
}

function getMembersOverviewEndpoint(view: OwnerMemberListView) {
  return view === 'all'
    ? '/api/members/overview'
    : `/api/members/overview?view=${encodeURIComponent(view)}`;
}

function getPackageIcon(serviceType: string | null | undefined) {
  if (!serviceType) return 'credit_card_off';
  const normalized = serviceType.trim().toLowerCase();
  return PACKAGE_ICON_META.find((item) => normalized.includes(item.match))?.icon ?? 'inventory_2';
}

function getViewIconToneClass(view: OwnerMemberListView) {
  if (view === 'at-risk' || view === 'renewal') return 'text-orange-700 dark:text-orange-300';
  if (view === 'consistent' || view === 'building') return 'text-brand-600 dark:text-brand-300';
  if (view === 'not-consistent' || view === 'no-plan') return 'text-black/70 dark:text-white/75';
  return 'text-black/80 dark:text-white/85';
}

function buildAllConsistencyPills(member: MemberListItem): MemberPill[] {
  const pills: MemberPill[] = [];
  const ownerStage = member.owner_consistency_state?.stage;
  const fallbackStage = member.consistency?.status === 'consistent'
    ? 'consistent'
    : member.consistency?.status === 'building'
      ? 'building'
      : null;
  const stage = ownerStage ?? fallbackStage;
  const atRisk = member.owner_consistency_state?.at_risk ?? (member.consistency_risk_today !== null);

  if (stage === 'consistent') {
    pills.push({ key: 'consistent', label: 'Consistent', icon: 'moving' });
  } else if (stage === 'building') {
    pills.push({ key: 'building', label: 'Building', icon: 'timeline' });
  } else if (stage === 'not_consistent') {
    pills.push({ key: 'not-consistent', label: 'Not Consistent', icon: 'block' });
  }

  if (atRisk) {
    pills.push({ key: 'at-risk', label: 'At Risk', icon: 'warning', tone: 'warning' });
  }

  pills.push({
    key: 'today',
    label: member.marked_attendance_today ? 'In Today' : 'Not In Today',
    icon: 'today',
    tone: member.marked_attendance_today ? 'default' : 'neutral',
  });

  return pills;
}

function buildAllSubscriptionPills(member: MemberListItem): MemberPill[] {
  const pills: MemberPill[] = [
    member.active_subscription
      ? { key: 'active', label: 'Active', icon: 'bolt' }
      : { key: 'no-plan', label: 'No Plan', icon: 'credit_card_off', tone: 'neutral' },
  ];

  if (member.renewal?.kind === 'ends_soon') {
    pills.push({ key: 'renewal', label: 'Renewal', icon: 'notification_important', tone: 'warning' });
  }

  return pills;
}

function MemberPillCluster({
  pills,
  className = '',
}: {
  pills: MemberPill[];
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {pills.map((pill) => (
        <MemberStatusPill key={pill.key} pill={pill} />
      ))}
    </div>
  );
}

function BottomViewTabs({
  currentView,
  counts,
  onSelect,
}: {
  currentView: OwnerMemberListView;
  counts: Partial<Record<OwnerMemberListView, number>>;
  onSelect: (view: OwnerMemberListView) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const tabRefMap = useRef<Partial<Record<OwnerMemberListView, HTMLButtonElement | null>>>({});
  const didInitScroll = useRef(false);
  const previousScrollView = useRef<OwnerMemberListView | null>(null);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const scrollEl = scrollRef.current;
      const activeTab = tabRefMap.current[currentView];
      if (!scrollEl || !activeTab) return;

      const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
      if (maxScrollLeft <= 0) return;

      const activeIndex = ALL_VIEWS.indexOf(currentView);
      const isFirst = activeIndex === 0;
      const isLast = activeIndex === ALL_VIEWS.length - 1;

      let targetScrollLeft: number;
      if (isFirst) {
        targetScrollLeft = 0;
      } else if (isLast) {
        targetScrollLeft = maxScrollLeft;
      } else {
        const scrollRect = scrollEl.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();
        const tabCenterInScroll = scrollEl.scrollLeft + (tabRect.left - scrollRect.left) + (tabRect.width / 2);
        targetScrollLeft = tabCenterInScroll - (scrollEl.clientWidth / 2);
      }

      const clamped = Math.max(0, Math.min(maxScrollLeft, targetScrollLeft));
      const previousView = previousScrollView.current;
      const viewChanged = previousView !== null && previousView !== currentView;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      previousScrollView.current = currentView;

      if (!didInitScroll.current || !viewChanged || reduceMotion) {
        scrollEl.scrollLeft = clamped;
        didInitScroll.current = true;
        return;
      }

      scrollEl.scrollTo({ left: clamped, behavior: 'smooth' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentView]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div
        className="mx-auto max-w-5xl px-3 sm:px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <div className="members-view-dock pointer-events-auto overflow-hidden rounded-[1.7rem] border border-black backdrop-blur-xl dark:border-white">
          <div ref={scrollRef} className="members-view-tabs-scroll overflow-x-auto px-3 py-3">
            <div className="flex min-w-max gap-2">
              {ALL_VIEWS.map((view) => {
                const meta = VIEW_META[view];
                const active = view === currentView;
                const count = counts[view];

                return (
                  <div key={view} className="flex items-center gap-2">
                    {view === 'archived' ? (
                      <span aria-hidden="true" className="h-7 w-px shrink-0 rounded-full bg-gray-500/65 dark:bg-gray-300/55" />
                    ) : null}
                    <button
                      ref={(element) => {
                        tabRefMap.current[view] = element;
                      }}
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
                      <span
                        aria-hidden={typeof count !== 'number'}
                        className={`inline-block min-w-[3.75ch] text-right text-[0.68rem] tabular-nums tracking-[0.12em] opacity-70 ${
                          typeof count === 'number' ? '' : 'invisible'
                        }`}
                      >
                        {typeof count === 'number' ? count : ''}
                      </span>
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

  const { data: overview, isLoading } = useQuery<OwnerMemberOverview>({
    queryKey: ['owner-members-overview', currentView],
    queryFn: () => api.get(getMembersOverviewEndpoint(currentView)),
  });

  const members = overview?.members ?? [];
  const memberCounts = overview?.counts ?? {};
  const resolvedMemberCounts = isLoading
    ? memberCounts
    : { ...memberCounts, [currentView]: members.length };

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
    <>
      <div
        className="page-stack"
        style={{ paddingBottom: 'calc(8.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-start justify-between gap-3">
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
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-black bg-white/80 shadow-sm shadow-black/5 dark:border-white dark:bg-white/[0.05]">
              <Icon name={currentMeta.icon} className={`text-[1.25rem] ${getViewIconToneClass(currentView)}`} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 flex-1 font-headline text-[2rem] font-black italic leading-[0.92] tracking-[-0.04em] text-black dark:text-white sm:text-[2.3rem]">
                  {currentMeta.label}
                </h3>
                <span className="shrink-0 text-right font-headline text-[2rem] font-black italic leading-[0.92] tracking-[-0.04em] text-black dark:text-white sm:text-[2.3rem]">
                  {members.length}
                </span>
              </div>
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
            {members.map((member) => {
              const archivedAge = formatArchivedAge(member.archived_at);

              return (
                <Link
                  key={member.id}
                  to={getMemberHref(member.id, currentView)}
                  className={`block ${MEMBER_CARD_CLASS}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-black dark:text-white">{member.full_name}</p>
                      <p className="mt-2 text-sm text-black/70 dark:text-white/75">
                        {formatArchivedDate(member.archived_at)}
                      </p>
                      {archivedAge ? (
                        <p className="mt-1 text-[0.72rem] font-label font-bold italic tracking-[0.08em] text-black/50 dark:text-white/55">
                          {archivedAge}
                        </p>
                      ) : null}
                    </div>
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-black bg-white/80 shadow-sm shadow-black/5 dark:border-white dark:bg-white/[0.05]">
                      <Icon name="archive" className="text-[1.1rem] text-black/80 dark:text-white/85" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </Card>
        ) : (
          <Card className="space-y-1.5 p-3">
            {members.map((member) => {
              const consistencyPills = buildAllConsistencyPills(member);
              const subscriptionPills = buildAllSubscriptionPills(member);
              const todayPill = consistencyPills.find((pill) => pill.key === 'today');
              const headlineConsistencyPills = consistencyPills.filter((pill) => pill.key !== 'today');
              const topConsistencyPills = headlineConsistencyPills.length > 0
                ? headlineConsistencyPills
                : todayPill
                  ? [todayPill]
                  : [];
              const bottomConsistencyPills = headlineConsistencyPills.length > 0 && todayPill ? [todayPill] : [];
              const topSubscriptionPills = subscriptionPills.slice(0, 1);
              const bottomSubscriptionPills = subscriptionPills.slice(1);

              return (
                <Link
                  key={member.id}
                  to={getMemberHref(member.id, currentView)}
                  className={`block ${MEMBER_CARD_CLASS}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <p className="min-w-0 flex-1 pr-2 text-lg font-bold text-black dark:text-white">{member.full_name}</p>
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-black bg-white/80 shadow-sm shadow-black/5 dark:border-white dark:bg-white/[0.05]">
                        <Icon
                          name={getPackageIcon(member.active_subscription?.service_type)}
                          className="text-[1.25rem] text-black/80 dark:text-white/85"
                        />
                      </span>
                    </div>
                    <div className="space-y-2">
                      {(topConsistencyPills.length > 0 || topSubscriptionPills.length > 0) ? (
                        <div className="flex items-start justify-between gap-3">
                          {topConsistencyPills.length > 0 ? (
                            <MemberPillCluster pills={topConsistencyPills} className="min-w-0 flex-1" />
                          ) : (
                            <div className="min-w-0 flex-1" />
                          )}
                          {topSubscriptionPills.length > 0 ? (
                            <MemberPillCluster pills={topSubscriptionPills} className="shrink-0 justify-end" />
                          ) : null}
                        </div>
                      ) : null}
                      {(bottomConsistencyPills.length > 0 || bottomSubscriptionPills.length > 0) ? (
                        <div className="flex items-start justify-between gap-3">
                          {bottomConsistencyPills.length > 0 ? (
                            <MemberPillCluster pills={bottomConsistencyPills} className="min-w-0 flex-1" />
                          ) : (
                            <div className="min-w-0 flex-1" />
                          )}
                          {bottomSubscriptionPills.length > 0 ? (
                            <MemberPillCluster pills={bottomSubscriptionPills} className="shrink-0 justify-end" />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </Card>
        )}
      </div>

      <BottomViewTabs currentView={currentView} counts={resolvedMemberCounts} onSelect={handleViewSelect} />
    </>
  );
}
