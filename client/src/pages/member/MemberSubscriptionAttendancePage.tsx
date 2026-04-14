import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api, type MemberSubscriptionAttendance } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Spinner from '../../components/Spinner.js';
import { memberLinks } from './memberLinks.js';

const weekdayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function parseDateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function toUtcDate(value: string) {
  const { year, month, day } = parseDateParts(value);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDayNumber(value: string) {
  return String(parseDateParts(value).day);
}

function formatMonthLabel(value: string) {
  return toUtcDate(value).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatFullDate(value: string) {
  return toUtcDate(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function listMonthStarts(startDate: string, endDate: string) {
  const months: string[] = [];
  const start = toUtcDate(startDate);
  const end = toUtcDate(endDate);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor.getTime() <= lastMonth.getTime()) {
    months.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

function buildCalendarMonths(startDate: string, endDate: string, attendedDates: string[]) {
  const attended = new Set(attendedDates);

  return listMonthStarts(startDate, endDate)
    .map(monthStart => {
      const monthDate = toUtcDate(monthStart);
      const year = monthDate.getUTCFullYear();
      const monthIndex = monthDate.getUTCMonth();
      const firstWeekday = monthDate.getUTCDay();
      const totalDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
      const cells: Array<{ date: string; attended: boolean } | null> = [];

      for (let index = 0; index < firstWeekday; index += 1) {
        cells.push(null);
      }

      for (let day = 1; day <= totalDays; day += 1) {
        const date = new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
        if (date < startDate || date > endDate) {
          cells.push(null);
          continue;
        }

        cells.push({
          date,
          attended: attended.has(date),
        });
      }

      while (cells.length % 7 !== 0) {
        cells.push(null);
      }

      const weeks = [];
      for (let index = 0; index < cells.length; index += 7) {
        weeks.push(cells.slice(index, index + 7));
      }

      return {
        key: monthStart,
        label: formatMonthLabel(monthStart),
        attendedCount: weeks.flat().filter(cell => cell?.attended).length,
        weeks,
      };
    })
    .reverse();
}

function MonthCalendar({
  label,
  attendedCount,
  monthKey,
  weeks,
}: {
  label: string;
  attendedCount: number;
  monthKey: string;
  weeks: Array<Array<{ date: string; attended: boolean } | null>>;
}) {
  const titleId = `attendance-month-${monthKey}`;

  return (
    <Card className="overflow-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3
            id={titleId}
            className="font-headline text-[1.6rem] font-black uppercase leading-none tracking-tight text-black dark:text-white"
          >
            {label}
          </h3>
          <p className="mt-1.5 text-xs font-semibold text-black/70 dark:text-white/75">
            {attendedCount} {attendedCount === 1 ? 'check-in' : 'check-ins'}
          </p>
        </div>
      </div>

      <div role="grid" aria-labelledby={titleId} className="mt-5 space-y-2">
        <div role="row" className="grid grid-cols-7 gap-2">
          {weekdayLabels.map(day => (
            <div
              key={day}
              role="columnheader"
              className="text-center font-label text-[0.6rem] font-bold uppercase tracking-[0.16em] text-black/60 dark:text-white/70"
            >
              {day}
            </div>
          ))}
        </div>

        {weeks.map((week, index) => (
          <div key={`${monthKey}-${index}`} role="row" className="grid grid-cols-7 gap-2">
            {week.map((cell, cellIndex) => {
              if (!cell) {
                return <div key={`${monthKey}-${index}-${cellIndex}`} aria-hidden="true" className="aspect-square" />;
              }

              return (
                <div
                  key={cell.date}
                  role="gridcell"
                  aria-label={cell.attended ? `Attended on ${formatFullDate(cell.date)}` : formatFullDate(cell.date)}
                  className={
                    cell.attended
                      ? 'brand-duotone-button flex aspect-square items-center justify-center rounded-[1.15rem] border border-black text-sm font-black text-black shadow-panel dark:border-white dark:text-white'
                      : 'flex aspect-square items-center justify-center text-sm font-semibold text-black dark:text-white'
                  }
                >
                  {formatDayNumber(cell.date)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
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
      <AppShell links={memberLinks}>
        <div className="page-stack max-w-5xl">
          <Link to="/subscription" className="back-link">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Subscription
          </Link>
          <div className="empty-state">Invalid subscription.</div>
        </div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell links={memberLinks}>
        <div className="page-stack max-w-5xl">
          <Link to="/subscription" className="back-link">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Subscription
          </Link>
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!data || error) {
    return (
      <AppShell links={memberLinks}>
        <div className="page-stack max-w-5xl">
          <Link to="/subscription" className="back-link">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Subscription
          </Link>
          <div className="empty-state">
            {error instanceof Error ? error.message : 'Could not load attendance dates.'}
          </div>
        </div>
      </AppShell>
    );
  }

  const months = buildCalendarMonths(
    data.subscription.start_date,
    data.subscription.end_date,
    data.attended_dates,
  );

  return (
    <AppShell links={memberLinks}>
      <div className="page-stack max-w-5xl">
        <Link to="/subscription" className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Subscription
        </Link>

        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-eyebrow">Attendance dates</p>
              <h2 className="mt-2 font-headline text-[2rem] font-black uppercase leading-[0.95] tracking-tight text-black dark:text-white sm:text-[2.35rem]">
                {data.subscription.service_type}
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-medium text-black/70 dark:text-white/75">
                Coloured boxes mark the days you checked in. The rest stay plain so the rhythm is easy to scan at a glance.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[18rem]">
              <div className="rounded-2xl border border-black px-4 py-3 dark:border-white">
                <p className="font-label text-[0.62rem] font-bold uppercase tracking-[0.18em] text-black dark:text-white">
                  Check-ins
                </p>
                <p className="mt-1 font-headline text-[1.8rem] font-black leading-none text-black dark:text-white">
                  {data.attended_dates.length}
                </p>
              </div>
              <div className="rounded-2xl border border-black px-4 py-3 dark:border-white">
                <p className="font-label text-[0.62rem] font-bold uppercase tracking-[0.18em] text-black dark:text-white">
                  Status
                </p>
                <p className="mt-1 text-sm font-semibold capitalize text-black dark:text-white">
                  {data.subscription.lifecycle_state}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-black pt-4 text-sm font-semibold text-black dark:border-white dark:text-white">
            {formatFullDate(data.subscription.start_date)} - {formatFullDate(data.subscription.end_date)}
          </div>
        </Card>

        {data.attended_dates.length === 0 ? (
          <div className="rounded-2xl border border-black px-4 py-3 text-sm font-medium text-black dark:border-white dark:text-white">
            No sessions have been marked in this subscription yet.
          </div>
        ) : null}

        <div className="space-y-4">
          {months.map(month => (
            <MonthCalendar
              key={month.key}
              label={month.label}
              attendedCount={month.attendedCount}
              monthKey={month.key}
              weeks={month.weeks}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
