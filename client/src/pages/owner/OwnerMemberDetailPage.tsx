import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError, type MemberDetail, type OwnerMemberListView, type Subscription } from '../../lib/api.js';
import Alert from '../../components/Alert.js';
import AppShell from '../../components/AppShell.js';
import Badge from '../../components/Badge.js';
import Button from '../../components/Button.js';
import Card from '../../components/Card.js';
import Icon from '../../components/Icon.js';
import ProfileFieldRow from '../../components/ProfileFieldRow.js';
import Spinner from '../../components/Spinner.js';
import { formatFullDate, formatStatusLabel } from '../../components/attendance/AttendanceCalendar.js';
import { ownerLinks } from './ownerLinks.js';

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
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function toLocalDate(value: string) {
  const { year, month, day } = parseDateParts(value);
  return new Date(year, month - 1, day);
}

function formatJoinDate(value: string) {
  return toLocalDate(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatMembershipAge(value: string) {
  const { year, month, day } = parseDateParts(value);
  const joinedDayUtc = Date.UTC(year, month - 1, day);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const daysOld = Math.max(0, Math.floor((todayUtc - joinedDayUtc) / 86400000));

  return `${daysOld} ${daysOld === 1 ? 'day' : 'days'} ago`;
}

const PILL_CARD_SINGLE_ROW_MIN_HEIGHT_PX = 52;
const PILL_CARD_ROW_GAP_PX = 8;
const PILL_CARD_PILL_FALLBACK_HEIGHT_PX = 24;

type PillSpec = {
  key: string;
  label: string;
  icon?: string;
};

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

const StatusPill = forwardRef<HTMLSpanElement, {
  label: string;
  icon?: string;
}>(function StatusPill({
  label,
  icon,
}, ref) {
  return (
    <span
      ref={ref}
      className="inline-flex items-center whitespace-nowrap rounded-full border border-black bg-black/[0.04] px-2.5 py-1 font-label text-[0.67rem] font-bold italic uppercase tracking-[0.16em] text-black dark:border-white dark:bg-white/[0.04] dark:text-white"
    >
      {icon ? <Icon name={icon} className="mr-[0.5ch] text-[0.85rem]" /> : null}
      <span>{label}</span>
    </span>
  );
});

function CompactPillCard({
  label,
  pills,
}: {
  label: string;
  pills: PillSpec[];
}) {
  const pillsWrapRef = useRef<HTMLDivElement | null>(null);
  const pillRefs = useRef<Array<HTMLSpanElement | null>>([]);
  pillRefs.current.length = pills.length;
  const [innerMinHeight, setInnerMinHeight] = useState(PILL_CARD_SINGLE_ROW_MIN_HEIGHT_PX);
  const pillSignature = pills.map((pill) => `${pill.key}:${pill.icon ?? ''}:${pill.label}`).join('|');

  useLayoutEffect(() => {
    function updateLayout() {
      const availableWidth = pillsWrapRef.current?.clientWidth ?? 0;
      const widths = pillRefs.current
        .map((pill) => pill ? Math.ceil(pill.getBoundingClientRect().width) : 0)
        .filter((value) => value > 0);
      const heights = pillRefs.current
        .map((pill) => pill ? Math.ceil(pill.getBoundingClientRect().height) : 0)
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
    pillRefs.current.forEach((pill) => {
      if (pill) observer.observe(pill);
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
            <StatusPill
              key={pill.key}
              ref={(node) => {
                pillRefs.current[index] = node;
              }}
              label={pill.label}
              icon={pill.icon}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function buildSubscriptionPills(detail: MemberDetail): PillSpec[] {
  const pills: PillSpec[] = [
    {
      key: 'subscription-state',
      label: detail.active_subscription ? 'Active' : 'No plan',
      icon: detail.active_subscription ? 'bolt' : 'credit_card_off',
    },
  ];

  if (detail.renewal?.kind === 'ends_soon') {
    pills.push({
      key: 'renewal',
      label: 'Renewal',
      icon: 'notification_important',
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
      });
    }
  }

  pills.push({
    key: 'today-status',
    label: detail.marked_attendance_today ? 'In today' : 'Not in today',
    icon: 'today',
  });

  return pills;
}

function toneClasses(tone: MemberDetail['status_highlights'][number]['tone']) {
  switch (tone) {
    case 'warning':
      return 'border-energy-300/70 bg-energy-50/90 text-black dark:border-energy-500/50 dark:bg-energy-500/15 dark:text-energy-100';
    case 'info':
      return 'border-brand-300/70 bg-brand-50/90 text-brand-900 dark:border-brand-500/40 dark:bg-brand-500/12 dark:text-brand-100';
    case 'success':
      return 'border-emerald-300/70 bg-emerald-50/90 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/12 dark:text-emerald-100';
    default:
      return 'border-black/12 bg-black/[0.04] text-black dark:border-white/12 dark:bg-white/[0.05] dark:text-white';
  }
}

function lifecycleBadgeVariant(state: Subscription['lifecycle_state']) {
  switch (state) {
    case 'active':
      return 'green' as const;
    case 'upcoming':
      return 'blue' as const;
    default:
      return 'gray' as const;
  }
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
    return b.start_date.localeCompare(a.start_date) || b.id - a.id;
  });
}

const PROFILE_EDIT_ROW_H = 'h-[3.25rem]';

const profileEditIconBtn = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/80 text-black shadow-sm shadow-black/5 transition-colors hover:bg-white disabled:opacity-45 sm:h-[3.25rem] sm:w-[3.25rem] dark:border-white/15 dark:bg-surface-dark/75 dark:text-white dark:hover:bg-surface-raised/80';

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
  inputMode,
  maxLength,
}: {
  label: string;
  displayValue: string;
  field: 'name' | 'phone';
  activeField: 'name' | 'phone' | null;
  draft: string;
  onDraftChange: (v: string) => void;
  onRequestEdit: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
  canEdit: boolean;
  wrapDisplayWords: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength: number;
}) {
  const editing = activeField === field;
  const labelClass =
    'shrink-0 font-label text-[0.66rem] font-bold uppercase tracking-[0.22em] text-black dark:text-white';

  if (editing) {
    return (
      <div className={`flex w-full min-w-0 items-center gap-1.5 sm:gap-2 ${PROFILE_EDIT_ROW_H}`}>
        <span className={labelClass}>{label}</span>
        <input
          ref={inputRef}
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

function Metric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[1.25rem] border border-black/10 bg-white/55 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
      <p className="font-label text-[0.62rem] font-bold uppercase tracking-[0.18em] text-black/55 dark:text-white/60">
        {label}
      </p>
      <p className="mt-2 text-lg font-black text-black dark:text-white">{value}</p>
    </div>
  );
}

function SubscriptionCard({
  memberId,
  sub,
  viewQuery,
  onComplete,
}: {
  memberId: string;
  sub: Subscription;
  viewQuery: string;
  onComplete: (subscription: Subscription) => void;
}) {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-headline text-2xl font-black italic uppercase tracking-tight text-black dark:text-white">
            {sub.service_type}
          </p>
          <p className="mt-2 text-sm text-black/60 dark:text-white/70">
            {formatFullDate(sub.start_date)} - {formatFullDate(sub.end_date)}
          </p>
          <p className="mt-1 text-xs text-black/60 dark:text-white/70">
            ₹{sub.amount.toLocaleString('en-IN')}
          </p>
        </div>
        <Badge variant={lifecycleBadgeVariant(sub.lifecycle_state)} icon={sub.lifecycle_state === 'active' ? 'bolt' : sub.lifecycle_state === 'upcoming' ? 'schedule' : 'history'}>
          {formatStatusLabel(sub.lifecycle_state)}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Sessions" value={`${sub.attended_sessions} / ${sub.total_sessions}`} />
        <Metric label="Remaining" value={sub.remaining_sessions} />
        <Metric label="Owner state" value={sub.owner_completed ? 'Completed' : 'Open'} />
      </div>

      <div className="flex flex-wrap gap-3 border-t border-black/10 pt-4 dark:border-white/10">
        <Link to={`/members/${memberId}/subscriptions/${sub.id}/attendance${viewQuery}`}>
          <Button variant="secondary" icon="calendar_month">
            Attendance dates
          </Button>
        </Link>
        {sub.can_mark_complete ? (
          <Button variant="danger" icon="task_alt" onClick={() => onComplete(sub)}>
            Mark complete
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export default function OwnerMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [archiving, setArchiving] = useState(false);
  const [archiveErr, setArchiveErr] = useState('');
  const [completionError, setCompletionError] = useState('');
  const [inlineField, setInlineField] = useState<null | 'name' | 'phone'>(null);
  const [inlineDraft, setInlineDraft] = useState('');
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const { data: detail, isLoading } = useQuery<MemberDetail>({
    queryKey: ['member-detail', id],
    queryFn: () => api.get(`/api/members/${id}`),
  });

  const { data: subs = [] } = useQuery<Subscription[]>({
    queryKey: ['member-subs', id],
    queryFn: () => api.get(`/api/members/${id}/subscriptions`),
    enabled: !!id,
  });

  async function invalidateMemberQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['member-detail', id] }),
      queryClient.invalidateQueries({ queryKey: ['member-subs', id] }),
      queryClient.invalidateQueries({ queryKey: ['owner-members'] }),
      queryClient.invalidateQueries({ queryKey: ['owner-home'] }),
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
        await api.patch(`/api/members/${id}`, { full_name: trimmed });
        setInlineField(null);
        await invalidateMemberQueries();
      } catch (error) {
        setInlineError(error instanceof ApiError ? error.message : 'Failed to update name');
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
      await api.patch(`/api/members/${id}`, { phone: normalizedPhone });
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
    }
  }, [inlineField]);

  async function handleComplete(subscription: Subscription) {
    if (!subscription.can_mark_complete) return;
    if (!confirm(`Mark ${subscription.service_type} complete? This cannot be undone.`)) return;

    setCompletionError('');
    try {
      await api.post(`/api/subscriptions/${subscription.id}/complete`);
      await invalidateMemberQueries();
    } catch (error) {
      setCompletionError(error instanceof ApiError ? error.message : 'Could not mark subscription complete');
    }
  }

  if (isLoading) {
    return (
      <AppShell links={ownerLinks}>
        <div className="page-stack">
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!detail || !id) return null;

  const requestedView = searchParams.get('view');
  const preservedView = normalizeOwnerMemberListView(requestedView)
    ? normalizeOwnerMemberListView(requestedView)!
    : detail.status === 'archived'
      ? 'archived'
      : 'all';
  const viewQuery = preservedView === 'all' ? '' : `?view=${encodeURIComponent(preservedView)}`;
  const backLink = `/members${viewQuery}`;
  const backLabel = preservedView === 'all' ? 'All Active' : MEMBER_VIEW_BACK_LABELS[preservedView];

  const orderedSubs = sortSubscriptions(subs);
  const groupedSubs = {
    active: orderedSubs.filter((sub) => sub.lifecycle_state === 'active'),
    upcoming: orderedSubs.filter((sub) => sub.lifecycle_state === 'upcoming'),
    past: orderedSubs.filter((sub) => sub.lifecycle_state === 'completed'),
  };
  const visibleStatusHighlights = detail.status_highlights.filter(
    (highlight) => highlight.key !== 'consistency_at_risk' && highlight.key !== 'consistent',
  );

  return (
    <AppShell links={ownerLinks}>
      <div className="page-stack max-w-5xl">
        <Link to={backLink} className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {backLabel}
        </Link>

        <div>
          <h2 className="page-title">Member Profile</h2>
        </div>

        <div className="grid w-full gap-2">
          <div className="surface-inset surface-inset--owner-compact">
            <OwnerInlineProfileRow
              label="Name"
              displayValue={detail.full_name}
              field="name"
              activeField={inlineField}
              draft={inlineDraft}
              onDraftChange={setInlineDraft}
              onRequestEdit={() => {
                setInlineError('');
                setInlineDraft(detail.full_name);
                setInlineField('name');
              }}
              onCancel={() => {
                setInlineField(null);
                setInlineError('');
              }}
              onConfirm={confirmInlineProfileEdit}
              saving={inlineSaving}
              canEdit={detail.can_edit_profile}
              wrapDisplayWords
              inputRef={nameInputRef}
              maxLength={120}
            />
          </div>
          <div className="surface-inset surface-inset--owner-compact">
            <ProfileFieldRow compact label="Email" value={detail.email} />
          </div>
          <div className="surface-inset surface-inset--owner-compact">
            <OwnerInlineProfileRow
              label="Mobile"
              displayValue={detail.phone}
              field="phone"
              activeField={inlineField}
              draft={inlineDraft}
              onDraftChange={setInlineDraft}
              onRequestEdit={() => {
                setInlineError('');
                setInlineDraft(detail.phone.replace(/\D+/g, '').slice(0, 10));
                setInlineField('phone');
              }}
              onCancel={() => {
                setInlineField(null);
                setInlineError('');
              }}
              onConfirm={confirmInlineProfileEdit}
              saving={inlineSaving}
              canEdit={detail.can_edit_profile}
              wrapDisplayWords={false}
              inputRef={phoneInputRef}
              inputMode="numeric"
              maxLength={10}
            />
          </div>
          <div className="surface-inset surface-inset--owner-compact">
            <div className="flex min-h-[3.25rem] items-center justify-between gap-3">
              <span className="shrink-0 font-label text-[0.66rem] font-bold uppercase tracking-[0.22em] text-black dark:text-white">
                Member since
              </span>
              <div className="min-w-0 flex-1 text-right">
                <p className="text-base font-semibold text-black dark:text-white">{formatJoinDate(detail.join_date)}</p>
                <p className="mt-0.5 text-xs font-medium text-black/55 dark:text-white/60">
                  {formatMembershipAge(detail.join_date)}
                </p>
              </div>
            </div>
          </div>
          <CompactPillCard label="Subscription" pills={buildSubscriptionPills(detail)} />
          <CompactPillCard label="Consistency" pills={buildConsistencyPills(detail)} />
        </div>
        {detail.can_edit_profile ? (
          <p className="min-h-[1.125rem] text-xs leading-[1.125rem] text-red-600 dark:text-red-400" aria-live="polite">
            {inlineError || '\u00a0'}
          </p>
        ) : null}

        <div className="grid gap-3">
          {visibleStatusHighlights.map((highlight) => (
            <div
              key={highlight.key}
              className={`rounded-[1.35rem] border px-4 py-4 shadow-sm shadow-black/5 ${toneClasses(highlight.tone)}`}
            >
              <p className="font-label text-[0.66rem] font-bold uppercase tracking-[0.18em]">
                {highlight.label}
              </p>
              {highlight.detail ? (
                <p className="mt-2 text-sm font-medium leading-snug">{highlight.detail}</p>
              ) : null}
            </div>
          ))}
        </div>

        <Card className="space-y-4 border border-red-200 bg-red-50/55 p-5 shadow-sm shadow-black/5 dark:border-red-900/60 dark:bg-red-950/15">
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
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-black/10 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div>
                    <p className="text-sm font-semibold text-black dark:text-white">{blocker.service_type}</p>
                    <p className="text-xs text-black/60 dark:text-white/70">
                      {formatStatusLabel(blocker.lifecycle_state)} • {formatFullDate(blocker.start_date)} - {formatFullDate(blocker.end_date)}
                    </p>
                  </div>
                  <Link to={`/members/${id}/subscriptions/${blocker.subscription_id}/attendance${viewQuery}`}>
                    <Button variant="secondary" icon="calendar_month">
                      Review & complete
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

        <div className="space-y-4">
          <SectionHeading
            eyebrow="Subscription history"
            title="Past, active, and upcoming plans"
            description="Attendance dates, progress, and completion all stay attached to the exact subscription they belong to."
          />

          {completionError ? <Alert variant="error">{completionError}</Alert> : null}

          {subs.length === 0 ? (
            <div className="empty-state">No subscriptions yet.</div>
          ) : (
            <div className="space-y-6">
              {([
                ['active', groupedSubs.active, 'Active subscriptions'],
                ['upcoming', groupedSubs.upcoming, 'Upcoming subscriptions'],
                ['past', groupedSubs.past, 'Past subscriptions'],
              ] as const).map(([key, items, heading]) => (
                items.length > 0 ? (
                  <div key={key} className="space-y-3">
                    <p className="section-eyebrow">{heading}</p>
                    <div className="space-y-3">
                      {items.map((sub) => (
                        <SubscriptionCard
                          key={sub.id}
                          memberId={id}
                          sub={sub}
                          viewQuery={viewQuery}
                          onComplete={handleComplete}
                        />
                      ))}
                    </div>
                  </div>
                ) : null
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
