import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type MemberListItem } from '../../lib/api.js';
import NavBar from '../../components/NavBar.js';
import Card from '../../components/Card.js';
import Button from '../../components/Button.js';
import Spinner from '../../components/Spinner.js';

const ownerLinks = [
  { to: '/owner', label: 'Dashboard' },
  { to: '/owner/members', label: 'Members' },
];

export default function OwnerMembersPage() {
  const [showArchived, setShowArchived] = useState(false);

  const { data: members = [], isLoading } = useQuery<MemberListItem[]>({
    queryKey: ['owner-members', showArchived],
    queryFn: () => api.get(`/api/members?status=${showArchived ? 'archived' : 'active'}`),
  });

  return (
    <>
      <NavBar links={ownerLinks} />
      <div className="px-4 pt-5 pb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Members</h2>
          <Link to="/owner/members/new">
            <Button className="text-sm py-2">+ New</Button>
          </Link>
        </div>

        <div className="flex gap-2 bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1">
          <button
            onClick={() => setShowArchived(false)}
            className={`flex-1 text-sm py-1.5 px-4 rounded-lg font-semibold transition-all ${
              !showArchived
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`flex-1 text-sm py-1.5 px-4 rounded-lg font-semibold transition-all ${
              showArchived
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Archived
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : members.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-400 dark:text-gray-500">No members found</p>
          </div>
        ) : (
          <Card className="divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
            {members.map(m => (
              <Link
                key={m.id}
                to={`/owner/members/${m.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{m.full_name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{m.email}</p>
                  {m.consistency && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{m.consistency.message}</p>
                  )}
                </div>
                <div className="text-right shrink-0 ml-4">
                  {m.active_subscription ? (
                    <>
                      <p className="text-xs font-bold text-brand-500">{m.active_subscription.remaining_sessions} left</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{m.active_subscription.service_type}</p>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">No plan</span>
                  )}
                  {m.marked_attendance_today && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 font-medium">In today</p>
                  )}
                </div>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
