import { useState, type CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type MemberHome } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Button from '../../components/Button.js';
import Card from '../../components/Card.js';
import Spinner from '../../components/Spinner.js';
import MemberRenewalAlert from '../../components/member/MemberRenewalAlert.js';
import { memberLinks } from './memberLinks.js';

function extractDayCount(message: string | undefined) {
  const match = message?.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function getWeekdayLetter(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day];
}

function getConsistencyLabel(consistency: NonNullable<MemberHome['consistency']>) {
  if (consistency.status === 'consistent') {
    const days = consistency.days ?? extractDayCount(consistency.message);
    return {
      count: String(days),
      suffix: 'DAYS!',
    };
  }

  return {
    count: 'Check in today!',
    suffix: '',
  };
}

function getConsistencyRiskCopy(consistencyWindow: MemberHome['consistency_window']) {
  const streakDays = consistencyWindow?.streak_days;
  if (!streakDays || streakDays <= 0) {
    return null;
  }

  return `You risk breaking your ${streakDays} day streak.`;
}

function isTodayIncludedInConsistencyWindow(
  consistencyWindow: MemberHome['consistency_window'],
  recentAttendance: MemberHome['recent_attendance'],
) {
  const todayDate = recentAttendance[recentAttendance.length - 1]?.date;
  if (!todayDate || !consistencyWindow) {
    return false;
  }

  return consistencyWindow.end_date === todayDate;
}

function formatDayNumber(date: string) {
  return String(Number(date.slice(-2)));
}

function getConsistencyRibbonSpan(
  consistencyWindow: MemberHome['consistency_window'],
  recentAttendance: MemberHome['recent_attendance'],
) {
  if (!consistencyWindow || recentAttendance.length === 0) {
    return null;
  }

  const firstVisibleDate = recentAttendance[0]?.date;
  const lastVisibleDate = recentAttendance[recentAttendance.length - 1]?.date;

  if (!firstVisibleDate || !lastVisibleDate) {
    return null;
  }

  if (consistencyWindow.end_date < firstVisibleDate || consistencyWindow.start_date > lastVisibleDate) {
    return null;
  }

  let startIndex = recentAttendance.findIndex((day) => day.date >= consistencyWindow.start_date);
  if (startIndex === -1) {
    startIndex = 0;
  }

  let endIndex = -1;
  for (let index = recentAttendance.length - 1; index >= 0; index--) {
    if (recentAttendance[index].date <= consistencyWindow.end_date) {
      endIndex = index;
      break;
    }
  }

  if (endIndex < startIndex) {
    return null;
  }

  return {
    startIndex,
    endIndex,
    fadesLeft: consistencyWindow.start_date < firstVisibleDate,
    endsAtLastVisible: endIndex === recentAttendance.length - 1,
  };
}

function getConsistencyConnectorIndexes(consistencyRibbonSpan: ReturnType<typeof getConsistencyRibbonSpan>) {
  if (!consistencyRibbonSpan) {
    return [];
  }

  const connectorCount = consistencyRibbonSpan.endIndex - consistencyRibbonSpan.startIndex;
  if (connectorCount <= 0) {
    return [];
  }

  return Array.from({ length: connectorCount }, (_, offset) => consistencyRibbonSpan.startIndex + offset);
}

