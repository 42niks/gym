import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type MemberListItem } from '../../lib/api.js';
import NavBar from '../../components/NavBar.js';
import Card from '../../components/Card.js';
import Button from '../../components/Button.js';
import Spinner from '../../components/Spinner.js';

const ownerLinks = [
  { to: '/owner', label: 'Dashboard', icon: 'dashboard' },
  { to: '/owner/members', label: 'Members', icon: 'groups' },
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
      <div className="page-content">
        <div className="page-stack">
        <div className="page-header">
          <div>
            <p className="section-eyebrow">Member roster</p>
            <h2 className="page-title mt-2">Members</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Review the full roster, switch between active and archived members, and jump into individual records quickly.
            </p>
          </div>
          <Link to="/owner/members/new">
            <Button className="text-sm py-2" icon="person_add">
              + New
            </Button>
          </Link>
        </div>

        <div className="glass-panel flex gap-2 p-1">
          <button
            onClick={() => setShowArchived(false)}
            className={`flex-1 rounded-[1.2rem] border px-4 py-2 font-label text-[0.72rem] font-bold italic uppercase tracking-[0.18em] transition-all ${
              !showArchived
                ? 'border-white/70 bg-white bg-brand-gradient text-gray-900 shadow-panel dark:border-white/10 dark:bg-surface-dark dark:bg-brand-gradient-dark dark:text-white'
                : 'border-transparent text-gray-500 hover:border-white/55 hover:bg-white/60 hover:text-gray-900 dark:text-gray-400 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`flex-1 rounded-[1.2rem] border px-4 py-2 font-label text-[0.72rem] font-bold italic uppercase tracking-[0.18em] transition-all ${
              showArchived
                ? 'border-white/70 bg-white bg-brand-gradient text-gray-900 shadow-panel dark:border-white/10 dark:bg-surface-dark dark:bg-brand-gradient-dark dark:text-white'
                : 'border-transparent text-gray-500 hover:border-white/55 hover:bg-white/60 hover:text-gray-900 dark:text-gray-400 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white'
            }`}
          >
            Archived
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : members.length === 0 ? (
          <div className="empty-state">No members found</div>
        ) : (
          <Card className="space-y-1.5 p-3">
            {members.map(m => (
              <Link
                key={m.id}
                to={`/owner/members/${m.id}`}
                className="flex items-center justify-between rounded-2xl px-4 py-4 transition-all hover:bg-surface-raised/80 dark:hover:bg-surface-raised/60"
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
                      <p className="text-xs font-bold text-brand-600 dark:text-brand-300">{m.active_subscription.remaining_sessions} left</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{m.active_subscription.service_type}</p>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">No plan</span>
                  )}
                  {m.marked_attendance_today && (
                    <p className="mt-0.5 text-xs font-medium text-brand-600 dark:text-brand-300">In today</p>
                  )}
                </div>
              </Link>
            ))}
          </Card>
        )}
        </div>
      </div>
    </>
  );
}
