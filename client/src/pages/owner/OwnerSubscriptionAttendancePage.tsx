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
            Member
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
            Member
          </Link>
          <div className="empty-state">Could not load attendance dates.</div>
        </div>
      </AppShell>
    );
  }

  const weeks = buildCalendarWeeks(
    data.subscription.start_date,
    data.subscription.end_date,
    data.attended_dates,
  );

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
          Member
        </Link>

        <div className="space-y-3">
          <p className="section-eyebrow">Subscription workspace</p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="page-title">Attendance dates</h2>
              <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/70">
                Tap any day inside the subscription period to add or remove that exact attendance date.
              </p>
            </div>
            {data.can_mark_complete ? (
              <Button
                variant="danger"
                onClick={handleComplete}
                disabled={completing}
                icon={completing ? 'progress_activity' : 'task_alt'}
              >
                {completing ? 'Completing…' : 'Mark complete'}
              </Button>
            ) : null}
          </div>
        </div>

        <Card className="max-w-4xl overflow-hidden py-1">
          <dl className="divide-y divide-black/10 dark:divide-white/10">
            <SummaryField label="Name" value={data.subscription.service_type} />
            <SummaryField
              label="Period"
              value={`${formatFullDate(data.subscription.start_date)} - ${formatFullDate(data.subscription.end_date)}`}
            />
            <SummaryField label="Status" value={formatStatusLabel(data.subscription.lifecycle_state)} />
            <SummaryField
              label="Consistency rule"
              value={formatConsistencyRule(
                data.consistency_rule.min_days,
                data.consistency_rule.window_days,
              )}
            />
            <SummaryField
              label="Sessions"
              value={`${data.subscription.attended_sessions} / ${data.subscription.total_sessions}`}
            />
            <SummaryField
              label="Editable range"
              value={`${formatFullDate(data.editable_start_date)} - ${formatFullDate(data.editable_end_date)}`}
            />
          </dl>
        </Card>

        <Alert variant="info">
          Future dates inside the subscription period are allowed here. Attendance is still limited to one entry per member per calendar date.
        </Alert>

        {error ? <Alert variant="error">{error}</Alert> : null}

        {weeks ? (
          <AttendanceCalendar
            weeks={weeks}
            consistencyWindow={data.consistency_window}
            isDateInteractive={(date) => isDateInteractive(date)}
            onSelectDate={(date, attended) => toggleMutation.mutate({ date, attended })}
            pendingDate={pendingDate}
          />
        ) : (
          <div className="empty-state">Attendance calendar dates are invalid for this subscription.</div>
        )}

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-4 dark:border-white/10 sm:px-5">
            <div>
              <p className="section-eyebrow">Audit trail</p>
              <h3 className="mt-1 text-lg font-bold text-black dark:text-white">Marked dates</h3>
            </div>
            <p className="text-sm font-semibold text-black/70 dark:text-white/75">
              {data.attended_dates.length} total
            </p>
          </div>
          {data.attended_dates.length === 0 ? (
            <div className="px-4 py-5 text-sm text-black/65 dark:text-white/70 sm:px-5">
              No attendance dates are marked yet for this subscription.
            </div>
          ) : (
            <div className="divide-y divide-black/10 dark:divide-white/10">
              {data.attended_dates.map((value) => (
                <div key={value} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-sm font-semibold text-black dark:text-white">{formatFullDate(value)}</p>
                    <p className="text-xs text-black/60 dark:text-white/70">{value}</p>
                  </div>
                  <Button
                    variant="ghost"
                    className="py-0 text-xs"
                    icon="delete"
                    disabled={toggleMutation.isPending}
                    onClick={() => toggleMutation.mutate({ date: value, attended: true })}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
