import { useQuery } from '@tanstack/react-query';
import { api, type Dashboard } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Spinner from '../../components/Spinner.js';
import { ownerLinks } from './ownerLinks.js';

function getDeltaTone(delta: number) {
  if (delta > 0) return 'text-brand-600 dark:text-brand-300';
  if (delta < 0) return 'text-accent-600 dark:text-accent-300';
  return 'text-gray-500 dark:text-gray-400';
}

function getAttendanceCardClass(delta: number) {
  if (delta > 0) return 'owner-home-attendance-card owner-home-attendance-card-positive';
  if (delta < 0) return 'owner-home-attendance-card owner-home-attendance-card-negative';
  return 'owner-home-attendance-card owner-home-attendance-card-neutral';
}

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta} vs yesterday`;
  if (delta < 0) return `${delta} vs yesterday`;
  return 'No change vs yesterday';
}

function AttendanceCard({
  title,
  count,
  delta,
}: {
  title: string;
  count: number;
  delta: number;
}) {
  return (
    <Card className="owner-home-attendance-frame">
      <div className={`${getAttendanceCardClass(delta)} owner-home-attendance-inner px-5 py-5 sm:px-6 sm:py-6`}>
        <p className="section-eyebrow">{title}</p>
        <div className="mt-5 flex items-end justify-between gap-6">
          <div>
            <p className="font-headline text-5xl font-black leading-none tracking-[-0.05em] text-gray-900 sm:text-6xl dark:text-white">
              {count}
            </p>
            <p className="mt-2 font-label text-[0.68rem] font-bold italic uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400">
              Marked today
            </p>
          </div>
          <p className={`pb-1 text-right text-sm font-semibold tracking-[0.02em] ${getDeltaTone(delta)}`}>
            {formatDelta(delta)}
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function OwnerHomePage() {
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ['owner-home'],
    queryFn: () => api.get('/api/owner/home'),
  });

  return (
    <AppShell links={ownerLinks}>
      <div className="page-stack">
        <div className="page-header">
          <div>
            <h2 className="page-title">HOME</h2>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !data ? null : (
          <div className="max-w-xl">
            <AttendanceCard
              title={"Today's Attendance"}
              count={data.attendance_summary.present_today}
              delta={data.attendance_summary.delta}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
