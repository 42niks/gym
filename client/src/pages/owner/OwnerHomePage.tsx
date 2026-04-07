import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type Dashboard, type DashboardItem } from '../../lib/api.js';
import NavBar from '../../components/NavBar.js';
import Card from '../../components/Card.js';
import Badge from '../../components/Badge.js';
import Button from '../../components/Button.js';
import Spinner from '../../components/Spinner.js';

const ownerLinks = [
  { to: '/owner', label: 'Dashboard' },
  { to: '/owner/members', label: 'Members' },
];

function MemberRow({ item, badge }: { item: DashboardItem; badge?: string }) {
  return (
    <Link
      to={`/owner/members/${item.member_id}`}
      className="flex items-center justify-between py-3.5 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-1 px-1 rounded-xl transition-colors"
    >
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.full_name}</p>
        {item.renewal && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.renewal.message}</p>
        )}
        {item.consistency && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.consistency.message}</p>
        )}
      </div>
      <div className="shrink-0 ml-3">
        {badge ? <Badge variant="gray">{badge}</Badge> : item.marked_attendance_today && <Badge variant="green">In today</Badge>}
      </div>
    </Link>
  );
}

function Section({ title, items, badge }: { title: string; items: DashboardItem[]; badge?: string }) {
  if (items.length === 0) return null;
  return (
    <Card className="px-5 py-3">
      <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{title} <span className="font-normal">({items.length})</span></h3>
      {items.map(item => <MemberRow key={item.member_id} item={item} badge={badge} />)}
    </Card>
  );
}

export default function OwnerHomePage() {
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ['owner-dashboard'],
    queryFn: () => api.get('/api/owner/dashboard'),
  });

  return (
    <>
      <NavBar links={ownerLinks} />
      <div className="px-4 pt-5 pb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Dashboard</h2>
          <Link to="/owner/members/new">
            <Button className="text-sm py-2">+ New member</Button>
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
    </>
  );
}
