import { diffDays, formatHumanDate } from './date.js';

export interface RenewalInput {
  active: {
    end_date: string;
    total_sessions: number;
    attended_sessions: number;
  } | null;
  upcomingStartDate: string | null;
  today: string;
}

export type RenewalResult = {
  kind: 'ends_soon';
  message: string;
} | {
  kind: 'starts_on';
  message: string;
  upcoming_start_date: string;
} | {
  kind: 'no_active';
  message: string;
} | null;

export function computeRenewal(input: RenewalInput): RenewalResult {
  const { active, upcomingStartDate, today } = input;

  if (active) {
    const remaining = active.total_sessions - active.attended_sessions;
    const daysUntilEnd = diffDays(active.end_date, today);
    const nearingEnd = remaining <= 3 || daysUntilEnd <= 5;

    if (nearingEnd && !upcomingStartDate) {
      return {
        kind: 'ends_soon',
        message: 'Your subscription ends soon, please renew.',
      };
    }
    // Active and not nearing end, or nearing end with upcoming => null
    return null;
  }

  // No active subscription
  if (upcomingStartDate) {
    return {
      kind: 'starts_on',
      message: `Your subscription starts on ${formatHumanDate(upcomingStartDate)}.`,
      upcoming_start_date: upcomingStartDate,
    };
  }

  return {
    kind: 'no_active',
    message: 'You have no active subscription, please activate.',
  };
}
