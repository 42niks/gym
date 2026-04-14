import { useQuery } from '@tanstack/react-query';
import { api, type MemberProfile } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Spinner from '../../components/Spinner.js';
import { memberLinks } from './memberLinks.js';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <span className="font-label text-[0.66rem] font-bold uppercase tracking-[0.22em] text-black dark:text-white">{label}</span>
      <span className="min-w-0 text-right text-sm font-semibold text-black dark:text-white">{value}</span>
    </div>
  );
}

export default function MemberProfilePage() {
  const { data, isLoading } = useQuery<MemberProfile>({
    queryKey: ['member-profile'],
    queryFn: () => api.get('/api/member/profile'),
  });

  return (
    <AppShell links={memberLinks}>
      <div className="page-stack">
          <div>
            <h2 className="page-title">PROFILE</h2>
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
