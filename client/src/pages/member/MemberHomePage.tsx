import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type MemberHome } from '../../lib/api.js';
import NavBar from '../../components/NavBar.js';
import Card from '../../components/Card.js';
import Alert from '../../components/Alert.js';
import Button from '../../components/Button.js';
import Spinner from '../../components/Spinner.js';

const memberLinks = [
  { to: '/home', label: 'Home' },
  { to: '/billing', label: 'Billing' },
  { to: '/profile', label: 'Profile' },
];

function ProgressRing({ attended, total }: { attended: number; total: number }) {
  const pct = total > 0 ? attended / total : 0;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" />
      <circle
        cx="44" cy="44" r={r} fill="none"
        stroke="white"
        strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
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
    return <><NavBar links={memberLinks} /><div className="flex justify-center py-16"><Spinner /></div></>;
  }

  const { member, active_subscription: sub, consistency, renewal, marked_attendance_today } = data!;
  const firstName = member.full_name.split(' ')[0];

  return (
    <>
      <NavBar links={memberLinks} />
      <div className="px-4 pt-5 pb-8 space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Welcome back</p>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">{firstName}</h2>
        </div>

        {renewal && (renewal.kind === 'ends_soon' || renewal.kind === 'no_active') && (
          <Alert variant="warning">{renewal.message}</Alert>
        )}
        {renewal?.kind === 'starts_on' && (
          <Alert variant="info">{renewal.message}</Alert>
        )}

        {sub ? (
          <Card gradient className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-white/70 uppercase tracking-widest font-semibold">{sub.service_type}</p>
                <p className="mt-2 text-4xl font-black text-white leading-none">{sub.remaining_sessions}</p>
                <p className="text-white/80 text-sm mt-1">sessions remaining</p>
                <p className="text-white/60 text-xs mt-3">
                  {sub.attended_sessions} attended · ends {new Date(sub.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <div className="relative flex items-center justify-center flex-shrink-0">
                <ProgressRing attended={sub.attended_sessions} total={sub.total_sessions} />
                <span className="absolute text-xs font-black text-white">
                  {Math.round((sub.attended_sessions / sub.total_sessions) * 100)}%
                </span>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No active subscription</p>
          </Card>
        )}

        {sub && (
          <div>
            {marked_attendance_today ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl px-5 py-4 flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="text-sm font-bold text-green-800 dark:text-green-300">Attendance marked for today</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Great work, keep it up!</p>
                </div>
              </div>
            ) : (
              <>
                <Button
                  onClick={() => markAttendance.mutate()}
                  disabled={markAttendance.isPending}
                  className="w-full py-4 text-base"
                >
                  {markAttendance.isPending ? 'Marking…' : 'Mark attendance'}
                </Button>
                {attendanceError && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400 text-center">{attendanceError}</p>
                )}
              </>
            )}
          </div>
        )}

        {consistency && (
          <Card className="px-5 py-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest font-semibold mb-2">Consistency</p>
            <div className="flex items-center gap-3">
              <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${consistency.status === 'consistent' ? 'bg-green-500' : 'bg-yellow-400'}`} />
              <p className="text-sm text-gray-700 dark:text-gray-300">{consistency.message}</p>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
