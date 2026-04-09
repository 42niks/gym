import { useQuery } from '@tanstack/react-query';
import { api, type MemberProfile } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Spinner from '../../components/Spinner.js';

const memberLinks = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/billing', label: 'Billing', icon: 'credit_card' },
  { to: '/profile', label: 'Profile', icon: 'person' },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-label text-[0.66rem] font-bold italic uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white sm:text-right">{value}</span>
    </div>
  );
}

export default function MemberProfilePage() {
  const { data, isLoading } = useQuery<MemberProfile>({
    queryKey: ['member-profile'],
    queryFn: () => api.get('/api/me/profile'),
  });

  return (
    <AppShell links={memberLinks}>
      <div className="page-stack">
          <div>
            <p className="section-eyebrow">Member record</p>
            <h2 className="page-title mt-2">Profile</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Your account details live here, including the contact information used for membership access.
            </p>
          </div>

          {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
            <Card className="p-5">
              <div className="grid gap-3">
                <div className="surface-inset">
                  <Row label="Name" value={data!.full_name} />
                </div>
                <div className="surface-inset">
                  <Row label="Email" value={data!.email} />
                </div>
                <div className="surface-inset">
                  <Row label="Phone" value={data!.phone} />
                </div>
                <div className="surface-inset">
                  <Row label="Member since" value={new Date(data!.join_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
                </div>
              </div>
            </Card>
          )}
      </div>
    </AppShell>
  );
}
