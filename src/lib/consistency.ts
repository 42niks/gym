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

export interface ConsistencyWindowResult {
  start_date: string;
  end_date: string;
  streak_days: number;
}

function getConsistencyStreakDays(input: ConsistencyInput, anchorDay: string = input.today): number {
  const { windowDays, minDays, earliestSubscriptionStart, attendanceDates } = input;

  const attendanceSet = new Set(attendanceDates);
  const firstEligibleDay = addDays(earliestSubscriptionStart, windowDays);
  let streak = 0;
  let d = anchorDay;

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

  return streak;
}

export function computeConsistency(input: ConsistencyInput): ConsistencyResult {
  const { hasActiveSubscription, windowDays, minDays, earliestSubscriptionStart, attendanceDates, today } = input;

  if (!hasActiveSubscription) return null;

  const daysSinceStart = diffDays(today, earliestSubscriptionStart);
  if (daysSinceStart < windowDays) {
    return { status: 'building', message: 'You are building your consistency, keep it up!' };
  }

  const streak = getConsistencyStreakDays(input);

  if (streak >= windowDays) {
    return {
      status: 'consistent',
      days: streak,
      message: `You have been consistent for the last ${streak} days`,
    };
  }

  return { status: 'building', message: 'You are building your consistency, keep it up!' };
}

export function computeConsistencyWindow(input: ConsistencyInput): ConsistencyWindowResult | null {
  const { hasActiveSubscription, windowDays, earliestSubscriptionStart, attendanceDates, today } = input;

  if (!hasActiveSubscription) return null;

  const daysSinceStart = diffDays(today, earliestSubscriptionStart);
  if (daysSinceStart < windowDays) return null;

  const firstEligibleDay = addDays(earliestSubscriptionStart, windowDays);
  let anchorDay = today;
  let streak = 0;

  while (anchorDay >= firstEligibleDay) {
    streak = getConsistencyStreakDays(input, anchorDay);
    if (streak >= windowDays) {
      break;
    }

    anchorDay = addDays(anchorDay, -1);
  }

  if (streak < windowDays) return null;

  const startDate = addDays(anchorDay, -(streak - 1));
  let endDate: string | null = null;

  for (const attendanceDate of attendanceDates) {
    if (attendanceDate < startDate || attendanceDate > anchorDay) continue;
    if (!endDate || attendanceDate > endDate) {
      endDate = attendanceDate;
    }
  }

  if (!endDate) return null;

  return {
    start_date: startDate,
    end_date: endDate,
    streak_days: streak,
  };
}
