import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  api,
  ApiError,
  type MemberDetail,
  type MemberSummary,
  type OwnerMemberProfilePatch,
  type OwnerMemberListView,
  type OwnerMemberOverview,
  type Subscription,
} from '../../lib/api.js';
import Alert from '../../components/Alert.js';
import Button from '../../components/Button.js';
import Card from '../../components/Card.js';
import Icon from '../../components/Icon.js';
import MemberStatusPill, { type MemberStatusPillSpec } from '../../components/MemberStatusPill.js';
import ProfileFieldRow from '../../components/ProfileFieldRow.js';
import { formatFullDate, formatStatusLabel } from '../../components/attendance/AttendanceCalendar.js';

const KNOWN_MEMBER_VIEWS: OwnerMemberListView[] = [
  'all',
  'no-plan',
  'renewal',
  'at-risk',
  'building',
  'consistent',
  'today',
  'archived',
];

const MEMBER_VIEW_BACK_LABELS: Record<Exclude<OwnerMemberListView, 'all'>, string> = {
  archived: 'Archived members',
  'no-plan': 'No Active Plan',
  renewal: 'Upcoming Renewal',
  'at-risk': 'Consistency At Risk',
  building: 'Building Consistency',
  consistent: 'Consistent members',
  today: 'Marked Today',
};

function isOwnerMemberListView(value: string | null): value is OwnerMemberListView {
  return value !== null && KNOWN_MEMBER_VIEWS.includes(value as OwnerMemberListView);
}

