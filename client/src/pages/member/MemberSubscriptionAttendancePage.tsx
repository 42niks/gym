import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api, type MemberSubscriptionAttendance } from '../../lib/api.js';
import Card from '../../components/Card.js';
import Spinner from '../../components/Spinner.js';
import AttendanceCalendar, {
  buildCalendarWeeks,
  formatConsistencyRule,
  formatFullDate,
  formatStatusLabel,
  getIncomingFocusAlpha,
} from '../../components/attendance/AttendanceCalendar.js';

export { getIncomingFocusAlpha };

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

export default function MemberSubscriptionAttendancePage() {
  const { id } = useParams();
  const subscriptionId = Number(id);
  const isValidSubscriptionId = Number.isInteger(subscriptionId) && subscriptionId > 0;

  const { data, isLoading, error } = useQuery<MemberSubscriptionAttendance>({
    queryKey: ['member-subscription-attendance', subscriptionId],
    enabled: isValidSubscriptionId,
    queryFn: () => api.get(`/api/member/subscription/${subscriptionId}/attendance`),
  });

  if (!isValidSubscriptionId) {
    return (
      <div className="page-stack max-w-5xl">
        <Link to="/subscription" className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Subscription
        </Link>
        <div className="empty-state">Invalid subscription.</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page-stack max-w-5xl">
        <Link to="/subscription" className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Subscription
        </Link>
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="page-stack max-w-5xl">
        <Link to="/subscription" className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Subscription
        </Link>
        <div className="empty-state">
          {error instanceof Error ? error.message : 'Could not load attendance dates.'}
        </div>
      </div>
    );
  }

  const weeks = buildCalendarWeeks(
    data.subscription.start_date,
    data.subscription.end_date,
    data.attended_dates,
  );
  const hasValidCalendarRange = weeks !== null;

  return (
    <div className="page-stack max-w-5xl">
        <Link to="/subscription" className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Subscription
        </Link>

        <div>
          <h2 className="page-title">Attendance dates</h2>
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
            <SummaryField label="Check-ins" value={data.attended_dates.length} />
          </dl>
        </Card>

        {data.attended_dates.length === 0 ? (
          <div className="rounded-2xl border border-black px-4 py-3 text-sm font-medium text-black dark:border-white dark:text-white">
            No sessions have been marked in this subscription yet.
          </div>
        ) : null}

        {hasValidCalendarRange ? (
          <AttendanceCalendar weeks={weeks} consistencyWindow={data.consistency_window} />
        ) : (
          <div className="empty-state">Attendance calendar dates are invalid for this subscription.</div>
        )}
    </div>
  );
}
