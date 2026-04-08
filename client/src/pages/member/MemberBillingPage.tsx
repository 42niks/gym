import { useQuery } from '@tanstack/react-query';
import { api, type GroupedSubscriptions, type Subscription } from '../../lib/api.js';
import NavBar from '../../components/NavBar.js';
import Card from '../../components/Card.js';
import Badge from '../../components/Badge.js';
import Spinner from '../../components/Spinner.js';

const memberLinks = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/billing', label: 'Billing', icon: 'credit_card' },
  { to: '/profile', label: 'Profile', icon: 'person' },
];

function SubCard({ sub }: { sub: Subscription }) {
  const variant =
    sub.lifecycle_state === 'active' ? 'green' as const :
    sub.lifecycle_state === 'upcoming' ? 'blue' as const :
    'gray' as const;

  return (
    <Card className="px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-headline text-xl font-black italic uppercase tracking-tight text-gray-900 dark:text-white">{sub.service_type}</p>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {new Date(sub.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' – '}
            {new Date(sub.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {sub.attended_sessions} / {sub.total_sessions} sessions
            <span className="mx-1.5 text-gray-300 dark:text-gray-700">·</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">₹{sub.amount.toLocaleString('en-IN')}</span>
          </p>
        </div>
        <Badge variant={variant} icon={sub.lifecycle_state === 'active' ? 'bolt' : sub.lifecycle_state === 'upcoming' ? 'schedule' : 'history'}>
          {sub.lifecycle_state}
        </Badge>
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
      <div className="page-content">
        <div className="page-stack">
          <div>
            <p className="section-eyebrow">Payments and packages</p>
            <h2 className="page-title mt-2">Billing</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Track every active block, upcoming package, and completed billing cycle in one place.
            </p>
          </div>

          {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
            <>
              {(data?.upcoming ?? []).length > 0 && (
                <section className="space-y-3">
                  <h3 className="section-eyebrow">Upcoming</h3>
                  <div className="space-y-3">
                    {data!.upcoming.map(s => <SubCard key={s.id} sub={s} />)}
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <h3 className="section-eyebrow">History</h3>
                {(data?.completed_and_active ?? []).length === 0 ? (
                  <div className="empty-state">No subscriptions yet</div>
                ) : (
                  <div className="space-y-3">
                    {data!.completed_and_active.map(s => <SubCard key={s.id} sub={s} />)}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
