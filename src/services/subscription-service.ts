import type { AppDatabase } from '../db/client.js';
import { findMemberById } from '../repositories/members-repo.js';
import { createPackage, findPackageById } from '../repositories/packages-repo.js';
import { listSubscriptionsForMember, createSubscription, markSubscriptionCompleted, findSubscriptionById } from '../repositories/subscriptions-repo.js';
import { computeEndDate, deriveLifecycleState, checkOverlap } from '../lib/subscription.js';
import { getIstDate, isValidYmdDate } from '../lib/date.js';
import { formatSubscription } from './member-service.js';

export interface CreateSubscriptionInput {
  member_id: number;
  package_id?: number;
  start_date?: string;
  end_date?: string;
  amount?: number;
  custom_package?: {
    service_type: string;
    sessions: number;
    start_date: string;
    end_date: string;
    amount: number;
    consistency_window_days: number;
    consistency_min_days: number;
  };
}

export async function createNewSubscription(db: AppDatabase, input: CreateSubscriptionInput) {
  const today = getIstDate();
  const isCustom = !!input.custom_package;

  if (!Number.isInteger(input.member_id) || input.member_id <= 0) {
    return { error: 'Invalid member id', status: 400 as const };
  }
  if (isCustom && input.package_id !== undefined) {
    return { error: 'custom_package cannot be combined with package_id', status: 400 as const };
  }
  if (isCustom && (input.start_date !== undefined || input.end_date !== undefined || input.amount !== undefined)) {
    return { error: 'custom_package cannot be combined with root start_date, end_date, or amount', status: 400 as const };
  }

  const startDate = isCustom ? input.custom_package!.start_date : input.start_date;
  const endDate = isCustom ? input.custom_package!.end_date : input.end_date;

  const member = await findMemberById(db, input.member_id);
  if (!member) return { error: 'Member not found', status: 404 as const };
  if (member.status === 'archived') {
    return { error: 'Cannot create subscription for an archived member', status: 409 as const };
  }

  if (!startDate || !isValidYmdDate(startDate)) {
    return { error: 'Invalid start_date format', status: 400 as const };
  }
  if (startDate < member.join_date) {
    return { error: 'start_date cannot be before member join_date', status: 400 as const };
  }
  if (endDate !== undefined && !isValidYmdDate(endDate)) {
    return { error: 'Invalid end_date format', status: 400 as const };
  }

  if (isCustom) {
    const custom = input.custom_package!;
    if (!custom.service_type?.trim()) return { error: 'custom_package.service_type is required', status: 400 as const };
    if (custom.service_type.trim().length > 120) return { error: 'custom_package.service_type exceeds 120 characters', status: 400 as const };
    if (!isValidYmdDate(custom.end_date)) return { error: 'Invalid end_date format', status: 400 as const };
    if (custom.end_date <= custom.start_date) return { error: 'end_date must be after start_date', status: 400 as const };
    if (!Number.isInteger(custom.sessions) || custom.sessions <= 0) return { error: 'custom_package.sessions must be a positive integer', status: 400 as const };
    if (!Number.isInteger(custom.amount) || custom.amount <= 0) return { error: 'custom_package.amount must be a positive integer', status: 400 as const };
    if (!Number.isInteger(custom.consistency_window_days) || custom.consistency_window_days < 5) return { error: 'custom_package.consistency_window_days must be at least 5', status: 400 as const };
    if (!Number.isInteger(custom.consistency_min_days) || custom.consistency_min_days <= 0) return { error: 'custom_package.consistency_min_days must be a positive integer', status: 400 as const };
    if (custom.consistency_min_days >= custom.consistency_window_days) return { error: 'custom_package.consistency_min_days must be less than consistency_window_days', status: 400 as const };
  }

  let overlapEndDate: string;
  if (isCustom) {
    overlapEndDate = input.custom_package!.end_date;
  } else {
    const packageIdInput = input.package_id;
    if (!packageIdInput || !Number.isInteger(packageIdInput) || packageIdInput <= 0) {
      return { error: 'package_id is required', status: 400 as const };
    }
    const overlapPkg = await findPackageById(db, packageIdInput, { activeOnly: true });
    if (!overlapPkg) return { error: 'Package not found', status: 404 as const };
    const suggestedEndDate = computeEndDate(startDate, overlapPkg.duration_months);
    overlapEndDate = endDate ?? suggestedEndDate;
    if (overlapEndDate <= startDate) {
      return { error: 'end_date must be after start_date', status: 400 as const };
    }
  }

  // Check overlap against active/upcoming subscriptions
  const existingSubs = await listSubscriptionsForMember(db, input.member_id);
  const activeOrUpcoming = existingSubs.filter(s => {
    const state = deriveLifecycleState(s, today);
    return state === 'active' || state === 'upcoming';
  });

  for (const existing of activeOrUpcoming) {
    if (checkOverlap(existing, { start_date: startDate, end_date: overlapEndDate })) {
      return { error: 'New subscription overlaps with an existing active or upcoming subscription', status: 409 as const };
    }
  }

  let packageId: number;
  let totalSessions: number;
  let finalAmount: number;
  let resolvedEndDate: string;

  if (isCustom) {
    const custom = input.custom_package!;
    const startMonth = Number.parseInt(custom.start_date.slice(5, 7), 10);
    const endMonth = Number.parseInt(custom.end_date.slice(5, 7), 10);
    const durationMonths = Math.max(1, (Number.parseInt(custom.end_date.slice(0, 4), 10) - Number.parseInt(custom.start_date.slice(0, 4), 10)) * 12 + (endMonth - startMonth) + 1);
    packageId = await createPackage(db, {
      service_type: custom.service_type.trim(),
      sessions: custom.sessions,
      duration_months: durationMonths,
      price: custom.amount,
      consistency_window_days: custom.consistency_window_days,
      consistency_min_days: custom.consistency_min_days,
      is_active: 1,
      visibility_scope: 'private',
    });
    totalSessions = custom.sessions;
    finalAmount = custom.amount;
    resolvedEndDate = custom.end_date;
  } else {
    const packageIdInput = input.package_id;
    if (!packageIdInput || !Number.isInteger(packageIdInput) || packageIdInput <= 0) {
      return { error: 'package_id is required', status: 400 as const };
    }
    const pkg = await findPackageById(db, packageIdInput, { activeOnly: true });
    if (!pkg) return { error: 'Package not found', status: 404 as const };
    packageId = pkg.id;
    totalSessions = pkg.sessions;
    finalAmount = input.amount && Number.isInteger(input.amount) && input.amount > 0 ? input.amount : pkg.price;
    const suggestedEndDate = computeEndDate(startDate, pkg.duration_months);
    resolvedEndDate = endDate ?? suggestedEndDate;
    if (resolvedEndDate <= startDate) {
      return { error: 'end_date must be after start_date', status: 400 as const };
    }
  }

  const subId = await createSubscription(db, {
    member_id: input.member_id,
    package_id: packageId,
    start_date: startDate,
    end_date: resolvedEndDate,
    total_sessions: totalSessions,
    amount: finalAmount,
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
