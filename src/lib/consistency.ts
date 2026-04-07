import { addDays, diffDays } from './date.js';

export interface ConsistencyInput {
  hasActiveSubscription: boolean;
  windowDays: number;
  minDays: number;
  earliestSubscriptionStart: string;
  attendanceDates: string[];
  today: string;
}

export type ConsistencyResult = {
  status: 'consistent';
  days: number;
  message: string;
} | {
  status: 'building';
  message: string;
} | null;

export function computeConsistency(input: ConsistencyInput): ConsistencyResult {
  const { hasActiveSubscription, windowDays, minDays, earliestSubscriptionStart, attendanceDates, today } = input;

  if (!hasActiveSubscription) return null;

  const daysSinceStart = diffDays(today, earliestSubscriptionStart);
  if (daysSinceStart < windowDays) {
    return { status: 'building', message: 'You are building your consistency, keep it up!' };
  }

  // Build a Set for O(1) lookups
  const attendanceSet = new Set(attendanceDates);

  const firstEligibleDay = addDays(earliestSubscriptionStart, windowDays);
  let streak = 0;
  let d = today;

  while (d >= firstEligibleDay) {
    const windowStart = addDays(d, -(windowDays - 1));
    let attendedInWindow = 0;

    for (let i = 0; i < windowDays; i++) {
      const checkDate = addDays(windowStart, i);
      if (attendanceSet.has(checkDate)) {
        attendedInWindow++;
      }
    }

    if (attendedInWindow >= minDays) {
      streak++;
      d = addDays(d, -1);
    } else {
      break;
    }
  }

  if (streak >= windowDays) {
    return {
      status: 'consistent',
      days: streak,
      message: `You have been consistent for the last ${streak} days`,
    };
  }

  return { status: 'building', message: 'You are building your consistency, keep it up!' };
}
