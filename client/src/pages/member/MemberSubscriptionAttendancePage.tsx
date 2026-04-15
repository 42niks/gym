import { useEffect, useMemo, useRef, useState } from 'react';
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

function isValidDateString(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
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

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function getIncomingFocusAlpha(boundaryY: number, viewportHeight: number) {
  const readLine = viewportHeight * 0.3;
  const zoneHeight = viewportHeight * 0.2;
  const zoneTop = readLine - zoneHeight / 2;
  const zoneBottom = readLine + zoneHeight / 2;

  if (boundaryY > zoneBottom) return 0;
  if (boundaryY < zoneTop) return 1;
  return clamp((zoneBottom - boundaryY) / (zoneBottom - zoneTop), 0, 1);
}

function buildCalendarWeeks(startDate: string, endDate: string, attendedDates: string[]) {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) return null;
  const attended = new Set(attendedDates);
  const start = toUtcDate(startDate);
  const end = toUtcDate(endDate);
  if (start.getTime() > end.getTime()) return null;
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

  return weeks.length === 0 ? null : weeks;
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
  const monthGroupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const monthAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const repeatTimeoutRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const allCells = useMemo(() => weeks.flat().filter(cell => cell !== null), [weeks]);
  const monthEntries = useMemo(() => allCells.reduce<Array<{ key: string; heading: string }>>((entries, cell) => {
    if (!entries.some(entry => entry.key === cell.monthKey)) {
      entries.push({ key: cell.monthKey, heading: cell.monthHeading });
    }
    return entries;
  }, []), [allCells]);
  const monthCells = useMemo(() => {
    const grouped: Record<string, typeof allCells> = {};
    for (const cell of allCells) {
      if (!grouped[cell.monthKey]) grouped[cell.monthKey] = [];
      grouped[cell.monthKey].push(cell);
    }
    return grouped;
  }, [allCells]);
  const flatCells = useMemo(() => weeks.flat(), [weeks]);
  const leadingBlankCount = useMemo(() => flatCells.findIndex(cell => cell !== null), [flatCells]);
  const trailingBlankCount = useMemo(() => {
    let lastRealIndex = -1;
    for (let index = flatCells.length - 1; index >= 0; index -= 1) {
      if (flatCells[index] !== null) {
        lastRealIndex = index;
        break;
      }
    }
    if (lastRealIndex === -1) return 0;
    return flatCells.length - 1 - lastRealIndex;
  }, [flatCells]);
  const initialMonthKey = allCells[0]?.monthKey ?? '';
  const monthEntriesRef = useRef(monthEntries);
  const activeMonthKeyRef = useRef(initialMonthKey);
  const [rowSizePx, setRowSizePx] = useState(0);
  const [calendarGapPx, setCalendarGapPx] = useState(8);
  const [activeMonthKey, setActiveMonthKey] = useState(initialMonthKey);
  const [headerTransition, setHeaderTransition] = useState<{
    primary: string;
    secondary: string;
    secondaryAlpha: number;
  }>({
    primary: monthEntries[0]?.heading ?? '',
    secondary: '',
    secondaryAlpha: 0,
  });

  monthEntriesRef.current = monthEntries;
  activeMonthKeyRef.current = activeMonthKey;

  useEffect(() => {
    setActiveMonthKey(initialMonthKey);
  }, [initialMonthKey]);
  useEffect(() => {
    setHeaderTransition({
      primary: monthEntries[0]?.heading ?? '',
      secondary: '',
      secondaryAlpha: 0,
    });
  }, [monthEntries]);

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

    const recalculateRowSize = () => {
      const styles = window.getComputedStyle(viewport);
      const gapPx = Number.parseFloat(styles.getPropertyValue('--calendar-gap')) || 0;
      setCalendarGapPx(gapPx || 8);
      const width = viewport.clientWidth;
      if (width <= 0) return;
      const nextRowSize = (width - gapPx * 6) / 7;
      if (nextRowSize > 0) {
        setRowSizePx(prev => (Math.abs(prev - nextRowSize) < 0.5 ? prev : nextRowSize));
      }
    };

    recalculateRowSize();
    const resizeObserver = new ResizeObserver(recalculateRowSize);
    resizeObserver.observe(viewport);
    window.addEventListener('resize', recalculateRowSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', recalculateRowSize);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || monthEntries.length === 0) return;

    let frameId = 0;

    const applyFocusState = () => {
      const viewportHeight = viewport.clientHeight;
      const viewportTop = viewport.getBoundingClientRect().top;
      const readLine = viewportHeight * 0.3;
      let bestBoundaryIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let index = 0; index < monthEntries.length - 1; index += 1) {
        const incomingAnchor = monthAnchorRefs.current[monthEntries[index + 1].key];
        if (!incomingAnchor) continue;
        const boundaryY = incomingAnchor.getBoundingClientRect().top - viewportTop;
        const distance = Math.abs(boundaryY - readLine);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestBoundaryIndex = index;
        }
      }

      const alphaByMonth: Record<string, number> = {};
      for (const entry of monthEntries) {
        alphaByMonth[entry.key] = 0;
      }

      let nextActiveMonthKey = monthEntries[0].key;
      let nextPrimaryHeading = monthEntries[0].heading;
      let nextSecondaryHeading = '';
      let nextSecondaryAlpha = 0;
      if (bestBoundaryIndex === -1) {
        alphaByMonth[nextActiveMonthKey] = 1;
      } else {
        const outgoing = monthEntries[bestBoundaryIndex];
        const incoming = monthEntries[bestBoundaryIndex + 1];
        const incomingAnchor = monthAnchorRefs.current[incoming.key];
        if (!incomingAnchor) return;

        const boundaryY = incomingAnchor.getBoundingClientRect().top - viewportTop;
        const alphaIncoming = getIncomingFocusAlpha(boundaryY, viewportHeight);
        const alphaOutgoing = 1 - alphaIncoming;

        alphaByMonth[outgoing.key] = alphaOutgoing;
        alphaByMonth[incoming.key] = alphaIncoming;
        nextActiveMonthKey = alphaIncoming > 0.5 ? incoming.key : outgoing.key;
        nextPrimaryHeading = outgoing.heading;
        nextSecondaryHeading = incoming.heading;
        nextSecondaryAlpha = alphaIncoming;
      }

      for (const entry of monthEntries) {
        const group = monthGroupRefs.current[entry.key];
        if (!group) continue;
        group.style.setProperty('--focus-alpha', String(alphaByMonth[entry.key]));
      }

      if (nextActiveMonthKey !== activeMonthKeyRef.current) {
        setActiveMonthKey(nextActiveMonthKey);
      }
      setHeaderTransition(previous => {
        if (
          previous.primary === nextPrimaryHeading &&
          previous.secondary === nextSecondaryHeading &&
          Math.abs(previous.secondaryAlpha - nextSecondaryAlpha) < 0.001
        ) {
          return previous;
        }
        return {
          primary: nextPrimaryHeading,
          secondary: nextSecondaryHeading,
          secondaryAlpha: nextSecondaryAlpha,
        };
      });
    };

    const scheduleUpdate = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        applyFocusState();
      });
    };

    scheduleUpdate();
    viewport.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    const resizeObserver = new ResizeObserver(() => scheduleUpdate());
    resizeObserver.observe(viewport);

    return () => {
      if (frameId !== 0) cancelAnimationFrame(frameId);
      viewport.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      resizeObserver.disconnect();
    };
  }, [monthEntries]);

  const activeMonthIndex = monthEntries.findIndex(entry => entry.key === activeMonthKey);
  const canGoPrev = activeMonthIndex > 0;
  const canGoNext = activeMonthIndex !== -1 && activeMonthIndex < monthEntries.length - 1;
  const activeMonthHeading = monthEntries[activeMonthIndex]?.heading ?? monthEntries[0]?.heading ?? '';

  const moveMonth = (direction: -1 | 1, behavior: ScrollBehavior) => {
    const viewport = viewportRef.current;
    const entries = monthEntriesRef.current;
    const currentIndex = entries.findIndex(entry => entry.key === activeMonthKeyRef.current);
    if (!viewport || currentIndex === -1) return false;

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= entries.length) return false;

    const targetMonth = entries[targetIndex];
    const targetAnchor = monthAnchorRefs.current[targetMonth.key];
    if (!targetAnchor) return false;

    const viewportRect = viewport.getBoundingClientRect();
    const anchorRect = targetAnchor.getBoundingClientRect();
    const targetScrollTop = viewport.scrollTop + (anchorRect.top - viewportRect.top);

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
      <div className="[--calendar-gap:0.5rem] px-4 py-5 sm:px-6 sm:py-6">
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
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-center font-headline text-[1.45rem] font-black uppercase leading-none tracking-tight text-black dark:text-white sm:text-[1.6rem]"
            style={{ opacity: 1 - headerTransition.secondaryAlpha }}
          >
            {headerTransition.primary}
          </h3>
          {headerTransition.secondary ? (
            <p
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-center font-headline text-[1.45rem] font-black uppercase leading-none tracking-tight text-black dark:text-white sm:text-[1.6rem]"
              style={{ opacity: headerTransition.secondaryAlpha }}
            >
              {headerTransition.secondary}
            </p>
          ) : null}

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
          style={{
            maxHeight:
              rowSizePx > 0
                ? `${rowSizePx * 5.5 + calendarGapPx * 5}px`
                : 'calc(3.15rem * 5.5 + var(--calendar-gap) * 5)',
          }}
        >
          <div
            role="grid"
            aria-labelledby={titleId}
            className="grid grid-cols-7 gap-[var(--calendar-gap)]"
          >
            {Array.from({ length: Math.max(0, leadingBlankCount) }).map((_, index) => (
              <div
                key={`calendar-leading-empty-${index}`}
                aria-hidden="true"
                className="aspect-square w-full"
              />
            ))}

            {monthEntries.map(entry => (
              <div
                key={entry.key}
                data-month-group={entry.key}
                ref={node => {
                  monthGroupRefs.current[entry.key] = node;
                }}
                className="contents"
                style={{ ['--focus-alpha' as string]: 0 }}
              >
                {(monthCells[entry.key] ?? []).map((cell, index) => (
                  cell.attended ? (
                    <div
                      key={cell.date}
                      ref={node => {
                        if (index === 0) monthAnchorRefs.current[entry.key] = node;
                      }}
                      role="gridcell"
                      data-month-key={cell.monthKey}
                      data-month-heading={cell.monthHeading}
                      aria-label={`Attended on ${formatFullDate(cell.date)}`}
                      className="aspect-square w-full"
                    >
                      <div
                        className="mx-auto flex h-[95%] w-[95%] items-center justify-center rounded-full border bg-surface-card shadow-panel [contain:paint] [isolation:isolate] [transform:translateZ(0)] [backface-visibility:hidden] dark:bg-surface-dark"
                        style={{
                          color:
                            'color-mix(in srgb, currentColor calc(20% + var(--focus-alpha) * 80%), rgb(148 163 184))',
                          borderColor: 'color-mix(in srgb, currentColor calc(14% + var(--focus-alpha) * 26%), transparent)',
                        }}
                      >
                        <span
                          className="attendance-pill-surface flex h-full w-full items-center justify-center rounded-full overflow-hidden [transform:translateZ(0)] [backface-visibility:hidden]"
                        >
                          {formatDayNumber(cell.date)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={cell.date}
                      ref={node => {
                        if (index === 0) monthAnchorRefs.current[entry.key] = node;
                      }}
                      role="gridcell"
                      data-month-key={cell.monthKey}
                      data-month-heading={cell.monthHeading}
                      aria-label={formatFullDate(cell.date)}
                      className="aspect-square w-full rounded-[0.95rem] border border-transparent flex items-center justify-center text-sm font-semibold"
                      style={{
                        color:
                          'color-mix(in srgb, currentColor calc(20% + var(--focus-alpha) * 80%), rgb(148 163 184))',
                      }}
                    >
                      {formatDayNumber(cell.date)}
                    </div>
                  )
                ))}
              </div>
            ))}

            {Array.from({ length: trailingBlankCount }).map((_, index) => (
              <div
                key={`calendar-trailing-empty-${index}`}
                aria-hidden="true"
                className="aspect-square w-full"
              />
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
  const hasValidCalendarRange = weeks !== null;

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

        {hasValidCalendarRange ? (
          <ContinuousCalendar weeks={weeks} />
        ) : (
          <div className="empty-state">Attendance calendar dates are invalid for this subscription.</div>
        )}
      </div>
    </AppShell>
  );
}
