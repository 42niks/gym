import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type MemberHome } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Badge from '../../components/Badge.js';
import Card from '../../components/Card.js';
import Button from '../../components/Button.js';
import Spinner from '../../components/Spinner.js';

const memberLinks = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/billing', label: 'Billing', icon: 'credit_card' },
  { to: '/profile', label: 'Profile', icon: 'person' },
];

function ProgressRing({ attended, total }: { attended: number; total: number }) {
  const pct = total > 0 ? attended / total : 0;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
      <defs>
        <linearGradient id="base-progress" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="100%" stopColor="rgba(236,255,249,0.72)" />
        </linearGradient>
      </defs>
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="8" />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke="url(#base-progress)"
        strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

function extractDayCount(message: string | undefined) {
  const match = message?.match(/\d+/);
  return match ? Number(match[0]) : 0;
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

  const { member, active_subscription: sub, consistency, renewal, marked_attendance_today } = data!;
  const firstName = member.full_name.split(' ')[0];
  const completion = sub && sub.total_sessions > 0 ? Math.round((sub.attended_sessions / sub.total_sessions) * 100) : 0;
  const streakDays = extractDayCount(consistency?.message);
  const filledStreakCells = streakDays > 0 ? Math.min(7, streakDays % 7 || 7) : 0;

  return (
    <AppShell links={memberLinks}>
      <div className="page-stack">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-eyebrow">Member dashboard</p>
              <h2 className="page-title mt-2">{firstName}</h2>
              <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                {marked_attendance_today
                  ? 'Checked in and moving. Keep the pressure on through the rest of the day.'
                  : 'Today’s session is still up for grabs. Check in and keep the streak moving.'}
              </p>
            </div>

            <div className="glass-panel max-w-sm px-4 py-4">
              <p className="section-eyebrow">Current focus</p>
              <p className="mt-3 font-headline text-xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">
                {sub ? sub.service_type : 'No active plan'}
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {renewal?.message ?? (sub ? `${sub.remaining_sessions} sessions ready to use.` : 'Reactivate a subscription to unlock check-ins and billing history.')}
              </p>
            </div>
          </div>

          {renewal && (
            <section className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white bg-brand-gradient p-px shadow-panel dark:border-white/10 dark:bg-surface-dark dark:bg-brand-gradient-dark">
              <div className="relative flex flex-col gap-4 rounded-[1.65rem] bg-white/88 px-5 py-5 dark:bg-surface-dark/78 lg:flex-row lg:items-center lg:justify-between lg:px-6">
                <div className="absolute inset-y-0 right-0 hidden w-28 -skew-x-[18deg] bg-brand-400/15 lg:block" />
                <div className="relative z-10">
                  <p className="section-eyebrow">{renewal.kind === 'starts_on' ? 'Next block' : 'Renewal prompt'}</p>
                  <h3 className="mt-2 font-headline text-2xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">
                    {renewal.kind === 'no_active'
                      ? 'Restart your engine.'
                      : renewal.kind === 'starts_on'
                        ? 'Next block locked.'
                        : 'Renew your engine.'}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{renewal.message}</p>
                </div>
                <Badge variant={renewal.kind === 'starts_on' ? 'blue' : renewal.kind === 'no_active' ? 'orange' : 'green'} icon={renewal.kind === 'starts_on' ? 'schedule' : renewal.kind === 'no_active' ? 'warning' : 'bolt'}>
                  {renewal.kind.replaceAll('_', ' ')}
                </Badge>
              </div>
            </section>
          )}

          <div className="grid gap-5 xl:grid-cols-12">
            {sub ? (
              <Card gradient className="relative overflow-hidden p-6 lg:p-7 xl:col-span-7">
                <div className="absolute -right-12 top-8 h-36 w-36 rounded-full bg-white/18 blur-3xl dark:bg-white/12" />
                <div className="absolute -left-10 bottom-0 h-24 w-24 rotate-45 bg-white/10 dark:bg-white/8" />
                <div className="relative z-10">
                  <p className="font-label text-[0.68rem] font-bold italic uppercase tracking-[0.32em] text-gray-900/55 dark:text-white/70">
                    Performance tier
                  </p>
                  <div className="mt-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-900/70 dark:text-white/72">{sub.service_type}</p>
                      <p className="mt-4 font-headline text-6xl font-black italic leading-none tracking-tight text-gray-900 dark:text-white">{sub.remaining_sessions}</p>
                      <p className="mt-2 text-sm text-gray-900/72 dark:text-white/80">sessions remaining</p>
                    </div>
                    <div className="relative flex h-24 w-24 items-center justify-center">
                      <ProgressRing attended={sub.attended_sessions} total={sub.total_sessions} />
                      <span className="absolute font-label text-xs font-bold italic uppercase tracking-[0.16em] text-gray-900 dark:text-white">
                        {completion}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/40 bg-white/35 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
                      <p className="font-label text-[0.62rem] font-bold italic uppercase tracking-[0.22em] text-gray-900/50 dark:text-white/55">Attended</p>
                      <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{sub.attended_sessions}</p>
                    </div>
                    <div className="rounded-2xl border border-white/40 bg-white/35 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
                      <p className="font-label text-[0.62rem] font-bold italic uppercase tracking-[0.22em] text-gray-900/50 dark:text-white/55">Total sessions</p>
                      <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{sub.total_sessions}</p>
                    </div>
                    <div className="rounded-2xl border border-white/40 bg-white/35 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
                      <p className="font-label text-[0.62rem] font-bold italic uppercase tracking-[0.22em] text-gray-900/50 dark:text-white/55">Ends</p>
                      <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">
                        {new Date(sub.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6 lg:p-7 xl:col-span-7">
                <p className="section-eyebrow">Membership status</p>
                <h3 className="mt-3 font-headline text-3xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">
                  No active subscription
                </h3>
                <p className="mt-3 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                  Your dashboard is ready, but session tracking and check-ins stay locked until a package is active again.
                </p>
              </Card>
            )}

            <div className="glass-panel relative overflow-hidden p-6 xl:col-span-5">
              <div className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />
              <div className="absolute -bottom-8 -left-8 h-24 w-24 rotate-45 bg-accent-500/8" />
              <div className="relative z-10">
                <p className="font-label text-[0.68rem] font-bold italic uppercase tracking-[0.32em] text-gray-500 dark:text-gray-400">
                  Check-in
                </p>
                <h3 className="mt-4 font-headline text-3xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">
                  Arrived at Base?
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {sub
                    ? 'Log today’s session to secure the next point in your streak.'
                    : 'Activate a plan first to unlock attendance tracking.'}
                </p>
                <div className="mt-8">
                  {sub ? (
                    marked_attendance_today ? (
                      <div className="surface-inset px-5 py-4">
                        <p className="text-sm font-bold text-brand-600 dark:text-brand-300">Attendance marked for today</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Great work, keep it up!</p>
                      </div>
                    ) : (
                      <>
                        <Button
                          onClick={() => markAttendance.mutate()}
                          disabled={markAttendance.isPending}
                          className="w-full py-4 text-base"
                          icon={markAttendance.isPending ? 'progress_activity' : 'how_to_reg'}
                        >
                          {markAttendance.isPending ? 'Marking…' : 'Mark attendance'}
                        </Button>
                        {attendanceError && (
                          <p className="mt-3 text-center text-xs text-red-600 dark:text-red-300">{attendanceError}</p>
                        )}
                      </>
                    )
                  ) : (
                    <p className="surface-inset text-sm text-gray-500 dark:text-gray-400">
                      Activate a subscription to enable session check-ins.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-12">
            {consistency ? (
              <Card className="relative overflow-hidden p-6 lg:p-7 xl:col-span-7">
                <div className="absolute -bottom-16 right-0 h-40 w-40 rounded-full bg-accent-500/6 blur-3xl" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="section-eyebrow">Consistency engine</p>
                      <div className="mt-4 flex items-baseline gap-3">
                        <span className="font-headline text-6xl font-black italic leading-none tracking-tight text-gray-900 dark:text-white">
                          {streakDays || '—'}
                        </span>
                        <span className="font-headline text-2xl font-bold italic uppercase tracking-tight text-accent-600 dark:text-accent-300">
                          Day streak
                        </span>
                      </div>
                    </div>
                    <Badge variant={consistency.status === 'consistent' ? 'green' : 'orange'} icon={consistency.status === 'consistent' ? 'local_fire_department' : 'fitness_center'}>
                      {consistency.status === 'consistent' ? 'Top form' : 'Keep pushing'}
                    </Badge>
                  </div>
                  <div className="mt-6 grid grid-cols-7 gap-2.5">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => (
                      <div
                        key={`${label}-${index}`}
                        className={`flex h-14 items-center justify-center rounded-2xl border-b-4 font-headline text-xs font-black italic ${
                          index < filledStreakCells
                            ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-200'
                            : 'border-accent-500 bg-accent-500/8 text-accent-600 dark:text-accent-200'
                        }`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-semibold italic text-gray-500 dark:text-gray-400">{consistency.message}</p>
                </div>
              </Card>
            ) : (
              <Card className="p-6 lg:p-7 xl:col-span-7">
                <p className="section-eyebrow">Consistency engine</p>
                <h3 className="mt-3 font-headline text-2xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">
                  Build the next streak
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Your next check-in starts the momentum tracker again.
                </p>
              </Card>
            )}

            <Card className="p-6 lg:p-7 xl:col-span-5">
              <p className="section-eyebrow">Member pulse</p>
              <h3 className="mt-3 font-headline text-2xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">
                {marked_attendance_today ? 'Session secured.' : 'Session waiting.'}
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {marked_attendance_today
                  ? 'You already checked in today, so the dashboard is now all about following through on the work.'
                  : 'Check in before the day closes to keep your activity trend moving the right way.'}
              </p>
              <div className="mt-6 space-y-3">
                <div className="surface-inset flex items-center justify-between">
                  <span className="font-label text-[0.62rem] font-bold italic uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                    Status
                  </span>
                  <Badge variant={marked_attendance_today ? 'green' : 'orange'} icon={marked_attendance_today ? 'check_circle' : 'schedule'}>
                    {marked_attendance_today ? 'Checked in' : 'Pending'}
                  </Badge>
                </div>
                <div className="surface-inset flex items-center justify-between">
                  <span className="font-label text-[0.62rem] font-bold italic uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                    Plan
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {sub ? `${sub.remaining_sessions} left` : 'Inactive'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
      </div>
    </AppShell>
  );
}
