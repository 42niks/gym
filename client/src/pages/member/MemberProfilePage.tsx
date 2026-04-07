import { useQuery } from '@tanstack/react-query';
import { api, type MemberProfile } from '../../lib/api.js';
import NavBar from '../../components/NavBar.js';
import Card from '../../components/Card.js';
import Spinner from '../../components/Spinner.js';

const memberLinks = [
  { to: '/home', label: 'Home' },
  { to: '/billing', label: 'Billing' },
  { to: '/profile', label: 'Profile' },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

export default function MemberProfilePage() {
  const { data, isLoading } = useQuery<MemberProfile>({
    queryKey: ['member-profile'],
    queryFn: () => api.get('/api/me/profile'),
  });

  return (
    <>
      <NavBar links={memberLinks} />
      <div className="px-4 pt-5 pb-8 space-y-4">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Profile</h2>

        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <Card className="px-5 py-1">
            <Row label="Name" value={data!.full_name} />
            <Row label="Email" value={data!.email} />
            <Row label="Phone" value={data!.phone} />
            <Row label="Member since" value={new Date(data!.join_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
          </Card>
        )}
      </div>
    </>
  );
}
