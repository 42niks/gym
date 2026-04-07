import Database from 'better-sqlite3';
import { findMemberById, unarchiveMember } from '../repositories/members-repo.js';
import { findPackageById } from '../repositories/packages-repo.js';
import { listSubscriptionsForMember, createSubscription, markSubscriptionCompleted, findSubscriptionById } from '../repositories/subscriptions-repo.js';
import { computeEndDate, deriveLifecycleState, checkOverlap } from '../lib/subscription.js';
import { getIstDate } from '../lib/date.js';
import { formatSubscription } from './member-service.js';

export interface CreateSubscriptionInput {
  member_id: number;
  package_id: number;
  start_date: string;
}

export function createNewSubscription(db: Database.Database, input: CreateSubscriptionInput) {
  const today = getIstDate();

  // Validate start_date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start_date)) {
    return { error: 'Invalid start_date format', status: 400 as const };
  }

  if (input.start_date < today) {
    return { error: 'start_date cannot be in the past', status: 400 as const };
  }

  const member = findMemberById(db, input.member_id);
  if (!member) return { error: 'Member not found', status: 404 as const };

  const pkg = findPackageById(db, input.package_id);
  if (!pkg) return { error: 'Package not found', status: 404 as const };

  const endDate = computeEndDate(input.start_date, pkg.duration_months);

  // Check overlap against active/upcoming subscriptions
  const existingSubs = listSubscriptionsForMember(db, input.member_id);
  const activeOrUpcoming = existingSubs.filter(s => {
    const state = deriveLifecycleState(s, today);
    return state === 'active' || state === 'upcoming';
  });

  for (const existing of activeOrUpcoming) {
    if (checkOverlap(existing, { start_date: input.start_date, end_date: endDate })) {
      return { error: 'New subscription overlaps with an existing active or upcoming subscription', status: 409 as const };
    }
  }

  // Create subscription (and unarchive if needed) in a transaction
  const doCreate = db.transaction(() => {
    if (member.status === 'archived') {
      unarchiveMember(db, member.id);
    }
    const subId = createSubscription(db, {
      member_id: input.member_id,
      package_id: input.package_id,
      start_date: input.start_date,
      end_date: endDate,
      total_sessions: pkg.sessions,
      amount: pkg.price,
    });
    return subId;
  });

  const subId = doCreate();
  const sub = findSubscriptionById(db, subId)!;
  return { data: formatSubscription(sub, today), status: 201 as const };
}

export function completeSubscription(db: Database.Database, subscriptionId: number) {
  const sub = findSubscriptionById(db, subscriptionId);
  if (!sub) return { error: 'Subscription not found', status: 404 as const };

  const today = getIstDate();
  const state = deriveLifecycleState(sub, today);

  if (state === 'completed') {
    return { error: 'Subscription is already completed', status: 409 as const };
  }

  markSubscriptionCompleted(db, subscriptionId);
  return { data: { ok: true }, status: 200 as const };
}
