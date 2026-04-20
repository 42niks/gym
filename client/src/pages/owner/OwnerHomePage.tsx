import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type Dashboard } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Icon from '../../components/Icon.js';
import MemberStatusPill, { type MemberStatusPillSpec } from '../../components/MemberStatusPill.js';
import Spinner from '../../components/Spinner.js';
import { ownerLinks } from './ownerLinks.js';

function getDeltaTone(delta: number) {
  if (delta > 0) return 'text-brand-600 dark:text-brand-300';
  if (delta < 0) return 'text-accent-600 dark:text-accent-300';
  return 'text-black/60 dark:text-white/70';
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
  openTo,
}: {
  title: string;
  count: number;
  delta: number;
  openTo: string;
}) {
  return (
    <Card className="owner-home-attendance-frame">
      <div className={`${getAttendanceCardClass(delta)} owner-home-attendance-inner px-5 py-5 sm:px-6 sm:py-6`}>
        <div className="flex items-start justify-between gap-3">
          <p className="section-eyebrow not-italic">{title}</p>
          <HomeActionButton to={openTo} label="Open" />
        </div>
        <div className="mt-5 flex items-end justify-between gap-6">
          <div>
            <p className="font-headline text-5xl font-black leading-none tracking-[-0.05em] text-black sm:text-6xl dark:text-white">
              {count}
            </p>
            <p className="mt-2 font-label text-[0.68rem] font-bold italic uppercase tracking-[0.28em] text-black/60 dark:text-white/70">
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

function HomeActionButton({
  to,
  label,
  className = '',
}: {
  to: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`owner-home-cta-frame inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-black font-label text-[0.68rem] font-bold italic uppercase tracking-[0.18em] text-black shadow-panel transition-all hover:shadow-glow-brand dark:border-white dark:text-white ${className}`}
    >
      <span
        aria-hidden="true"
        className="owner-home-cta-surface brand-duotone-button-sm"
        style={{ backgroundSize: '88% 220%, 112% 280%, 100% 100%' }}
      />
      <span className="relative z-10 inline-flex h-full w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[calc(9999px-1px)] px-3.5">
        <Icon name="arrow_outward" className="text-[0.95rem]" />
        {label}
      </span>
    </Link>
  );
}

function StatRow({
  label,
  count,
  to,
  tone,
}: {
  label: string;
  count: number;
  to: string;
  tone: 'not-consistent' | 'building' | 'consistent';
}) {
  const pipelinePill: MemberStatusPillSpec = tone === 'consistent'
    ? { key: 'consistent', label, icon: 'moving' }
    : tone === 'building'
      ? { key: 'building', label, icon: 'timeline' }
      : { key: 'not-consistent', label, icon: 'block', tone: 'neutral' };

  return (
    <div className="owner-home-pipeline-row-frame rounded-xl border border-black/10 dark:border-white/10">
      <div className={`owner-home-pipeline-row-surface owner-home-pipeline-row-surface-${tone} flex items-center justify-between gap-3 px-3 py-2.5`}>
        <MemberStatusPill pill={pipelinePill} />
        <div className="flex items-center gap-2.5">
          <span className="font-headline text-2xl font-black italic leading-none tracking-[-0.04em] text-black dark:text-white">{count}</span>
          <HomeActionButton to={to} label="Open" />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  icon,
  iconClassName,
  count,
  to,
  label,
}: {
  title: string;
  icon: string;
  iconClassName?: string;
  count: number;
  to: string;
  label: string;
}) {
  return (
    <Card className="owner-home-metric-frame border border-black/20 dark:border-white/15">
      <div className="owner-home-metric-surface px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start justify-between gap-3">
          <p className="section-eyebrow not-italic">{title}</p>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-black bg-white/80 shadow-sm shadow-black/5 dark:border-white dark:bg-white/[0.05]">
            <Icon name={icon} className={`text-[1.1rem] ${iconClassName ?? 'text-black/85 dark:text-white/85'}`} />
          </span>
        </div>
        <div className="mt-5 flex items-end justify-between gap-6">
          <p className="font-headline text-5xl font-black leading-none tracking-[-0.05em] text-black sm:text-6xl dark:text-white">{count}</p>
          <HomeActionButton to={to} label={label} />
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
          <div className="space-y-4 sm:space-y-5">
            <AttendanceCard
              title={"Today's Attendance"}
              count={data.attendance_summary.present_today}
              delta={data.attendance_summary.delta}
              openTo="/members?view=today"
            />
            <Card className="owner-home-metric-frame border border-black/20 dark:border-white/15">
              <div className="owner-home-metric-surface space-y-3 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="section-eyebrow not-italic">Consistency Pipeline</p>
                  </div>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-black bg-white/80 shadow-sm shadow-black/5 dark:border-white dark:bg-white/[0.05]">
                    <Icon name="conversion_path" className="text-[1.1rem] text-brand-600 dark:text-brand-300" />
                  </span>
                </div>
                <StatRow label="Not Consistent" count={data.consistency_pipeline.not_consistent} to="/members?view=not-consistent" tone="not-consistent" />
                <StatRow label="Building" count={data.consistency_pipeline.building} to="/members?view=building" tone="building" />
                <StatRow label="Consistent" count={data.consistency_pipeline.consistent} to="/members?view=consistent" tone="consistent" />
              </div>
            </Card>

            <Card className="owner-home-metric-frame border border-black/20 dark:border-white/15">
              <div className="owner-home-metric-surface px-5 py-5 sm:px-6 sm:py-6">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3">
                  <p className="section-eyebrow not-italic">At Risk Today</p>
                  <span className="inline-flex h-10 w-10 shrink-0 justify-self-end items-center justify-center rounded-[1rem] border border-black bg-white/80 shadow-sm shadow-black/5 dark:border-white dark:bg-white/[0.05]">
                    <Icon name="warning" className="text-[1.1rem] text-orange-700 dark:text-orange-300" />
                  </span>

                  <div className="min-w-0">
                    <p className="font-headline text-5xl font-black leading-none tracking-[-0.05em] text-black sm:text-6xl dark:text-white">
                      {data.at_risk.total}
                    </p>
                    <div className="mt-2 space-y-1 font-label text-[0.68rem] font-bold italic uppercase tracking-[0.28em] text-black/60 dark:text-white/70">
                      <p>{data.at_risk.consistent} consistent</p>
                      <p>{data.at_risk.building} building</p>
                    </div>
                  </div>

                  <HomeActionButton className="self-end justify-self-end" to="/members?view=at-risk" label="At Risk" />
                </div>
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryCard
                title="Upcoming Renewals"
                icon="notification_important"
                iconClassName="text-orange-700 dark:text-orange-300"
                count={data.renewal_due_count}
                to="/members?view=renewal"
                label="Renewals"
              />
              <SummaryCard
                title="No Active Plan"
                icon="credit_card_off"
                iconClassName="text-black/70 dark:text-white/75"
                count={data.no_active_plan_count}
                to="/members?view=no-plan"
                label="No Plan"
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
