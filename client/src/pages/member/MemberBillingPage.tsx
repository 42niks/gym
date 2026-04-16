import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type MemberHome, type Subscription } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Badge from '../../components/Badge.js';
import Icon from '../../components/Icon.js';
import Spinner from '../../components/Spinner.js';
import MemberRenewalAlert from '../../components/member/MemberRenewalAlert.js';
import { memberLinks } from './memberLinks.js';

function parseDateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function toUtcDate(value: string) {
  const { year, month, day } = parseDateParts(value);
  return new Date(Date.UTC(year, month - 1, day));
}

function getIstTodayDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDateRange(startDate: string, endDate: string) {
  return `${formatLongDate(startDate)} – ${formatLongDate(endDate)}`;
}

function formatLongDate(date: string) {
  return toUtcDate(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getDaysLeft(endDate: string) {
  const today = toUtcDate(getIstTodayDateString());
  const end = toUtcDate(endDate);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
}

function formatAmount(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function getCompletionPercent(sub: Subscription) {
  if (sub.total_sessions === 0) return 0;
  return Math.round((sub.attended_sessions / sub.total_sessions) * 100);
}

function sortUpcoming(subs: Subscription[]) {
  return [...subs].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id);
}

function sortPast(subs: Subscription[]) {
  return [...subs].sort((a, b) => b.start_date.localeCompare(a.start_date) || b.id - a.id);
}

function sortCurrent(subs: Subscription[]) {
  return [...subs].sort((a, b) => b.start_date.localeCompare(a.start_date) || b.id - a.id);
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <h3 className="font-label text-[0.7rem] font-bold uppercase tracking-[0.3em] text-black dark:text-white">
      {label}
      {typeof count === 'number' && count > 0 ? ` ${count}` : ''}
    </h3>
  );
}

function AttendanceDatesLink({
  subscriptionId,
  className,
}: {
  subscriptionId: number;
  className?: string;
}) {
  return (
    <Link
      to={`/subscription/${subscriptionId}/attendance`}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-black bg-black/[0.04] px-3 py-2 font-label text-[0.64rem] font-bold uppercase tracking-[0.14em] text-black transition-all hover:-translate-y-0.5 hover:bg-black/[0.08] hover:text-black dark:border-white dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08] dark:hover:text-white ${className ?? ''}`}
    >
      <Icon name="calendar_month" className="text-[1.05rem]" />
      See attendance
    </Link>
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
              <p className="font-headline text-[1.45rem] font-black italic uppercase leading-[0.96] tracking-tight text-black dark:text-white sm:text-[1.6rem]">
                {sub.service_type}
              </p>
              <p className="mt-1.5 text-xs font-medium text-black/70 dark:text-white/75">
                {formatDateRange(sub.start_date, sub.end_date)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="orange" icon="bolt">
                active
              </Badge>
              <AttendanceDatesLink subscriptionId={sub.id} />
            </div>
          </div>

          <div className="flex items-end gap-4">
            <span className="font-headline text-[4.6rem] font-black italic leading-[0.78] tracking-[-0.05em] text-black dark:text-white sm:text-[5.4rem]">
              {sub.remaining_sessions}
            </span>
            <span className="pb-2 font-label text-[0.72rem] font-bold italic uppercase leading-[1.15] tracking-[0.18em] text-black/70 dark:text-white/75">
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
            <div className="mt-2.5 flex items-center justify-between text-[0.74rem] font-semibold text-black/70 dark:text-white/75">
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

          <div className="space-y-3 border-t border-black pt-3.5 dark:border-white">
            <div className="flex items-center justify-between">
              <span className="font-label text-[0.62rem] font-bold uppercase tracking-[0.2em] text-black/60 dark:text-white/70">
                Paid
              </span>
              <span className="text-sm font-semibold text-black dark:text-white">
                {formatAmount(sub.amount)}
              </span>
            </div>
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
            <p className="font-headline text-[1.3rem] font-black italic uppercase leading-[0.98] tracking-tight text-black dark:text-white">
              {sub.service_type}
            </p>
            <p className="mt-1.5 text-xs text-black/60 dark:text-white/70">
              Starts {formatLongDate(sub.start_date)}
            </p>
          </div>
          <Badge variant="orange" icon="schedule">
            upcoming
          </Badge>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="text-xs font-semibold text-black/70 dark:text-white/75">
            {sub.total_sessions} sessions
          </span>
          <span className="text-sm font-semibold text-black dark:text-white">
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
      ? 'bg-black/25 dark:bg-white/25'
      : 'bg-black/15 dark:bg-white/15';

  return (
    <Card className="px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-headline text-[1.2rem] font-black italic uppercase leading-[1.02] tracking-tight text-black dark:text-white">
            {sub.service_type}
          </p>
          <p className="mt-1.5 text-xs text-black/60 dark:text-white/70">
            {formatDateRange(sub.start_date, sub.end_date)}
          </p>
        </div>
        <Badge variant="gray" icon="check_circle">
          {sub.lifecycle_state}
        </Badge>
      </div>
      <div className="mt-3">
        <AttendanceDatesLink subscriptionId={sub.id} />
      </div>

      <div className="mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
          <div className={`h-full rounded-full ${barClass}`} style={{ width: `${completion}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-black/60 dark:text-white/70">
          <span>
            {sub.attended_sessions} of {sub.total_sessions} used · {completion}%
          </span>
          <span className="font-semibold text-black/70 dark:text-white/75">
            {formatAmount(sub.amount)}
          </span>
        </div>
      </div>

    </Card>
  );
}

export default function MemberBillingPage() {
  const { data: homeData } = useQuery<MemberHome>({
    queryKey: ['member-home'],
    queryFn: () => api.get('/api/member/home'),
  });

  const { data = [], isLoading } = useQuery<Subscription[]>({
    queryKey: ['member-subscription'],
    queryFn: () => api.get('/api/member/subscription'),
  });

  const current = sortCurrent(data.filter(s => s.lifecycle_state === 'active'));
  const upcoming = sortUpcoming(data.filter(s => s.lifecycle_state === 'upcoming'));
  const past = sortPast(data.filter(s => s.lifecycle_state === 'completed'));

  return (
    <AppShell links={memberLinks}>
      <div className="page-stack space-y-6">
        <div>
          <h2 className="page-title">SUBSCRIPTION</h2>
        </div>

        {homeData?.renewal?.kind === 'ends_soon' ? (
          <MemberRenewalAlert message={homeData.renewal.message} />
        ) : null}

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
