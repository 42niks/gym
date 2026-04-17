import type { AppDatabase } from '../db/client.js';
import { findMemberById } from '../repositories/members-repo.js';
import { findPackageById } from '../repositories/packages-repo.js';
import { listSubscriptionsForMember, createSubscription, markSubscriptionCompleted, findSubscriptionById } from '../repositories/subscriptions-repo.js';
import { computeEndDate, deriveLifecycleState, checkOverlap } from '../lib/subscription.js';
import { getIstDate, isValidYmdDate } from '../lib/date.js';
import { formatSubscription } from './member-service.js';

export interface CreateSubscriptionInput {
  member_id: number;
  package_id: number;
  start_date: string;
}

export async function createNewSubscription(db: AppDatabase, input: CreateSubscriptionInput) {
  const today = getIstDate();

  if (!isValidYmdDate(input.start_date)) {
    return { error: 'Invalid start_date format', status: 400 as const };
  }

  const member = await findMemberById(db, input.member_id);
  if (!member) return { error: 'Member not found', status: 404 as const };
  if (member.status === 'archived') {
    return { error: 'Cannot create subscription for an archived member', status: 409 as const };
  }
  if (input.start_date < member.join_date) {
    return { error: 'start_date cannot be before member join_date', status: 400 as const };
  }

  const pkg = await findPackageById(db, input.package_id, { activeOnly: true });
  if (!pkg) return { error: 'Package not found', status: 404 as const };

  const endDate = computeEndDate(input.start_date, pkg.duration_months);

  // Check overlap against active/upcoming subscriptions
  const existingSubs = await listSubscriptionsForMember(db, input.member_id);
  const activeOrUpcoming = existingSubs.filter(s => {
    const state = deriveLifecycleState(s, today);
    return state === 'active' || state === 'upcoming';
  });

  for (const existing of activeOrUpcoming) {
    if (checkOverlap(existing, { start_date: input.start_date, end_date: endDate })) {
      return { error: 'New subscription overlaps with an existing active or upcoming subscription', status: 409 as const };
    }
  }

  const subId = await createSubscription(db, {
    member_id: input.member_id,
    package_id: input.package_id,
    start_date: input.start_date,
    end_date: endDate,
    total_sessions: pkg.sessions,
    amount: pkg.price,
  });

  const sub = await findSubscriptionById(db, subId);
  if (!sub) {
    return { error: 'Failed to load created subscription', status: 500 as const };
  }
  return { data: formatSubscription(sub, today), status: 201 as const };
}

export async function completeSubscription(db: AppDatabase, subscriptionId: number) {
  const sub = await findSubscriptionById(db, subscriptionId);
  if (!sub) return { error: 'Subscription not found', status: 404 as const };

  const today = getIstDate();
  const state = deriveLifecycleState(sub, today);

  if (state === 'completed') {
    return { error: 'Subscription is already completed', status: 409 as const };
  }

  await markSubscriptionCompleted(db, subscriptionId);
  return { data: { ok: true }, status: 200 as const };
}
