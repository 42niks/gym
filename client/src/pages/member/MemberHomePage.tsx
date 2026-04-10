import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type MemberHome } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Button from '../../components/Button.js';
import Card from '../../components/Card.js';
import Spinner from '../../components/Spinner.js';

const memberLinks = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/billing', label: 'Billing', icon: 'credit_card' },
  { to: '/profile', label: 'Profile', icon: 'person' },
];

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
    count: 'Keep Moving!',
    suffix: '',
  };
}

function formatDayNumber(date: string) {
  return String(Number(date.slice(-2)));
}

export default function MemberHomePage() {
  const queryClient = useQueryClient();
  const [attendanceError, setAttendanceError] = useState('');
  const { data, isLoading } = useQuery<MemberHome>({
    queryKey: ['member-home'],
    queryFn: () => api.get('/api/me/home'),
  });

  const markAttendance = useMutation({
    mutationFn: () => api.post('/api/me/sessions'),
    onSuccess: () => {
      setAttendanceError('');
      queryClient.invalidateQueries({ queryKey: ['member-home'] });
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

  const { active_subscription: sub, consistency, recent_attendance, marked_attendance_today } = data!;

  return (
    <AppShell links={memberLinks}>
      <div className="page-stack">
        {consistency && sub ? (
          <div className="grid gap-5 xl:grid-cols-12">
            <div className="consistency-panel-frame xl:col-span-7">
              <div className="consistency-panel-inner relative overflow-hidden p-5 lg:p-6">
                <div className="relative z-10">
                  <p className="section-eyebrow text-right">Consistency</p>
                  <div className="mt-3">
                    {consistency.status === 'consistent' ? (
                      <div className="flex items-end">
                        <span className="font-headline text-[3.6rem] font-black italic leading-[0.82] tracking-[-0.07em] text-brand-600 dark:text-accent-500 sm:text-[4.5rem]">
                          {getConsistencyLabel(consistency).count}
                        </span>
                        <span className="ml-6 pb-1 font-label text-[0.9rem] font-bold italic uppercase tracking-[0.18em] text-brand-600/80 dark:text-accent-500/80 sm:ml-8 sm:text-[1rem]">
                          {getConsistencyLabel(consistency).suffix}
                        </span>
                      </div>
                    ) : (
                      <span className="font-headline text-[2.3rem] font-black italic leading-[0.9] tracking-[-0.05em] text-brand-600 dark:text-accent-500 sm:text-[2.9rem]">
                        {getConsistencyLabel(consistency).count}
                      </span>
                    )}
                  </div>
                  <div className="mt-6 grid grid-cols-7 gap-2">
                    {recent_attendance.map((day, index) => {
                      const isToday = index === recent_attendance.length - 1;
                      return (
                        <div
                          key={day.date}
                          aria-label={`${day.date} ${day.attended ? 'attended' : 'not attended'}`}
                          className={`consistency-day-box h-[4.5rem] text-center shadow-sm transition-colors ${
                            day.attended
                              ? 'border border-transparent shadow-[0_12px_24px_rgba(34,99,80,0.18)]'
                              : 'border border-line dark:border-white/10'
                          }`}
                        >
                          <div
                            className={`consistency-day-box-inner flex h-full flex-col items-center justify-between px-2 py-2 ${
                              day.attended
                                ? 'consistency-day-box-attended text-white'
                                : 'bg-white/55 text-gray-600 dark:bg-white/[0.04] dark:text-gray-400'
                            } ${isToday ? 'consistency-day-box-today' : ''}`}
                          >
                            <span className={`text-[0.68rem] font-bold uppercase ${day.attended ? 'text-white/85' : 'text-inherit'}`}>
                              {getWeekdayLetter(day.date)}
                            </span>
                            <span className={`font-headline text-[1.1rem] font-black italic leading-none ${day.attended ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                              {formatDayNumber(day.date)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <Card className="p-5 lg:p-6 xl:col-span-5">
              <p className="section-eyebrow text-right">Check In</p>
              {marked_attendance_today ? (
                <div className="mt-5">
                  <p className="font-headline text-[2.2rem] font-black italic leading-[0.92] tracking-[-0.05em] text-brand-600 dark:text-accent-500 sm:text-[2.8rem]">
                    Good Job!
                  </p>
                  <p className="ml-1 mt-3 text-sm text-gray-600 dark:text-gray-400">
                    Get some rest.
                  </p>
                </div>
              ) : (
                <div className="mt-5">
                  <Button
                    onClick={() => markAttendance.mutate()}
                    disabled={markAttendance.isPending}
                    className="w-full rounded-[1.5rem] py-5 font-headline text-[1.05rem] font-semibold italic uppercase tracking-[0.16em] dark:border-accent-500/20 dark:hover:border-accent-500/35"
                    icon={markAttendance.isPending ? 'progress_activity' : undefined}
                  >
                    {markAttendance.isPending ? 'MARKING TODAY' : 'MARK TODAY >>>'}
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
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              No active consistency data yet.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
