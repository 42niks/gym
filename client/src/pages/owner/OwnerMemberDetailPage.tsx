import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type MemberDetail, type GroupedSubscriptions, type Subscription, ApiError } from '../../lib/api.js';
import NavBar from '../../components/NavBar.js';
import Card from '../../components/Card.js';
import Badge from '../../components/Badge.js';
import Button from '../../components/Button.js';
import Spinner from '../../components/Spinner.js';

const ownerLinks = [
  { to: '/owner', label: 'Dashboard' },
  { to: '/owner/members', label: 'Members' },
];

function SubCard({ sub, memberId }: { sub: Subscription; memberId: string }) {
  const queryClient = useQueryClient();
  const [completing, setCompleting] = useState(false);
  const [err, setErr] = useState('');

  const variant =
    sub.lifecycle_state === 'active' ? 'green' as const :
    sub.lifecycle_state === 'upcoming' ? 'blue' as const :
    'gray' as const;

  async function handleComplete() {
    setErr('');
    setCompleting(true);
    try {
      await api.post(`/api/subscriptions/${sub.id}/complete`);
      queryClient.invalidateQueries({ queryKey: ['member-detail', memberId] });
      queryClient.invalidateQueries({ queryKey: ['member-subs', memberId] });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setCompleting(false);
    }
  }

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
      {sub.lifecycle_state === 'active' && !sub.owner_completed && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button variant="ghost" onClick={handleComplete} disabled={completing} className="text-xs px-0 py-0">
            {completing ? 'Completing…' : 'Mark complete'}
          </Button>
          {err && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{err}</p>}
        </div>
      )}
    </Card>
  );
}

function AttendanceButton({ memberId, markedToday }: { memberId: string; markedToday: boolean }) {
  const queryClient = useQueryClient();
  const [err, setErr] = useState('');

  const mark = useMutation({
    mutationFn: () => api.post(`/api/members/${memberId}/sessions`),
    onSuccess: () => {
      setErr('');
      queryClient.invalidateQueries({ queryKey: ['member-detail', memberId] });
    },
    onError: (e: any) => setErr(e.message ?? 'Failed'),
  });

  if (markedToday) {
    return (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <span className="text-lg">✓</span>
        <span className="text-sm font-semibold">Attendance marked for today</span>
      </div>
    );
  }

  return (
    <div>
      <Button onClick={() => mark.mutate()} disabled={mark.isPending} className="py-2.5">
        {mark.isPending ? 'Marking…' : 'Mark attendance'}
      </Button>
      {err && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{err}</p>}
    </div>
  );
}

export default function OwnerMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [archiving, setArchiving] = useState(false);
  const [archiveErr, setArchiveErr] = useState('');

  const { data: detail, isLoading } = useQuery<MemberDetail>({
    queryKey: ['member-detail', id],
    queryFn: () => api.get(`/api/members/${id}`),
  });

  const { data: subs } = useQuery<GroupedSubscriptions>({
    queryKey: ['member-subs', id],
    queryFn: () => api.get(`/api/members/${id}/subscriptions`),
    enabled: !!id,
  });

  async function handleArchive() {
    if (!detail) return;
    const action = detail.status === 'active' ? 'archive' : 'unarchive';
    if (!confirm(`${action} ${detail.full_name}?`)) return;
    setArchiveErr('');
    setArchiving(true);
    try {
      await api.post(`/api/members/${id}/archive`);
      queryClient.invalidateQueries({ queryKey: ['member-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['owner-members'] });
    } catch (e) {
      setArchiveErr(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setArchiving(false);
    }
  }

  if (isLoading) {
    return <><NavBar links={ownerLinks} /><div className="flex justify-center py-16"><Spinner /></div></>;
  }

  if (!detail) return null;

  const allSubs = [...(subs?.upcoming ?? []), ...(subs?.completed_and_active ?? [])];

  return (
    <>
      <NavBar links={ownerLinks} />
      <div className="px-4 pt-4 pb-8 space-y-5">
        <Link to="/owner/members" className="inline-flex items-center text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          ← Members
        </Link>

        {/* Member header card */}
        <Card className="px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">{detail.full_name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 break-all">{detail.email}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{detail.phone}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Joined {new Date(detail.join_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {detail.consistency && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{detail.consistency.message}</p>
              )}
              {detail.renewal && (detail.renewal.kind === 'ends_soon' || detail.renewal.kind === 'no_active') && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">{detail.renewal.message}</p>
              )}
            </div>
            <Badge variant={detail.status === 'active' ? 'green' : 'gray'}>{detail.status}</Badge>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3">
            {detail.active_subscription && (
              <AttendanceButton memberId={id!} markedToday={detail.marked_attendance_today} />
            )}
            <Link to={`/owner/members/${id}/subscriptions/new`}>
              <Button variant="secondary" className="py-2.5 text-sm">+ Subscription</Button>
            </Link>
            <Button variant="ghost" onClick={handleArchive} disabled={archiving} className="text-sm py-0">
              {archiving ? '…' : detail.status === 'active' ? 'Archive' : 'Unarchive'}
            </Button>
          </div>
          {archiveErr && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{archiveErr}</p>}
        </Card>

        {/* Subscriptions */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Subscriptions</h3>
          {allSubs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400 dark:text-gray-500">No subscriptions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allSubs.map(s => <SubCard key={s.id} sub={s} memberId={id!} />)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
