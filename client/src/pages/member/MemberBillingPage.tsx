import { useQuery } from '@tanstack/react-query';
import { api, type GroupedSubscriptions, type Subscription } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Badge from '../../components/Badge.js';
import Spinner from '../../components/Spinner.js';

const memberLinks = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/billing', label: 'Billing', icon: 'credit_card' },
  { to: '/profile', label: 'Profile', icon: 'person' },
];

function formatDateRange(startDate: string, endDate: string) {
  return `${formatLongDate(startDate)} – ${formatLongDate(endDate)}`;
}

function formatLongDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getDaysLeft(endDate: string) {
  const today = new Date();
  const end = new Date(`${endDate}T00:00:00`);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.ceil((end.getTime() - startOfToday.getTime()) / 86400000));
}

function formatAmount(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function getCompletionPercent(sub: Subscription) {
  if (sub.total_sessions === 0) return 0;
  return Math.round((sub.attended_sessions / sub.total_sessions) * 100);
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <h3 className="font-label text-[0.7rem] font-bold italic uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
        {label}
      </h3>
      {typeof count === 'number' && count > 0 ? (
        <span className="font-label text-[0.66rem] font-bold italic tracking-[0.18em] text-gray-500 dark:text-gray-400">
          {count}
        </span>
      ) : null}
    </div>
  );
}

function CurrentCard({ sub }: { sub: Subscription }) {
  const completion = getCompletionPercent(sub);
  const daysLeft = getDaysLeft(sub.end_date);
  const isEndingSoon = daysLeft <= 14;

  return (
    <Card className="billing-current-card">
      <div className="billing-current-card-inner px-5 py-6 sm:px-6 sm:py-7">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-headline text-[1.45rem] font-black italic uppercase leading-[0.96] tracking-tight text-gray-900 dark:text-white sm:text-[1.6rem]">
                {sub.service_type}
              </p>
              <p className="mt-1.5 text-xs font-medium text-gray-700/80 dark:text-white/65">
                {formatDateRange(sub.start_date, sub.end_date)}
              </p>
            </div>
            <Badge variant="orange" icon="bolt">
              active
            </Badge>
          </div>

          <div className="flex items-end gap-4">
            <span className="font-headline text-[4.6rem] font-black italic leading-[0.78] tracking-[-0.05em] text-gray-900 dark:text-white sm:text-[5.4rem]">
              {sub.remaining_sessions}
            </span>
            <span className="pb-2 font-label text-[0.72rem] font-bold italic uppercase leading-[1.15] tracking-[0.18em] text-gray-700/85 dark:text-white/75">
              sessions
              <br />
              left
            </span>
          </div>

          <div>
            <div className="h-2 overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-energy-400 dark:bg-energy-300"
                style={{ width: `${completion}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[0.74rem] font-semibold text-gray-700/80 dark:text-white/70">
              <span>
                {sub.attended_sessions} of {sub.total_sessions} used
              </span>
              <span
                className={
                  isEndingSoon
                    ? 'flex items-center gap-1 text-accent-500 dark:text-accent-400'
                    : ''
                }
              >
                {isEndingSoon ? (
                  <span className="material-symbols-outlined text-[0.95rem]">schedule</span>
                ) : null}
                {daysLeft} days left
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.08] pt-3.5 dark:border-white/[0.08]">
            <span className="font-label text-[0.62rem] font-bold italic uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              Paid
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {formatAmount(sub.amount)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function UpcomingCard({ sub }: { sub: Subscription }) {
  return (
    <Card className="relative overflow-hidden px-5 py-5">
      <div
        aria-hidden="true"
        className="absolute inset-y-5 left-0 w-1.5 rounded-r-full bg-energy-400 dark:bg-energy-300"
      />
      <div className="ml-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-headline text-[1.3rem] font-black italic uppercase leading-[0.98] tracking-tight text-gray-900 dark:text-white">
              {sub.service_type}
            </p>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Starts {formatLongDate(sub.start_date)}
            </p>
          </div>
          <Badge variant="orange" icon="schedule">
            upcoming
          </Badge>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {sub.total_sessions} sessions
          </span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {formatAmount(sub.amount)}
          </span>
        </div>
      </div>
    </Card>
  );
}

function PastCard({ sub }: { sub: Subscription }) {
  const completion = getCompletionPercent(sub);
  const barClass =
    completion >= 80
      ? 'bg-brand-500 dark:bg-brand-300'
      : completion >= 30
      ? 'bg-gray-400 dark:bg-gray-500'
      : 'bg-gray-300 dark:bg-gray-700';

  return (
    <Card className="px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-headline text-[1.2rem] font-black italic uppercase leading-[1.02] tracking-tight text-gray-900 dark:text-white">
            {sub.service_type}
          </p>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            {formatDateRange(sub.start_date, sub.end_date)}
          </p>
        </div>
        <Badge variant="gray" icon="check_circle">
          {sub.lifecycle_state}
        </Badge>
      </div>

      <div className="mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
          <div className={`h-full rounded-full ${barClass}`} style={{ width: `${completion}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {sub.attended_sessions} of {sub.total_sessions} used · {completion}%
          </span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            {formatAmount(sub.amount)}
          </span>
        </div>
      </div>
    </Card>
  );
}

export default function MemberBillingPage() {
  const { data, isLoading } = useQuery<GroupedSubscriptions>({
    queryKey: ['member-billing'],
    queryFn: () => api.get('/api/me/subscriptions'),
  });

  const upcoming = data?.upcoming ?? [];
  const current = (data?.completed_and_active ?? []).filter(s => s.lifecycle_state === 'active');
  const past = (data?.completed_and_active ?? []).filter(s => s.lifecycle_state !== 'active');

  return (
    <AppShell links={memberLinks}>
      <div className="page-stack space-y-6">
        <div>
          <h2 className="page-title">Billing</h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <SectionHeader label="Current" />
              {current.length === 0 ? (
                <div className="empty-state">No active package</div>
              ) : (
                <div className="space-y-3">
                  {current.map(s => (
                    <CurrentCard key={s.id} sub={s} />
                  ))}
                </div>
              )}
            </section>

            {upcoming.length > 0 ? (
              <section className="space-y-3">
                <SectionHeader label="Upcoming" count={upcoming.length} />
                <div className="space-y-3">
                  {upcoming.map(s => (
                    <UpcomingCard key={s.id} sub={s} />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <SectionHeader label="Past" count={past.length} />
              {past.length === 0 ? (
                <div className="empty-state">No past packages</div>
              ) : (
                <div className="space-y-3">
                  {past.map(s => (
                    <PastCard key={s.id} sub={s} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
