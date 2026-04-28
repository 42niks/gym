import { useQuery } from '@tanstack/react-query';
import { api, type MemberProfile } from '../../lib/api.js';
import Card from '../../components/Card.js';
import ProfileFieldRow from '../../components/ProfileFieldRow.js';
import Spinner from '../../components/Spinner.js';

export default function MemberProfilePage() {
  const { data, isLoading } = useQuery<MemberProfile>({
    queryKey: ['member-profile'],
    queryFn: () => api.get('/api/member/profile'),
  });

  return (
    <div className="page-stack">
          <div>
            <h2 className="page-title">PROFILE</h2>
          </div>

          {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
            <Card className="p-5">
              <div className="grid gap-3">
                <div className="surface-inset">
                  <ProfileFieldRow label="Name" value={data!.full_name} />
                </div>
                <div className="surface-inset">
                  <ProfileFieldRow label="Email" value={data!.email} />
                </div>
                <div className="surface-inset">
                  <ProfileFieldRow label="Phone" value={data!.phone} />
                </div>
                <div className="surface-inset">
                  <ProfileFieldRow
                    label="Member since"
                    value={new Date(data!.join_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  />
                </div>
              </div>
            </Card>
          )}
    </div>
  );
}
