import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type MemberDetail, type Subscription, ApiError } from '../../lib/api.js';
import AppShell from '../../components/AppShell.js';
import Card from '../../components/Card.js';
import Badge from '../../components/Badge.js';
import Button from '../../components/Button.js';
import Spinner from '../../components/Spinner.js';
import { ownerLinks } from './ownerLinks.js';

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
    <Card className="px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-headline text-xl font-black italic uppercase tracking-tight text-black dark:text-white">{sub.service_type}</p>
          <p className="mt-2 text-xs text-black/60 dark:text-white/70">
            {new Date(sub.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' – '}
            {new Date(sub.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="mt-2 text-sm text-black/60 dark:text-white/70">
            {sub.attended_sessions} / {sub.total_sessions} sessions
            <span className="mx-1.5 text-black/60 dark:text-white/70">·</span>
            <span className="font-semibold text-black/75 dark:text-white/80">₹{sub.amount.toLocaleString('en-IN')}</span>
          </p>
        </div>
        <Badge variant={variant} icon={sub.lifecycle_state === 'active' ? 'bolt' : sub.lifecycle_state === 'upcoming' ? 'schedule' : 'history'}>
          {sub.lifecycle_state}
        </Badge>
      </div>
      {sub.lifecycle_state === 'active' && !sub.owner_completed && (
        <div className="mt-4 border-t border-black pt-4 dark:border-white">
          <Button variant="ghost" onClick={handleComplete} disabled={completing} className="text-xs px-0 py-0" icon={completing ? 'progress_activity' : 'task_alt'}>
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
      <div className="flex items-center gap-2 text-brand-600 dark:text-brand-300">
        <span className="text-lg">✓</span>
        <span className="text-sm font-semibold">Attendance marked for today</span>
      </div>
    );
  }

  return (
    <div>
      <Button onClick={() => mark.mutate()} disabled={mark.isPending} className="py-2.5" icon={mark.isPending ? 'progress_activity' : 'how_to_reg'}>
        {mark.isPending ? 'Marking…' : 'Mark attendance'}
      </Button>
      {err && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{err}</p>}
    </div>
  );
}

function sortSubscriptions(subs: Subscription[]) {
  const priority: Record<Subscription['lifecycle_state'], number> = {
    upcoming: 0,
    active: 1,
    completed: 2,
  };

  return [...subs].sort((a, b) => {
    const priorityDiff = priority[a.lifecycle_state] - priority[b.lifecycle_state];
    if (priorityDiff !== 0) return priorityDiff;
    if (a.lifecycle_state === 'upcoming' && b.lifecycle_state === 'upcoming') {
      return a.start_date.localeCompare(b.start_date) || a.id - b.id;
    }
    return b.start_date.localeCompare(a.start_date) || b.id - a.id;
  });
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

  const { data: subs = [] } = useQuery<Subscription[]>({
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
    return (
      <AppShell links={ownerLinks}>
        <div className="page-stack">
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!detail) return null;

  const allSubs = sortSubscriptions(subs);

  return (
    <AppShell links={ownerLinks}>
      <div className="page-stack">
        <Link to="/members" className="back-link">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Members
        </Link>

        <div>
          <p className="section-eyebrow">Member record</p>
          <h2 className="page-title mt-2">Member detail</h2>
        </div>

        <Card className="px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-headline text-3xl font-black italic uppercase tracking-tight text-black dark:text-white">{detail.full_name}</h2>
              <p className="mt-1 break-all text-sm text-black/60 dark:text-white/70">{detail.email}</p>
              <p className="mt-0.5 text-xs text-black/60 dark:text-white/70">{detail.phone}</p>
              <p className="mt-1 text-xs text-black/60 dark:text-white/70">
                Joined {new Date(detail.join_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {detail.consistency && (
                <p className="mt-1 text-xs text-black/60 dark:text-white/70">{detail.consistency.message}</p>
              )}
              {detail.renewal && (detail.renewal.kind === 'ends_soon' || detail.renewal.kind === 'no_active') && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">{detail.renewal.message}</p>
              )}
            </div>
            <Badge variant={detail.status === 'active' ? 'green' : 'gray'} icon={detail.status === 'active' ? 'check_circle' : 'archive'}>
              {detail.status}
            </Badge>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-black pt-4 dark:border-white">
            {detail.active_subscription && (
              <AttendanceButton memberId={id!} markedToday={detail.marked_attendance_today} />
            )}
            <Link to={`/members/${id}/subscriptions/new`}>
              <Button variant="secondary" className="py-2.5 text-sm" icon="add_card">
                Subscription
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleArchive} disabled={archiving} className="text-sm py-0" icon={detail.status === 'active' ? 'archive' : 'unarchive'}>
              {archiving ? '…' : detail.status === 'active' ? 'Archive' : 'Unarchive'}
            </Button>
          </div>
          {archiveErr && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{archiveErr}</p>}
        </Card>

        <div>
          <h3 className="section-eyebrow mb-3">Subscriptions</h3>
          {allSubs.length === 0 ? (
            <div className="empty-state">No subscriptions yet</div>
          ) : (
            <div className="space-y-3">
              {allSubs.map(s => <SubCard key={s.id} sub={s} memberId={id!} />)}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