function normalizeOwnerMemberListView(value: string | null): OwnerMemberListView | null {
  return isOwnerMemberListView(value) ? value : null;
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

function toLocalDate(value: string) {
  const parts = parseDateParts(value);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day);
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

function formatJoinDate(value: string) {
  const date = toLocalDate(value);
  if (!date) return value;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatMembershipAge(value: string) {
  const parts = parseDateParts(value);
  if (!parts) return 'Unknown';
  const joinedDayUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const daysOld = Math.max(0, Math.floor((todayUtc - joinedDayUtc) / 86400000));

  return `${daysOld} ${daysOld === 1 ? 'day' : 'days'} ago`;
}

function isValidYmdDate(value: string) {
  return parseDateParts(value) !== null;
}

function formatShortDate(value: string) {
  const date = toUtcDate(value);
  if (!date) return value;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function formatCurrency(amount: number) {
  if (!Number.isFinite(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN')}`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSessionCounts(sub: Subscription) {
  const total = Number.isFinite(sub.total_sessions) ? Math.max(0, Math.trunc(sub.total_sessions)) : 0;
  const attendedRaw = Number.isFinite(sub.attended_sessions) ? Math.max(0, Math.trunc(sub.attended_sessions)) : 0;
  const attended = Math.min(total, attendedRaw);
  const remaining = Math.max(0, total - attended);
  return { total, attended, remaining };
}

function getSubscriptionDateProgress(sub: Subscription) {
  if (sub.lifecycle_state === 'upcoming') return 0;
  if (sub.lifecycle_state === 'completed') return 100;

  const today = getIstTodayDateString();
  const totalDays = Math.max(1, diffUtcDays(sub.start_date, sub.end_date) + 1);
  const elapsedDays = Math.max(1, Math.min(totalDays, diffUtcDays(sub.start_date, today) + 1));
  return clampPercent((elapsedDays / totalDays) * 100);
}

function getSubscriptionSessionProgress(sub: Subscription) {
  const { total, attended } = normalizeSessionCounts(sub);
  if (total === 0) return 0;
  return clampPercent((attended / total) * 100);
}

function getSubscriptionDaysLeft(sub: Subscription) {
  if (sub.lifecycle_state === 'completed') return 0;
  if (sub.lifecycle_state === 'upcoming') {
    return Math.max(0, diffUtcDays(getIstTodayDateString(), sub.start_date));
  }
  return Math.max(0, diffUtcDays(getIstTodayDateString(), sub.end_date));
}

function getSubscriptionDaysSinceEnd(sub: Subscription) {
  if (sub.lifecycle_state !== 'completed') return 0;
  return Math.max(0, diffUtcDays(sub.end_date, getIstTodayDateString()));
}

const PILL_CARD_SINGLE_ROW_MIN_HEIGHT_PX = 52;
const PILL_CARD_ROW_GAP_PX = 8;
const PILL_CARD_PILL_FALLBACK_HEIGHT_PX = 24;

type PillSpec = MemberStatusPillSpec;

function computePillRows(widths: number[], availableWidth: number) {
  if (widths.length === 0 || availableWidth <= 0) return 1;

  let rows = 0;
  let currentRowWidth = 0;

  for (const width of widths) {
    if (currentRowWidth === 0) {
      rows += 1;
      currentRowWidth = width;
      continue;
    }

    if (currentRowWidth + PILL_CARD_ROW_GAP_PX + width <= availableWidth) {
      currentRowWidth += PILL_CARD_ROW_GAP_PX + width;
      continue;
    }

    rows += 1;
    currentRowWidth = width;
  }

  return Math.max(rows, 1);
}

function CompactPillCard({
  label,
  pills,
  action,
}: {
  label: string;
  pills: PillSpec[];
  action?: {
    to: string;
    label: string;
    icon: string;
  };
}) {
  const pillsWrapRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  itemRefs.current.length = pills.length + (action ? 1 : 0);
  const [innerMinHeight, setInnerMinHeight] = useState(PILL_CARD_SINGLE_ROW_MIN_HEIGHT_PX);
  const pillSignature = [
    ...pills.map((pill) => `${pill.key}:${pill.icon ?? ''}:${pill.label}`),
    action ? `action:${action.label}:${action.icon}:${action.to}` : '',
  ].join('|');

  useLayoutEffect(() => {
    function updateLayout() {
      const availableWidth = pillsWrapRef.current?.clientWidth ?? 0;
      const widths = itemRefs.current
        .map((item) => item ? Math.ceil(item.getBoundingClientRect().width) : 0)
        .filter((value) => value > 0);
      const heights = itemRefs.current
        .map((item) => item ? Math.ceil(item.getBoundingClientRect().height) : 0)
        .filter((value) => value > 0);

      if (widths.length === 0 || availableWidth <= 0) {
        setInnerMinHeight(PILL_CARD_SINGLE_ROW_MIN_HEIGHT_PX);
        return;
      }

      const rowCount = computePillRows(widths, availableWidth);
      const pillHeight = Math.max(...heights, PILL_CARD_PILL_FALLBACK_HEIGHT_PX);
      const nextHeight = Math.max(
        PILL_CARD_SINGLE_ROW_MIN_HEIGHT_PX,
        PILL_CARD_SINGLE_ROW_MIN_HEIGHT_PX + (rowCount - 1) * (pillHeight + PILL_CARD_ROW_GAP_PX),
      );

      setInnerMinHeight((current) => (current === nextHeight ? current : nextHeight));
    }

    updateLayout();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateLayout);
      return () => {
        window.removeEventListener('resize', updateLayout);
      };
    }

    const observer = new ResizeObserver(updateLayout);
    if (pillsWrapRef.current) {
      observer.observe(pillsWrapRef.current);
    }
    itemRefs.current.forEach((item) => {
      if (item) observer.observe(item);
    });

    return () => {
      observer.disconnect();
    };
  }, [pillSignature]);

  return (
    <div className="surface-inset surface-inset--owner-compact">
      <div className="flex items-center justify-between gap-3" style={{ minHeight: `${innerMinHeight}px` }}>
        <span className="shrink-0 font-label text-[0.66rem] font-bold uppercase tracking-[0.22em] text-black dark:text-white">
          {label}
        </span>
        <div ref={pillsWrapRef} className="ml-auto flex min-w-0 flex-1 flex-wrap justify-end gap-2">
          {pills.map((pill, index) => (
            <MemberStatusPill
              key={pill.key}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              pill={pill}
              className="whitespace-nowrap"
              contentClassName="text-[0.67rem]"
              iconClassName="text-[0.85rem]"
            />
          ))}
          {action ? (
            <Link
              to={action.to}
              ref={(node) => {
                itemRefs.current[pills.length] = node;
              }}
              className="owner-packages-cta-frame relative inline-flex shrink-0 items-center justify-center rounded-full border border-black font-label text-[0.67rem] font-bold italic uppercase tracking-[0.16em] text-black shadow-panel transition-all hover:shadow-glow-brand dark:border-white dark:text-white"
            >
              <span
                aria-hidden="true"
                className="owner-packages-cta-surface brand-duotone-button-sm"
                style={{ backgroundSize: '78% 185%, 108% 235%, 100% 100%' }}
              />
              <span className="relative z-10 inline-flex items-center justify-center gap-1.5 rounded-[calc(9999px-1px)] px-2.5 py-1">
                <Icon name={action.icon} className="text-[0.85rem]" />
                <span>{action.label}</span>
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function buildSubscriptionPills(detail: MemberDetail): PillSpec[] {
  const pills: PillSpec[] = [
    {
      key: detail.active_subscription ? 'active' : 'no-plan',
      label: detail.active_subscription ? 'Active' : 'No plan',
      icon: detail.active_subscription ? 'bolt' : 'credit_card_off',
      tone: detail.active_subscription ? 'default' : 'neutral',
    },
  ];

  if (detail.renewal?.kind === 'ends_soon') {
    pills.push({
      key: 'renewal',
      label: 'Renewal',
      icon: 'notification_important',
      tone: 'warning',
    });
  }

  return pills;
}

function buildConsistencyPills(detail: MemberDetail): PillSpec[] {
  const pills: PillSpec[] = [];
  const state = detail.owner_consistency_state;

  if (state) {
    switch (state.stage) {
      case 'consistent':
        pills.push({
          key: 'consistent',
          label: 'Consistent',
          icon: 'moving',
        });
        if (state.days) {
          pills.push({
            key: 'consistent-days',
            label: `${state.days} Days`,
            icon: 'calendar_month',
          });
        }
        break;
      case 'building':
        pills.push({
          key: 'building',
          label: 'Building',
          icon: 'timeline',
        });
        break;
      case 'not_consistent':
        pills.push({
          key: 'not-consistent',
          label: 'Not Consistent',
          icon: 'block',
        });
        break;
    }

    if (state.at_risk) {
      pills.push({
        key: 'at-risk',
        label: 'At risk',
        icon: 'warning',
        tone: 'warning',
      });
    }
  }

  pills.push({
    key: 'today-status',
    label: detail.marked_attendance_today ? 'In today' : 'Not in today',
    icon: 'today',
    tone: detail.marked_attendance_today ? 'default' : 'neutral',
  });

  return pills;
}
function sortSubscriptions(subs: Subscription[]) {
  const priority: Record<Subscription['lifecycle_state'], number> = {
    active: 0,
    upcoming: 1,
    completed: 2,
  };

  return [...subs].sort((a, b) => {
    const priorityDiff = priority[a.lifecycle_state] - priority[b.lifecycle_state];
    if (priorityDiff !== 0) return priorityDiff;
    if (a.lifecycle_state === 'upcoming' && b.lifecycle_state === 'upcoming') {
      return a.start_date.localeCompare(b.start_date) || a.id - b.id;
    }
    if (a.lifecycle_state === 'completed' && b.lifecycle_state === 'completed') {
      return b.end_date.localeCompare(a.end_date) || b.id - a.id;
    }
    return b.start_date.localeCompare(a.start_date) || b.id - a.id;
  });
}

const PROFILE_EDIT_ROW_H = 'h-[3.25rem]';

const profileEditIconBtn = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/80 text-black shadow-sm shadow-black/5 transition-all hover:bg-white active:translate-y-px active:scale-[0.98] disabled:opacity-45 sm:h-[3.25rem] sm:w-[3.25rem] dark:border-white/15 dark:bg-surface-dark/75 dark:text-white dark:hover:bg-surface-raised/80';
const subscriptionActionBtn =
  'w-full min-w-0 justify-center whitespace-nowrap px-3 py-3 font-label text-[0.72rem] font-bold uppercase tracking-[0.12em] not-italic';

function OwnerInlineProfileRow({
  label,
  displayValue,
  field,
  activeField,
  draft,
  onDraftChange,
  onRequestEdit,
  onCancel,
  onConfirm,
  saving,
  canEdit,
  wrapDisplayWords,
  inputRef,
  inputType,
  inputMode,
  maxLength,
  errorMessage,
}: {
  label: string;
  displayValue: string;
  field: 'name' | 'phone' | 'join_date';
  activeField: 'name' | 'phone' | 'join_date' | null;
  draft: string;
  onDraftChange: (v: string) => void;
  onRequestEdit: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
  canEdit: boolean;
  wrapDisplayWords: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  inputType?: InputHTMLAttributes<HTMLInputElement>['type'];
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength: number;
  errorMessage?: string;
}) {
  const editing = activeField === field;
  const labelClass =
    'shrink-0 font-label text-[0.66rem] font-bold uppercase tracking-[0.22em] text-black dark:text-white';

  if (editing) {
    return (
      <div className="w-full">
        <div className={`flex w-full min-w-0 items-center gap-1.5 sm:gap-2 ${PROFILE_EDIT_ROW_H}`}>
          <span className={labelClass}>{label}</span>
          <input
            ref={inputRef}
            type={inputType ?? 'text'}
            className={`box-border w-0 min-w-0 flex-1 rounded-xl border border-black/15 bg-white/90 px-2.5 sm:px-3 text-right text-base font-semibold text-black shadow-sm shadow-black/5 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-300/30 dark:border-white/15 dark:bg-surface-dark/85 dark:text-white dark:focus:border-accent-400 dark:focus:ring-accent-400/25 ${PROFILE_EDIT_ROW_H}`}
            value={draft}
            maxLength={maxLength}
            disabled={saving}
            inputMode={inputMode}
            aria-label={label}
            onChange={(e) =>
              onDraftChange(
                field === 'phone' ? e.target.value.replace(/\D+/g, '').slice(0, 10) : e.target.value,
              )
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onConfirm();
              if (e.key === 'Escape') onCancel();
            }}
          />
          <button type="button" className={profileEditIconBtn} aria-label="Cancel" disabled={saving} onClick={onCancel}>
            <span className="material-symbols-outlined text-[1.35rem] text-red-600 dark:text-red-400">close</span>
          </button>
          <button type="button" className={profileEditIconBtn} aria-label="Save" disabled={saving} onClick={() => void onConfirm()}>
            <span className="material-symbols-outlined text-[1.35rem] text-emerald-600 dark:text-emerald-400">check</span>
          </button>
        </div>
        {errorMessage ? (
          <p className="mt-2 text-xs leading-[1.125rem] text-red-600 dark:text-red-400" aria-live="polite">
            {errorMessage}
          </p>
        ) : null}
      </div>
    );
  }

  const valueWrap = wrapDisplayWords
    ? 'w-0 min-w-0 flex-1 whitespace-normal break-normal text-right text-base font-semibold text-black dark:text-white'
    : 'w-0 min-w-0 flex-1 break-words text-right text-base font-semibold text-black dark:text-white';

  return (
    <div className={`flex w-full min-w-0 items-center justify-between gap-1.5 sm:gap-3 ${PROFILE_EDIT_ROW_H}`}>
      <span className={labelClass}>{label}</span>
      <span className={valueWrap}>{displayValue}</span>
      {canEdit ? (
        <button type="button" className={profileEditIconBtn} aria-label={`Edit ${label}`} onClick={onRequestEdit}>
          <span className="material-symbols-outlined text-[1.35rem]">edit</span>
        </button>
      ) : null}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="section-eyebrow">{eyebrow}</p>
      <h3 className="mt-1 text-xl font-black tracking-tight text-black dark:text-white">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm text-black/60 dark:text-white/70">{description}</p>
      ) : null}
    </div>
  );
}

function ProgressMetric({
  label,
  detail,
  trailing,
  percent,
  barClassName,
}: {
  label: string;
  detail: ReactNode;
  trailing?: ReactNode;
  percent: number;
  barClassName: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-label text-[0.62rem] font-bold uppercase tracking-[0.18em] text-black/55 dark:text-white/60">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold text-black dark:text-white">{detail}</p>
        </div>
        {trailing ? (
          <span className="shrink-0 text-xs font-semibold text-black/60 dark:text-white/70">
            {trailing}
          </span>
        ) : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/[0.08]">
        <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function SubscriptionCard({
  memberId,
  sub,
  viewQuery,
  onComplete,
  sectionLabel,
  completing = false,
}: {
  memberId: string;
  sub: Subscription;
  viewQuery: string;
  onComplete: (subscription: Subscription) => void;
  sectionLabel?: string;
  completing?: boolean;
}) {
  const dateProgress = getSubscriptionDateProgress(sub);
  const sessionProgress = getSubscriptionSessionProgress(sub);
  const daysLeft = getSubscriptionDaysLeft(sub);
  const daysSinceEnd = getSubscriptionDaysSinceEnd(sub);
  const hasCompletionAction = Boolean(sub.can_mark_complete);
  const { total, attended, remaining } = normalizeSessionCounts(sub);
  const isActiveCard = sub.lifecycle_state === 'active';

  const content = (
    <>
      {sectionLabel ? (
        <p
          className={
            isActiveCard
              ? 'inline-flex w-fit items-center rounded-full border border-black/12 bg-white/60 px-3 py-1 font-label text-[0.64rem] font-bold uppercase tracking-[0.18em] text-black shadow-sm shadow-black/5 dark:border-white/12 dark:bg-white/[0.08] dark:text-white'
              : 'section-eyebrow not-italic'
          }
        >
          {sectionLabel}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-headline text-2xl font-black italic uppercase tracking-tight text-black dark:text-white">
              {sub.service_type || 'Untitled package'}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-black/60 dark:text-white/70">
          <span>{formatCurrency(sub.amount)}</span>
          {sub.lifecycle_state === 'upcoming' ? <span>Starts in {daysLeft}d</span> : null}
          {sub.lifecycle_state === 'completed' ? <span>Ended {daysSinceEnd}d ago</span> : null}
        </div>
      </div>

      <div className="space-y-4">
        <ProgressMetric
          label="Date range"
          detail={`${formatShortDate(sub.start_date)} - ${formatShortDate(sub.end_date)}`}
          trailing={
            sub.lifecycle_state === 'upcoming'
              ? null
              : sub.lifecycle_state === 'completed'
                ? 'Complete'
                : `${daysLeft}d left`
          }
          percent={dateProgress}
          barClassName="bg-brand-500 dark:bg-brand-300"
        />
        <ProgressMetric
          label="Sessions"
          detail={`${attended} of ${total} used`}
          trailing={sub.lifecycle_state === 'active' ? `${remaining} left` : null}
          percent={sessionProgress}
          barClassName="bg-energy-400 dark:bg-energy-300"
        />
      </div>

      <div className={`${hasCompletionAction ? 'grid grid-cols-2' : 'flex flex-wrap'} gap-3 border-t border-black/10 pt-4 dark:border-white/10`}>
        {sub.can_mark_complete ? (
          <Button
            variant="danger"
            icon={completing ? 'progress_activity' : 'cancel'}
            className={subscriptionActionBtn}
            disabled={completing}
            onClick={() => onComplete(sub)}
          >
            {completing ? 'Terminating...' : 'Terminate'}
          </Button>
        ) : null}
        <Link className={hasCompletionAction ? 'min-w-0' : ''} to={`/members/${memberId}/subscriptions/${sub.id}/attendance${viewQuery}`}>
          <Button
            variant="secondary"
            icon="calendar_month"
            className={subscriptionActionBtn}
          >
            Attendance
          </Button>
        </Link>
      </div>
    </>
  );

  return isActiveCard ? (
    <Card className="active-subscription-card-frame p-0">
      <div className="active-subscription-card-surface">
        <div className="active-subscription-card-content space-y-5 p-5 sm:p-6">
          {content}
        </div>
      </div>
    </Card>
  ) : (
    <Card className="space-y-5 p-5">
      {content}
    </Card>
  );
}

function EmptyActiveSubscriptionCard({
  memberId,
  viewQuery,
  canAddSubscription,
}: {
  memberId: string;
  viewQuery: string;
  canAddSubscription: boolean;
}) {
  const cta = (
    <Button
      icon="add"
      disabled={!canAddSubscription}
      className="min-w-[11.5rem]"
    >
      {canAddSubscription ? 'Add subscription' : 'Unarchive to add subscription'}
    </Button>
  );

  return (
    <Card className="space-y-4 p-4">
      <p className="section-eyebrow not-italic">ACTIVE SUBSCRIPTION</p>
      <div className="flex min-h-[7.5rem] items-center justify-center rounded-[1.25rem] border border-dashed border-black/12 bg-white/35 px-4 py-5 dark:border-white/12 dark:bg-white/[0.03]">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-xs font-medium text-black/60 dark:text-white/70">
            This member has no subscription active for today
          </p>
          {canAddSubscription ? (
            <Link to={`/members/${memberId}/subscriptions/new${viewQuery}`}>
              {cta}
            </Link>
          ) : (
            cta
          )}
        </div>
      </div>
    </Card>
  );
}

function DetailSkeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-xl bg-black/10 dark:bg-white/10 ${className}`} />;
}

function CompactPillCardSkeleton({ label }: { label: string }) {
  return (
    <div className="surface-inset surface-inset--owner-compact">
      <div className="flex min-h-[52px] items-center justify-between gap-3">
        <span className="shrink-0 font-label text-[0.66rem] font-bold uppercase tracking-[0.22em] text-black dark:text-white">
          {label}
        </span>
        <div className="ml-auto flex min-w-0 flex-1 justify-end gap-2">
          <DetailSkeleton className="h-7 w-24 rounded-full" />
          <DetailSkeleton className="h-7 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function SubscriptionCardSkeleton() {
  return (
    <Card className="space-y-5 p-5">
      <DetailSkeleton className="h-6 w-40" />
      <DetailSkeleton className="h-8 w-4/5" />
      <div className="space-y-4">
        <DetailSkeleton className="h-12 w-full" />
        <DetailSkeleton className="h-12 w-full" />
      </div>
      <DetailSkeleton className="h-11 w-full" />
    </Card>
  );
}

function DestructiveActionSkeleton() {
  return (
    <Card className="destructive-card-glow space-y-4 border border-red-200 bg-red-50/55 p-5 dark:border-red-900/60 dark:bg-red-950/15">
      <DetailSkeleton className="h-4 w-36" />
      <DetailSkeleton className="h-7 w-44" />
      <DetailSkeleton className="h-11 w-full" />
    </Card>
  );
}

function findCachedMemberSummary(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string | undefined,
): MemberSummary | undefined {
  if (!id) return undefined;
  const cachedOverviews = queryClient.getQueriesData<OwnerMemberOverview>({ queryKey: ['owner-members-overview'] });
  for (const [, overview] of cachedOverviews) {
    const member = overview?.members.find((item) => String(item.id) === id);
    if (member) {
      return {
        id: member.id,
        full_name: member.full_name,
        email: member.email,
        phone: member.phone,
        join_date: member.join_date,
        status: member.status,
        archived_at: member.archived_at,
        can_edit_profile: true,
      };
    }
  }
  return undefined;
}

export default function OwnerMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [archiving, setArchiving] = useState(false);
  const [archiveErr, setArchiveErr] = useState('');
  const [completionError, setCompletionError] = useState('');
  const [completingSubscriptionId, setCompletingSubscriptionId] = useState<number | null>(null);
  const [inlineField, setInlineField] = useState<null | 'name' | 'phone' | 'join_date'>(null);
  const [inlineDraft, setInlineDraft] = useState('');
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [showMoreBio, setShowMoreBio] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const joinDateInputRef = useRef<HTMLInputElement>(null);
  const cachedSummary = findCachedMemberSummary(queryClient, id);

  const { data: summary } = useQuery<MemberSummary>({
    queryKey: ['member-summary', id],
    queryFn: () => api.get(`/api/members/${id}/summary`),
    enabled: !!id,
    initialData: cachedSummary,
  });

  const { data: detail, isLoading: overviewLoading } = useQuery<MemberDetail>({
    queryKey: ['member-detail', id],
    queryFn: () => api.get(`/api/members/${id}/overview`),
    enabled: !!id,
  });

  const { data: activeUpcomingSubs = [], isLoading: activeUpcomingLoading } = useQuery<Subscription[]>({
    queryKey: ['member-subs', id, 'active-upcoming'],
    queryFn: () => api.get(`/api/members/${id}/subscriptions?scope=active-upcoming`),
    enabled: !!id,
  });

  const [loadPastSubscriptions, setLoadPastSubscriptions] = useState(false);
  useEffect(() => {
    if (!id) return;
    setLoadPastSubscriptions(false);
    const load = () => setLoadPastSubscriptions(true);
    const timer = window.setTimeout(load, 350);
    return () => window.clearTimeout(timer);
  }, [id]);

  const { data: pastSubs = [], isFetching: pastSubsLoading } = useQuery<Subscription[]>({
    queryKey: ['member-subs', id, 'past'],
    queryFn: () => api.get(`/api/members/${id}/subscriptions?scope=past`),
    enabled: !!id && loadPastSubscriptions,
  });

  async function invalidateMemberQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['member-summary', id] }),
      queryClient.invalidateQueries({ queryKey: ['member-detail', id] }),
      queryClient.invalidateQueries({ queryKey: ['member-subs', id] }),
      queryClient.invalidateQueries({ queryKey: ['owner-members-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['owner-home'] }),
      queryClient.invalidateQueries({ queryKey: ['owner-home-metrics'] }),
    ]);
  }

  async function handleArchiveAction() {
    if (!detail) return;
    const actionLabel = detail.archive_action.kind === 'archive' ? 'archive' : 'unarchive';
    if (detail.archive_action.kind === 'archive' && !detail.archive_action.allowed) return;
    if (!confirm(`${actionLabel} ${detail.full_name}?`)) return;

    setArchiveErr('');
    setArchiving(true);
    try {
      await api.post(`/api/members/${id}/${detail.archive_action.kind}`);
      await invalidateMemberQueries();
    } catch (error) {
      setArchiveErr(error instanceof ApiError ? error.message : `Failed to ${actionLabel} member`);
    } finally {
      setArchiving(false);
    }
  }

  async function confirmInlineProfileEdit() {
    if (!id || !inlineField) return;

    if (inlineField === 'name') {
      const trimmed = inlineDraft.trim();
      if (!trimmed) {
        setInlineError('Name is required');
        return;
      }
      setInlineError('');
      setInlineSaving(true);
      try {
        const payload: OwnerMemberProfilePatch = { full_name: trimmed };
        await api.patch(`/api/members/${id}`, payload);
        setInlineField(null);
        await invalidateMemberQueries();
      } catch (error) {
        setInlineError(error instanceof ApiError ? error.message : 'Failed to update name');
      } finally {
        setInlineSaving(false);
      }
      return;
    }

    if (inlineField === 'join_date') {
      const trimmed = inlineDraft.trim();
      if (!trimmed) {
        setInlineError('Join date is required');
        return;
      }
      if (!isValidYmdDate(trimmed)) {
        setInlineError('Select a valid join date');
        return;
      }
      setInlineError('');
      setInlineSaving(true);
      try {
        const payload: OwnerMemberProfilePatch = { join_date: trimmed };
        await api.patch(`/api/members/${id}`, payload);
        setInlineField(null);
        await invalidateMemberQueries();
      } catch (error) {
        setInlineError(error instanceof ApiError ? error.message : 'Failed to update join date');
      } finally {
        setInlineSaving(false);
      }
      return;
    }

    const normalizedPhone = inlineDraft.replace(/\D+/g, '').slice(0, 10);
    if (!/^\d{10}$/.test(normalizedPhone)) {
      setInlineError('Phone must be exactly 10 digits');
      return;
    }
    setInlineError('');
    setInlineSaving(true);
    try {
      const payload: OwnerMemberProfilePatch = { phone: normalizedPhone };
      await api.patch(`/api/members/${id}`, payload);
      setInlineField(null);
      await invalidateMemberQueries();
    } catch (error) {
      setInlineError(error instanceof ApiError ? error.message : 'Failed to update phone');
    } finally {
      setInlineSaving(false);
    }
  }

  useLayoutEffect(() => {
    if (inlineField === 'name') {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    } else if (inlineField === 'phone') {
      phoneInputRef.current?.focus();
      phoneInputRef.current?.select();
    } else if (inlineField === 'join_date') {
      joinDateInputRef.current?.focus();
    }
  }, [inlineField]);

  async function handleComplete(subscription: Subscription) {
    if (!subscription.can_mark_complete) return;
    if (!confirm(`Mark ${subscription.service_type} complete? This cannot be undone.`)) return;

    setCompletionError('');
    setCompletingSubscriptionId(subscription.id);
    try {
      await api.post(`/api/subscriptions/${subscription.id}/complete`);
      await invalidateMemberQueries();
    } catch (error) {
      setCompletionError(error instanceof ApiError ? error.message : 'Could not mark subscription complete');
    } finally {
      setCompletingSubscriptionId(null);
    }
  }

  if (!id) return null;

  const profile = summary ?? detail ?? null;

  const requestedView = searchParams.get('view');
  const preservedView = normalizeOwnerMemberListView(requestedView)
    ? normalizeOwnerMemberListView(requestedView)!
    : profile?.status === 'archived'
      ? 'archived'
      : 'all';
  const viewQuery = preservedView === 'all' ? '' : `?view=${encodeURIComponent(preservedView)}`;
  const backLink = `/members${viewQuery}`;
  const backLabel = preservedView === 'all' ? 'All Active' : MEMBER_VIEW_BACK_LABELS[preservedView];

  const orderedSubs = sortSubscriptions([...activeUpcomingSubs, ...pastSubs]);
  const groupedSubs = {
    active: orderedSubs.filter((sub) => sub.lifecycle_state === 'active'),
    upcoming: orderedSubs.filter((sub) => sub.lifecycle_state === 'upcoming'),
    past: orderedSubs.filter((sub) => sub.lifecycle_state === 'completed'),
  };
  return (
    <div className="page-stack max-w-5xl">
        <Link to={backLink} className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {backLabel}
        </Link>

        <div className="space-y-2">
          <div className="space-y-2">
            <div>
              <h2 className="page-title">Member Profile</h2>
              <p className="member-detail-subheading">
                BIO
              </p>
            </div>

            <div className="grid w-full gap-2">
              <div className="surface-inset surface-inset--owner-compact">
                {profile ? (
                  <OwnerInlineProfileRow
                    label="Name"
                    displayValue={profile.full_name}
                    field="name"
                    activeField={inlineField}
                    draft={inlineDraft}
                    onDraftChange={setInlineDraft}
                    onRequestEdit={() => {
                      setInlineError('');
                      setInlineDraft(profile.full_name);
                      setInlineField('name');
                    }}
                    onCancel={() => {
                      setInlineField(null);
                      setInlineError('');
                    }}
                    onConfirm={confirmInlineProfileEdit}
                    saving={inlineSaving}
                    canEdit={profile.can_edit_profile && profile.status !== 'archived'}
                    wrapDisplayWords
                    inputRef={nameInputRef}
                    maxLength={120}
                    errorMessage={inlineField === 'name' ? inlineError : ''}
                  />
                ) : (
                  <div className="flex min-h-[3.25rem] items-center justify-between gap-3">
                    <span className="font-label text-[0.66rem] font-bold uppercase tracking-[0.22em] text-black dark:text-white">Name</span>
                    <DetailSkeleton className="h-7 w-44" />
                  </div>
                )}
                {profile ? (
                  <div className="mt-1 flex justify-start">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-label text-[0.62rem] font-bold uppercase tracking-[0.18em] text-black transition-all active:translate-y-px dark:text-white"
                      aria-expanded={showMoreBio}
                      aria-controls="member-bio-more"
                      onClick={() => setShowMoreBio((current) => !current)}
                    >
                      <span>More</span>
                      <span className="material-symbols-outlined text-[1rem] text-black dark:text-white">
                        {showMoreBio ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                  </div>
                ) : null}
                {profile && showMoreBio ? (
                  <div id="member-bio-more" className="mt-2 border-t border-black/10 pt-2 dark:border-white/10">
                    <ProfileFieldRow compact label="Email" value={profile.email} />
                    <div className="border-t border-black/10 dark:border-white/10">
                      <OwnerInlineProfileRow
                        label="Mobile"
                        displayValue={profile.phone}
                        field="phone"
                        activeField={inlineField}
                        draft={inlineDraft}
                        onDraftChange={setInlineDraft}
                        onRequestEdit={() => {
                          setInlineError('');
                          setInlineDraft(profile.phone.replace(/\D+/g, '').slice(0, 10));
                          setInlineField('phone');
                        }}
                        onCancel={() => {
                          setInlineField(null);
                          setInlineError('');
                        }}
                        onConfirm={confirmInlineProfileEdit}
                        saving={inlineSaving}
                        canEdit={profile.can_edit_profile && profile.status !== 'archived'}
                        wrapDisplayWords={false}
                        inputRef={phoneInputRef}
                        inputMode="numeric"
                        maxLength={10}
                        errorMessage={inlineField === 'phone' ? inlineError : ''}
                      />
                    </div>
                    <div className="border-t border-black/10 dark:border-white/10">
                      <OwnerInlineProfileRow
                        label="Member since"
                        displayValue={formatJoinDate(profile.join_date)}
                        field="join_date"
                        activeField={inlineField}
                        draft={inlineDraft}
                        onDraftChange={setInlineDraft}
                        onRequestEdit={() => {
                          setInlineError('');
                          setInlineDraft(profile.join_date);
                          setInlineField('join_date');
                        }}
                        onCancel={() => {
                          setInlineField(null);
                          setInlineError('');
                        }}
                        onConfirm={confirmInlineProfileEdit}
                        saving={inlineSaving}
                        canEdit={profile.can_edit_profile && profile.status !== 'archived'}
                        wrapDisplayWords={false}
                        inputRef={joinDateInputRef}
                        inputType="date"
                        maxLength={10}
                        errorMessage={inlineField === 'join_date' ? inlineError : ''}
                      />
                      <div className="mt-0.5 text-right">
                        <p className="text-xs font-medium text-black/55 dark:text-white/60">
                          {formatMembershipAge(profile.join_date)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="border-t border-black pt-4 dark:border-white">
                <p className="member-detail-subheading">
                  OVERVIEW
                </p>
              </div>
              {detail ? (
                <>
                  <CompactPillCard
                    label="Subscription"
                    pills={buildSubscriptionPills(detail)}
                    action={
                      detail.can_add_subscription
                        ? { to: `/members/${id}/subscriptions/new${viewQuery}`, label: 'New', icon: 'add' }
                        : undefined
                    }
                  />
                  <CompactPillCard label="Consistency" pills={buildConsistencyPills(detail)} />
                </>
              ) : (
                <>
                  <CompactPillCardSkeleton label="Subscription" />
                  <CompactPillCardSkeleton label="Consistency" />
                </>
              )}
            </div>
          </div>
          <div className="space-y-4 border-t border-black pt-4 dark:border-white">
            <p className="member-detail-subheading">
              BILLING
            </p>
            {completionError ? <Alert variant="error">{completionError}</Alert> : null}
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="space-y-3">
                  {activeUpcomingLoading ? (
                    <SubscriptionCardSkeleton />
                  ) : groupedSubs.active.length > 0 ? (
                    groupedSubs.active.map((sub) => (
                      <SubscriptionCard
                        key={sub.id}
                        memberId={id}
                        sub={sub}
                        viewQuery={viewQuery}
                        onComplete={handleComplete}
                        sectionLabel="ACTIVE SUBSCRIPTION"
                        completing={completingSubscriptionId === sub.id}
                      />
                    ))
                  ) : (
                    <EmptyActiveSubscriptionCard
                      memberId={id}
                      viewQuery={viewQuery}
                      canAddSubscription={detail?.can_add_subscription ?? false}
                    />
                  )}
                </div>
              </div>

              {([
                ['upcoming', groupedSubs.upcoming, 'Upcoming subscriptions'],
                ['past', groupedSubs.past, 'Past subscriptions'],
              ] as const).map(([key, items, heading]) => (
                items.length > 0 ? (
                  <div key={key} className="space-y-3">
                    {key === 'upcoming' || key === 'past' ? (
                      <div className="member-detail-subheading flex items-center justify-between gap-3">
                        <span>{heading}</span>
                        <span>{items.length}</span>
                      </div>
                    ) : (
                      <p className="section-eyebrow">{heading}</p>
                    )}
                    <div className="space-y-3">
                      {items.map((sub) => (
                        <SubscriptionCard
                          key={sub.id}
                          memberId={id}
                          sub={sub}
                          viewQuery={viewQuery}
                          onComplete={handleComplete}
                          completing={completingSubscriptionId === sub.id}
                        />
                      ))}
                    </div>
                  </div>
                ) : null
              ))}
              {loadPastSubscriptions && pastSubsLoading ? (
                <div className="space-y-3">
                  <div className="member-detail-subheading flex items-center justify-between gap-3">
                    <span>Past subscriptions</span>
                  </div>
                  <SubscriptionCardSkeleton />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {detail ? (
          <Card className="destructive-card-glow space-y-4 border border-red-200 bg-red-50/55 p-5 dark:border-red-900/60 dark:bg-red-950/15">
            <SectionHeading
              eyebrow="Destructive actions"
              title={detail.archive_action.kind === 'archive' ? 'Archive member' : 'Unarchive member'}
              description={
                detail.archive_action.kind === 'archive'
                  ? 'Archiving signs the member out and removes them from the active roster.'
                  : 'Unarchiving restores the member to the active roster.'
              }
            />

            {detail.archive_action.kind === 'archive' && !detail.archive_action.allowed ? (
              <Alert variant="warning">
                {detail.archive_action.reason}
              </Alert>
            ) : null}

            {detail.archive_action.blocked_by.length > 0 ? (
              <div className="space-y-3">
                {detail.archive_action.blocked_by.map((blocker) => (
                  <div
                    key={blocker.subscription_id}
                    className="grid gap-3 rounded-[1.2rem] border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-black dark:text-white">{blocker.service_type}</p>
                      <p className="text-xs text-black/60 dark:text-white/70">
                        {formatStatusLabel(blocker.lifecycle_state)} • {formatFullDate(blocker.start_date)} - {formatFullDate(blocker.end_date)}
                      </p>
                    </div>
                    <Link className="w-full sm:w-auto" to={`/members/${id}/subscriptions/${blocker.subscription_id}/attendance${viewQuery}`}>
                      <Button variant="secondary" icon="calendar_month" className="w-full whitespace-nowrap sm:w-auto">
                        Review & Terminate
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                onClick={handleArchiveAction}
                disabled={archiving || (detail.archive_action.kind === 'archive' && !detail.archive_action.allowed)}
                icon={archiving ? 'progress_activity' : detail.archive_action.kind === 'archive' ? 'archive' : 'unarchive'}
                className="w-full justify-center text-center"
              >
                {archiving
                  ? (detail.archive_action.kind === 'archive' ? 'Archiving…' : 'Unarchiving…')
                  : detail.archive_action.kind === 'archive'
                    ? 'Archive member'
                    : 'Unarchive member'}
              </Button>
            </div>

            {archiveErr ? <Alert variant="error">{archiveErr}</Alert> : null}
          </Card>
        ) : (
          <DestructiveActionSkeleton />
        )}
    </div>
  );
}
