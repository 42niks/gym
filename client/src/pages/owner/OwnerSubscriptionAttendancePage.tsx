import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError, type MemberSubscriptionAttendance } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Alert from '../../components/Alert.js';
import AttendanceCalendar, {
  buildCalendarWeeks,
  formatConsistencyRule,
  formatFullDate,
  formatStatusLabel,
} from '../../components/attendance/AttendanceCalendar.js';
import Button from '../../components/Button.js';
import Card from '../../components/Card.js';
import Spinner from '../../components/Spinner.js';
import { ownerLinks } from './ownerLinks.js';

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

function isValidYmdDate(value: string) {
  return parseDateParts(value) !== null;
}

function formatSafeFullDate(value: string) {
  return isValidYmdDate(value) ? formatFullDate(value) : 'Unavailable';
}

function formatSafeConsistencyRule(minDays: number, windowDays: number) {
  if (!Number.isFinite(minDays) || !Number.isFinite(windowDays) || minDays <= 0 || windowDays <= 0) {
    return 'Unavailable';
  }

  return formatConsistencyRule(minDays, windowDays);
}

function formatSafeStatus(value: string) {
  if (value === 'active' || value === 'upcoming' || value === 'completed') {
    return formatStatusLabel(value);
  }

  return 'Unknown';
}

function formatSafeSessionSummary(attendedSessions: number, totalSessions: number) {
  const total = Number.isFinite(totalSessions) ? Math.max(0, Math.trunc(totalSessions)) : 0;
  const attended = Number.isFinite(attendedSessions) ? Math.max(0, Math.trunc(attendedSessions)) : 0;
  return `${Math.min(attended, total)} / ${total}`;
}

function SummaryField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7.25rem_minmax(0,1fr)] items-start gap-4 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:px-5">
      <dt className="font-label text-[0.62rem] font-bold uppercase tracking-[0.18em] text-black/60 dark:text-white/70">
        {label}
      </dt>
      <dd className="min-w-0 text-sm font-semibold text-black dark:text-white">
        {value}
      </dd>
    </div>
  );
}

export default function OwnerSubscriptionAttendancePage() {
  const { id, subscriptionId } = useParams<{ id: string; subscriptionId: string }>();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const viewQuery = view ? `?view=${encodeURIComponent(view)}` : '';
  const [error, setError] = useState('');
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const { data, isLoading } = useQuery<MemberSubscriptionAttendance>({
    queryKey: ['owner-subscription-attendance', id, subscriptionId],
    enabled: !!id && !!subscriptionId,
    queryFn: () => api.get(`/api/members/${id}/subscriptions/${subscriptionId}/attendance`),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ date, attended }: { date: string; attended: boolean }) => {
      setPendingDate(date);
      if (attended) {
        return api.delete(`/api/members/${id}/subscriptions/${subscriptionId}/attendance/${date}`);
      }
      return api.post(`/api/members/${id}/subscriptions/${subscriptionId}/attendance`, { date });
    },
    onSuccess: async () => {
      setError('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['owner-subscription-attendance', id, subscriptionId] }),
        queryClient.invalidateQueries({ queryKey: ['member-subs', id] }),
        queryClient.invalidateQueries({ queryKey: ['member-detail', id] }),
        queryClient.invalidateQueries({ queryKey: ['owner-members'] }),
        queryClient.invalidateQueries({ queryKey: ['owner-home'] }),
      ]);
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof ApiError ? mutationError.message : 'Could not update attendance date');
    },
    onSettled: () => {
      setPendingDate(null);
    },
  });

  async function handleComplete() {
    if (!data?.can_mark_complete) return;
    if (!confirm('Mark this subscription complete? This cannot be undone.')) return;

    setCompleting(true);
    setError('');
    try {
      await api.post(`/api/subscriptions/${data.subscription.id}/complete`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['owner-subscription-attendance', id, subscriptionId] }),
        queryClient.invalidateQueries({ queryKey: ['member-subs', id] }),
        queryClient.invalidateQueries({ queryKey: ['member-detail', id] }),
        queryClient.invalidateQueries({ queryKey: ['owner-members'] }),
        queryClient.invalidateQueries({ queryKey: ['owner-home'] }),
      ]);
    } catch (mutationError) {
      setError(mutationError instanceof ApiError ? mutationError.message : 'Could not mark subscription complete');
    } finally {
      setCompleting(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell links={ownerLinks}>
        <div className="page-stack max-w-5xl">
          <Link to={`/members/${id}${viewQuery}`} className="back-link">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Member Profile
          </Link>
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell links={ownerLinks}>
        <div className="page-stack max-w-5xl">
          <Link to={`/members/${id}${viewQuery}`} className="back-link">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Member Profile
          </Link>
          <div className="empty-state">Could not load attendance dates.</div>
        </div>
      </AppShell>
    );
  }

  const attendedDates = Array.isArray(data.attended_dates)
    ? data.attended_dates.filter((date): date is string => typeof date === 'string')
    : [];
  const weeks = buildCalendarWeeks(
    data.subscription.start_date,
    data.subscription.end_date,
    attendedDates,
  );
  const subscriptionName = typeof data.subscription.service_type === 'string' && data.subscription.service_type.trim()
    ? data.subscription.service_type.trim()
    : 'Subscription';
  const periodValue = weeks
    ? `${formatFullDate(data.subscription.start_date)} - ${formatFullDate(data.subscription.end_date)}`
    : `${formatSafeFullDate(data.subscription.start_date)} - ${formatSafeFullDate(data.subscription.end_date)}`;

  const isDateInteractive = (date: string) => (
    data.can_edit_dates
    && date >= data.editable_start_date
    && date <= data.editable_end_date
  );

  return (
    <AppShell links={ownerLinks}>
      <div className="page-stack max-w-5xl">
        <Link to={`/members/${id}${viewQuery}`} className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Member Profile
        </Link>

        <div>
          <h2 className="page-title">Attendance dates</h2>
        </div>

        <Card className="max-w-4xl overflow-hidden py-1">
          <dl className="divide-y divide-black/10 dark:divide-white/10">
            <SummaryField label="Name" value={subscriptionName} />
            <SummaryField
              label="Period"
              value={periodValue}
            />
            <SummaryField label="Status" value={formatSafeStatus(data.subscription.lifecycle_state)} />
            <SummaryField
              label="Consistency rule"
              value={formatSafeConsistencyRule(
                data.consistency_rule.min_days,
                data.consistency_rule.window_days,
              )}
            />
            <SummaryField
              label="Sessions"
              value={formatSafeSessionSummary(data.subscription.attended_sessions, data.subscription.total_sessions)}
            />
          </dl>
        </Card>

        {error ? <Alert variant="error">{error}</Alert> : null}

        {weeks ? (
          <AttendanceCalendar
            weeks={weeks}
            consistencyWindow={data.consistency_window}
            isDateInteractive={(date) => isDateInteractive(date)}
            onSelectDate={(date, attended) => toggleMutation.mutate({ date, attended })}
            pendingDate={pendingDate}
            interactiveAppearance="member-like"
          />
        ) : (
          <div className="empty-state">Attendance calendar dates are invalid for this subscription.</div>
        )}

        {data.can_mark_complete ? (
          <div className="flex justify-start">
            <Button
              variant="danger"
              onClick={handleComplete}
              disabled={completing}
              icon={completing ? 'progress_activity' : 'task_alt'}
            >
              {completing ? 'Completing…' : 'Mark complete'}
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