export default function MemberHomePage() {
  const queryClient = useQueryClient();
  const [attendanceError, setAttendanceError] = useState('');
  const { data, isLoading } = useQuery<MemberHome>({
    queryKey: ['member-home'],
    queryFn: () => api.get('/api/member/home'),
  });

  const markAttendance = useMutation({
    mutationFn: () => api.post('/api/member/session'),
    onSuccess: () => {
      setAttendanceError('');
      queryClient.invalidateQueries({ queryKey: ['member-home'] });
      queryClient.invalidateQueries({ queryKey: ['member-subscription'] });
    },
    onError: (err: any) => setAttendanceError(err.message ?? 'Could not mark attendance'),
  });

  if (isLoading) {
    return (
      <AppShell links={memberLinks}>
        <div className="page-stack">
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        </div>
      </AppShell>
    );
  }

  const { active_subscription: sub, consistency, consistency_window, recent_attendance, marked_attendance_today } = data!;
  const consistencyRiskCopy = getConsistencyRiskCopy(consistency_window);
  const todayIncludedInConsistencyWindow = isTodayIncludedInConsistencyWindow(consistency_window, recent_attendance);
  const consistencyRibbonSpan = getConsistencyRibbonSpan(consistency_window, recent_attendance);
  const consistencyConnectorIndexes = getConsistencyConnectorIndexes(consistencyRibbonSpan);
  const consistencyRibbonStyle = consistencyRibbonSpan ? ({
    '--consistency-ribbon-start': String(consistencyRibbonSpan.startIndex),
    '--consistency-ribbon-span': String(consistencyRibbonSpan.endIndex - consistencyRibbonSpan.startIndex + 1),
    '--consistency-ribbon-right-overhang': consistencyRibbonSpan.endsAtLastVisible ? '0.56rem' : '0.44rem',
  } as CSSProperties) : undefined;
  const consistencyGridStyle = ({
    '--consistency-ribbon-total': String(recent_attendance.length || 7),
  } as CSSProperties);

  return (
    <AppShell links={memberLinks}>
      <div className="page-stack">
        <div>
          <h2 className="page-title">Home</h2>
        </div>
        <MemberRenewalAlert />
        {consistency && sub ? (
          <div className="grid gap-5 xl:grid-cols-12">
            <div className="consistency-panel-frame xl:col-span-7">
              <div className="consistency-panel-inner relative overflow-hidden p-5 lg:p-6">
                <div className="relative z-10">
                  <p className="section-eyebrow not-italic text-left">Consistency</p>
                  <div className="mt-3">
                    {consistency.status === 'consistent' ? (
                      <div className="flex items-end">
                        <span className="font-headline text-[3.6rem] font-black italic leading-[0.82] tracking-[-0.07em] text-black dark:text-white sm:text-[4.5rem]">
                          {getConsistencyLabel(consistency).count}
                        </span>
                        <span className="ml-6 pb-1 font-label text-[0.9rem] font-bold italic uppercase tracking-[0.18em] text-black dark:text-white sm:ml-8 sm:text-[1rem]">
                          {getConsistencyLabel(consistency).suffix}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="font-headline text-[2.3rem] font-black italic leading-[0.9] tracking-[-0.05em] text-black dark:text-white sm:text-[2.9rem]">
                          {getConsistencyLabel(consistency).count}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="consistency-day-grid mt-6" style={consistencyGridStyle}>
                    {consistencyRibbonSpan ? (
                      <div
                        aria-hidden="true"
                        data-testid="consistency-ribbon"
                        className={`consistency-window-ribbon ${consistencyRibbonSpan.fadesLeft ? 'consistency-window-ribbon-fade-left' : ''}`}
                        style={consistencyRibbonStyle}
                      />
                    ) : null}
                    {consistencyConnectorIndexes.length > 0 ? (
                      <div aria-hidden="true" className="consistency-window-connectors">
                        {consistencyRibbonSpan?.fadesLeft ? (
                          <div className="consistency-window-connector consistency-window-connector-lead" />
                        ) : null}
                        {consistencyConnectorIndexes.map((connectorIndex) => (
                          <div
                            key={connectorIndex}
                            className="consistency-window-connector"
                            style={{ '--consistency-connector-index': String(connectorIndex) } as CSSProperties}
                          />
                        ))}
                      </div>
                    ) : null}
                    <div className="grid grid-cols-7 gap-2">
                      {recent_attendance.map((day, index) => {
                        const isToday = index === recent_attendance.length - 1;
                        const showTodayPulse = isToday && !marked_attendance_today;
                        return (
                          <div
                            key={day.date}
                            aria-label={`${day.date} ${day.attended ? 'attended' : 'not attended'}`}
                            className={`consistency-day-box z-10 h-[4.5rem] text-center shadow-sm transition-colors ${
                              day.attended
                                ? 'border border-brand-500 shadow-[0_12px_24px_rgba(34,99,80,0.18)] dark:border-accent-500'
                                : 'border border-black dark:border-white'
                            }`}
                          >
                            <div
                              className={`consistency-day-box-inner flex h-full flex-col items-center justify-between px-2 py-2 ${
                                day.attended
                                  ? 'consistency-day-box-attended text-white'
                                  : 'bg-white/55 text-black dark:bg-white/[0.04] dark:text-white'
                              } ${showTodayPulse ? 'consistency-day-box-today' : ''}`}
                            >
                              <span className={`text-[0.68rem] font-bold uppercase ${day.attended ? 'text-white/85' : 'text-inherit'}`}>
                                {getWeekdayLetter(day.date)}
                              </span>
                              <span className={`font-headline text-[1.1rem] font-black italic leading-none ${day.attended ? 'text-white' : 'text-black dark:text-white'}`}>
                                {formatDayNumber(day.date)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {consistency.status !== 'consistent' && consistencyRiskCopy && !todayIncludedInConsistencyWindow ? (
                    <p className="mt-4 max-w-[20rem] text-left font-body text-[0.9rem] font-medium leading-snug text-black dark:text-white sm:text-[0.95rem]">
                      {consistencyRiskCopy}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <Card className="p-5 lg:p-6 xl:col-span-5">
              <p className="section-eyebrow not-italic text-left">Check In</p>
              {marked_attendance_today ? (
                <div className="mt-5">
                  <p className="font-headline text-[2.2rem] font-black italic leading-[0.92] tracking-[-0.05em] text-black dark:text-white sm:text-[2.8rem]">
                    Good Job!
                  </p>
                  <p className="ml-1 mt-3 text-sm text-black dark:text-white">
                    You're done for the day. Get some rest.
                  </p>
                </div>
              ) : (
                <div className="mt-5">
                  <Button
                    onClick={() => markAttendance.mutate()}
                    disabled={markAttendance.isPending}
                    className="w-full whitespace-nowrap rounded-[1.5rem] py-5 font-headline !text-[1.7rem] !leading-none font-semibold italic uppercase tracking-[0.08em] dark:border-accent-500/20 dark:hover:border-accent-500/35"
                    icon={markAttendance.isPending ? 'progress_activity' : 'how_to_reg'}
                  >
                    {markAttendance.isPending ? 'MARKING TODAY' : 'MARK TODAY'}
                  </Button>
                  {attendanceError ? (
                    <p className="mt-3 text-center text-xs text-red-600 dark:text-red-300">{attendanceError}</p>
                  ) : null}
                </div>
              )}
            </Card>
          </div>
        ) : (
          <Card className="p-6 lg:p-7">
            <p className="section-eyebrow">Consistency</p>
            <p className="mt-3 text-sm text-black/60 dark:text-white/70">
              No active consistency data yet.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
