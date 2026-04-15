import { useEffect, useRef, useState } from 'react';
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

function formatMonthHeading(value: string) {
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

function formatStatusLabel(value: 'active' | 'upcoming' | 'completed') {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatConsistencyRule(minDays: number, windowDays: number) {
  return `${minDays} out of ${windowDays} days`;
}

function formatMonthKey(value: string) {
  const { year, month } = parseDateParts(value);
  return `${year}-${String(month).padStart(2, '0')}`;
}

function buildCalendarWeeks(startDate: string, endDate: string, attendedDates: string[]) {
  const attended = new Set(attendedDates);
  const start = toUtcDate(startDate);
  const end = toUtcDate(endDate);
  const cells: Array<{
    date: string;
    attended: boolean;
    monthKey: string;
    monthHeading: string;
  } | null> = [];

  for (let index = 0; index < start.getUTCDay(); index += 1) {
    cells.push(null);
  }

  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const date = cursor.toISOString().slice(0, 10);

    cells.push({
      date,
      attended: attended.has(date),
      monthKey: formatMonthKey(date),
      monthHeading: formatMonthHeading(date),
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return weeks;
}

function ContinuousCalendar({
  weeks,
}: {
  weeks: Array<Array<{
    date: string;
    attended: boolean;
    monthKey: string;
    monthHeading: string;
  } | null>>;
}) {
  const titleId = 'attendance-calendar';
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const primaryHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const secondaryHeadingRef = useRef<HTMLParagraphElement | null>(null);
  const repeatTimeoutRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const allCells = weeks.flat().filter(cell => cell !== null);
  const monthEntries = allCells.reduce<Array<{ key: string; heading: string }>>((entries, cell) => {
    if (!entries.some(entry => entry.key === cell.monthKey)) {
      entries.push({ key: cell.monthKey, heading: cell.monthHeading });
    }
    return entries;
  }, []);
  const initialMonthKey = allCells[0]?.monthKey ?? '';
  const monthEntriesRef = useRef(monthEntries);
  const activeMonthKeyRef = useRef(initialMonthKey);
  // activeMonthKey is the only piece that needs to live in React state: it flips
  // at month boundaries and drives cell styling + nav button enablement. The
  // heading text and fade opacity are driven imperatively via refs below so we
  // don't re-render ~90 cells on every scroll frame.
  const [activeMonthKey, setActiveMonthKey] = useState(initialMonthKey);

  monthEntriesRef.current = monthEntries;
  activeMonthKeyRef.current = activeMonthKey;

  useEffect(() => {
    setActiveMonthKey(initialMonthKey);
  }, [initialMonthKey]);

  const stopRepeat = () => {
    if (repeatTimeoutRef.current !== null) {
      window.clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  };

  useEffect(() => () => stopRepeat(), []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Pre-compute each month's [topOffset, bottomOffset] range inside the
    // scroll content once, so scroll-time work is pure math — no DOM queries
    // and no getBoundingClientRect calls per frame. Offsets are measured
    // relative to the scrollable content (viewport.scrollTop === 0 origin),
    // not offsetParent, since our viewport isn't a positioned ancestor.
    const viewportTop = viewport.getBoundingClientRect().top - viewport.scrollTop;
    const rows = Array.from(viewport.querySelectorAll<HTMLElement>('[data-week-index]'));
    type MonthRange = { key: string; heading: string; top: number; bottom: number };
    const monthRanges: MonthRange[] = [];
    for (const row of rows) {
      const rowRect = row.getBoundingClientRect();
      const rowTop = rowRect.top - viewportTop;
      const rowBottom = rowTop + rowRect.height;
      const cells = row.querySelectorAll<HTMLElement>('[data-month-key]');
      for (const cell of cells) {
        const key = cell.dataset.monthKey;
        const heading = cell.dataset.monthHeading;
        if (!key || !heading) continue;
        const existing = monthRanges[monthRanges.length - 1];
        if (existing && existing.key === key) {
          existing.bottom = Math.max(existing.bottom, rowBottom);
        } else {
          monthRanges.push({ key, heading, top: rowTop, bottom: rowBottom });
        }
      }
    }

    const primary = primaryHeadingRef.current;
    const secondary = secondaryHeadingRef.current;
    let lastActiveKey = activeMonthKeyRef.current;
    let lastPrimaryText = '';
    let lastSecondaryText = '';
    let lastPrimaryOpacity = -1;
    let lastSecondaryOpacity = -1;
    let frameId = 0;

    const updateVisibleMonth = () => {
      const scrollTop = viewport.scrollTop;
      const scrollBottom = scrollTop + viewport.clientHeight;

      // Find the first month whose range intersects the viewport (topmost),
      // and the last (bottommost).
      let firstIdx = -1;
      let lastIdx = -1;
      for (let i = 0; i < monthRanges.length; i += 1) {
        const r = monthRanges[i];
        if (r.bottom <= scrollTop || r.top >= scrollBottom) continue;
        if (firstIdx === -1) firstIdx = i;
        lastIdx = i;
      }
      if (firstIdx === -1) return;

      const firstRange = monthRanges[firstIdx];
      const lastRange = monthRanges[lastIdx];
      const hasTransitionMonth = firstIdx !== lastIdx;

      let transition = 0;
      if (hasTransitionMonth) {
        const firstOverlap = Math.max(0, Math.min(firstRange.bottom, scrollBottom) - Math.max(firstRange.top, scrollTop));
        const lastOverlap = Math.max(0, Math.min(lastRange.bottom, scrollBottom) - Math.max(lastRange.top, scrollTop));
        const total = firstOverlap + lastOverlap;
        transition = total > 0 ? lastOverlap / total : 0;
      }

      const activeKey = hasTransitionMonth && transition >= 0.5 ? lastRange.key : firstRange.key;
      if (activeKey !== lastActiveKey) {
        lastActiveKey = activeKey;
        setActiveMonthKey(activeKey);
      }

      // Drive heading text/opacity directly on the DOM to avoid React re-renders
      // during scroll. textContent writes are skipped unless the label changes.
      if (primary) {
        const nextText = firstRange.heading;
        if (nextText !== lastPrimaryText) {
          primary.textContent = nextText;
          lastPrimaryText = nextText;
        }
        const nextOpacity = hasTransitionMonth ? 1 - transition : 1;
        if (nextOpacity !== lastPrimaryOpacity) {
          primary.style.opacity = String(nextOpacity);
          lastPrimaryOpacity = nextOpacity;
        }
      }
      if (secondary) {
        if (hasTransitionMonth) {
          const nextText = lastRange.heading;
          if (nextText !== lastSecondaryText) {
            secondary.textContent = nextText;
            lastSecondaryText = nextText;
          }
          if (lastSecondaryOpacity !== transition) {
            secondary.style.opacity = String(transition);
            lastSecondaryOpacity = transition;
          }
          if (secondary.style.display === 'none') {
            secondary.style.display = '';
          }
        } else if (secondary.style.display !== 'none') {
          secondary.style.display = 'none';
          lastSecondaryText = '';
          lastSecondaryOpacity = -1;
        }
      }
    };

    const scheduleUpdate = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateVisibleMonth();
      });
    };

    updateVisibleMonth();
    viewport.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (frameId !== 0) cancelAnimationFrame(frameId);
      viewport.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [weeks]);

  const activeMonthIndex = monthEntries.findIndex(entry => entry.key === activeMonthKey);
  const canGoPrev = activeMonthIndex > 0;
  const canGoNext = activeMonthIndex !== -1 && activeMonthIndex < monthEntries.length - 1;

  const moveMonth = (direction: -1 | 1, behavior: ScrollBehavior) => {
    const viewport = viewportRef.current;
    const entries = monthEntriesRef.current;
    const currentIndex = entries.findIndex(entry => entry.key === activeMonthKeyRef.current);
    if (!viewport || currentIndex === -1) return false;

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= entries.length) return false;

    const targetMonth = entries[targetIndex];
    const targetCell = viewport.querySelector<HTMLElement>(`[data-month-key="${targetMonth.key}"]`);
    const targetRow = targetCell?.closest('[data-week-index]') as HTMLElement | null;

    if (!targetRow) return false;

    const viewportRect = viewport.getBoundingClientRect();
    const rowRect = targetRow.getBoundingClientRect();
    const targetScrollTop = viewport.scrollTop + (rowRect.top - viewportRect.top);

    viewport.scrollTo({
      top: targetScrollTop,
      behavior,
    });

    return true;
  };

  const startRepeat = (direction: -1 | 1) => {
    if ((direction === -1 && !canGoPrev) || (direction === 1 && !canGoNext)) return;

    stopRepeat();
    suppressClickRef.current = false;
    repeatTimeoutRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      if (!moveMonth(direction, 'auto')) {
        stopRepeat();
        return;
      }

      repeatIntervalRef.current = window.setInterval(() => {
        if (!moveMonth(direction, 'auto')) {
          stopRepeat();
        }
      }, 180);
    }, 320);
  };

  const handleNavClick = (direction: -1 | 1) => (event: React.MouseEvent<HTMLButtonElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      return;
    }

    moveMonth(direction, 'smooth');
  };

  const handleNavPointerDown = (direction: -1 | 1) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startRepeat(direction);
  };

  return (
    <Card className="overflow-hidden">
      <div className="[--calendar-gap:0.5rem] [--calendar-row:3.5rem] px-4 py-5 sm:[--calendar-row:4rem] sm:px-6 sm:py-6">
        <div className="relative flex h-8 items-center justify-center sm:h-9">
          <button
            type="button"
            aria-label="Previous month"
            disabled={!canGoPrev}
            onClick={handleNavClick(-1)}
            onPointerDown={handleNavPointerDown(-1)}
            onPointerUp={stopRepeat}
            onPointerCancel={stopRepeat}
            onPointerLeave={stopRepeat}
            onBlur={stopRepeat}
            className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/12 text-sm text-black transition disabled:cursor-not-allowed disabled:text-black/25 dark:border-white/12 dark:text-white dark:disabled:text-white/25"
          >
            ◀
          </button>
          <h3
            id={titleId}
            ref={primaryHeadingRef}
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-center font-headline text-[1.45rem] font-black uppercase leading-none tracking-tight text-black dark:text-white sm:text-[1.6rem]"
            style={{ opacity: 1 }}
          >
            {monthEntries[0]?.heading ?? ''}
          </h3>
          <p
            ref={secondaryHeadingRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-center font-headline text-[1.45rem] font-black uppercase leading-none tracking-tight text-black dark:text-white sm:text-[1.6rem]"
            style={{ opacity: 0, display: 'none' }}
          />

          <button
            type="button"
            aria-label="Next month"
            disabled={!canGoNext}
            onClick={handleNavClick(1)}
            onPointerDown={handleNavPointerDown(1)}
            onPointerUp={stopRepeat}
            onPointerCancel={stopRepeat}
            onPointerLeave={stopRepeat}
            onBlur={stopRepeat}
            className="absolute right-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/12 text-sm text-black transition disabled:cursor-not-allowed disabled:text-black/25 dark:border-white/12 dark:text-white dark:disabled:text-white/25"
          >
            ▶
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-[var(--calendar-gap)]">
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

        <div
          ref={viewportRef}
          className="mt-3 overflow-y-auto pr-1"
          style={{ maxHeight: 'calc(var(--calendar-row) * 4.5 + var(--calendar-gap) * 4)' }}
        >
          <div role="grid" aria-labelledby={titleId} className="space-y-[var(--calendar-gap)]">
            {weeks.map((week, index) => (
              <div
                key={`attendance-week-${index}`}
                role="row"
                data-week-index={index}
                className="grid grid-cols-7 gap-[var(--calendar-gap)]"
              >
                {week.map((cell, cellIndex) => {
                  if (!cell) {
                    return (
                      <div
                        key={`attendance-week-${index}-${cellIndex}`}
                        aria-hidden="true"
                        className="h-[var(--calendar-row)]"
                      />
                    );
                  }

                  const isActiveMonth = cell.monthKey === activeMonthKey;
                  const stateClass = isActiveMonth
                    ? cell.attended
                      ? 'brand-duotone-button border border-black text-black shadow-panel dark:border-white dark:text-white'
                      : 'border border-transparent text-black dark:text-white'
                    : cell.attended
                      ? 'border border-black/10 bg-black/[0.04] text-black/22 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/24'
                      : 'border border-transparent text-black/22 dark:text-white/24';

                  return (
                    <div
                      key={cell.date}
                      role="gridcell"
                      data-month-key={cell.monthKey}
                      data-month-heading={cell.monthHeading}
                      aria-label={cell.attended ? `Attended on ${formatFullDate(cell.date)}` : formatFullDate(cell.date)}
                      className={`${stateClass} flex h-[var(--calendar-row)] items-center justify-center rounded-[1.15rem] text-sm font-semibold transition-colors duration-150`}
                    >
                      {formatDayNumber(cell.date)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
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

  const weeks = buildCalendarWeeks(
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

        <ContinuousCalendar weeks={weeks} />
      </div>
    </AppShell>
  );
}
