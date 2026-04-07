import { useQuery } from '@tanstack/react-query';
import { api, type GroupedSubscriptions, type Subscription } from '../../lib/api.js';
import NavBar from '../../components/NavBar.js';
import Card from '../../components/Card.js';
import Badge from '../../components/Badge.js';
import Spinner from '../../components/Spinner.js';

const memberLinks = [
  { to: '/home', label: 'Home' },
  { to: '/billing', label: 'Billing' },
  { to: '/profile', label: 'Profile' },
];

function SubCard({ sub }: { sub: Subscription }) {
  const variant =
    sub.lifecycle_state === 'active' ? 'green' as const :
    sub.lifecycle_state === 'upcoming' ? 'blue' as const :
    'gray' as const;

  return (
    <Card className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white">{sub.service_type}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {new Date(sub.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' – '}
            {new Date(sub.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {sub.attended_sessions} / {sub.total_sessions} sessions
            <span className="mx-1.5 text-gray-300 dark:text-gray-700">·</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">₹{sub.amount.toLocaleString('en-IN')}</span>
          </p>
        </div>
        <Badge variant={variant}>{sub.lifecycle_state}</Badge>
      </div>
    </Card>
  );
}

export default function MemberBillingPage() {
  const { data, isLoading } = useQuery<GroupedSubscriptions>({
    queryKey: ['member-billing'],
    queryFn: () => api.get('/api/me/subscriptions'),
  });

  return (
    <>
      <NavBar links={memberLinks} />
      <div className="px-4 pt-5 pb-8 space-y-6">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Billing</h2>

        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <>
            {(data?.upcoming ?? []).length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Upcoming</h3>
                <div className="space-y-3">
                  {data!.upcoming.map(s => <SubCard key={s.id} sub={s} />)}
                </div>
              </section>
            )}

            <section>
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">History</h3>
              {(data?.completed_and_active ?? []).length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-400 dark:text-gray-500">No subscriptions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data!.completed_and_active.map(s => <SubCard key={s.id} sub={s} />)}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
