import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type Dashboard, type DashboardItem } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Badge from '../../components/Badge.js';
import Button from '../../components/Button.js';
import Spinner from '../../components/Spinner.js';

const ownerLinks = [
  { to: '/owner', label: 'Dashboard', icon: 'dashboard' },
  { to: '/owner/members', label: 'Members', icon: 'groups' },
];

function MemberRow({ item, badge }: { item: DashboardItem; badge?: string }) {
  return (
    <Link
      to={`/owner/members/${item.member_id}`}
      className="flex items-center justify-between rounded-2xl px-3 py-3.5 transition-all hover:bg-surface-raised/80 dark:hover:bg-surface-raised/60"
    >
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.full_name}</p>
        {item.renewal && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.renewal.message}</p>
        )}
        {item.consistency && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.consistency.message}</p>
        )}
      </div>
      <div className="shrink-0 ml-3">
        {badge ? <Badge variant="gray" icon="label">{badge}</Badge> : item.marked_attendance_today && <Badge variant="green" icon="check_circle">In today</Badge>}
      </div>
    </Link>
  );
}

function Section({ title, items, badge }: { title: string; items: DashboardItem[]; badge?: string }) {
  if (items.length === 0) return null;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="section-eyebrow">{title}</h3>
        <span className="font-label text-[0.62rem] font-bold italic uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          {items.length} total
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map(item => <MemberRow key={item.member_id} item={item} badge={badge} />)}
      </div>
    </Card>
  );
}

export default function OwnerHomePage() {
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ['owner-dashboard'],
    queryFn: () => api.get('/api/owner/dashboard'),
  });

  return (
    <AppShell links={ownerLinks}>
      <div className="page-stack">
        <div className="page-header">
          <div>
            <p className="section-eyebrow">Owner command center</p>
            <h2 className="page-title mt-2">Dashboard</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Monitor renewals, daily check-ins, and the active roster from one ambient overview.
            </p>
          </div>
          <Link to="/owner/members/new">
            <Button className="text-sm py-2" icon="person_add">
              + New member
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !data ? null : (
          <>
            <Section title="Need renewal" items={data.renewal_no_active} badge="No plan" />
            <Section title="Nearing end" items={data.renewal_nearing_end} />
            <Section title="Checked in today" items={data.checked_in_today} />
            <Section title="Active members" items={data.active_members} />
            <Section title="Archived" items={data.archived_members} badge="Archived" />
          </>
        )}
      </div>
    </AppShell>
  );
}
