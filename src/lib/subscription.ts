import { addMonthsClamped, addDays } from './date.js';

export function computeEndDate(startDate: string, durationMonths: number): string {
  const targetDate = addMonthsClamped(startDate, durationMonths);
  return addDays(targetDate, -1);
}

export interface SubscriptionForLifecycle {
  start_date: string;
  end_date: string;
  total_sessions: number;
  attended_sessions: number;
  owner_completed: number;
}

export function deriveLifecycleState(sub: SubscriptionForLifecycle, today: string): 'active' | 'upcoming' | 'completed' {
  const remaining = sub.total_sessions - sub.attended_sessions;
  if (sub.owner_completed === 1) return 'completed';
  if (today > sub.end_date) return 'completed';
  if (remaining === 0) return 'completed';
  if (sub.start_date > today) return 'upcoming';
  return 'active';
}

export function checkOverlap(
  existing: { start_date: string; end_date: string },
  newSub: { start_date: string; end_date: string }
): boolean {
  return newSub.start_date <= existing.end_date && newSub.end_date >= existing.start_date;
}
