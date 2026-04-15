import { describe, it, expect } from 'vitest';
import { computeConsistency, computeConsistencyWindow } from '../../src/lib/consistency.js';

describe('consistency logic', () => {
  it('should return null when no active subscription', () => {
    const result = computeConsistency({
      hasActiveSubscription: false,
      windowDays: 7,
      minDays: 3,
      earliestSubscriptionStart: '2026-01-01',
      attendanceDates: [],
      today: '2026-04-07',
    });
    expect(result).toBeNull();
  });

  it('should return building when not enough time elapsed since first subscription', () => {
    const result = computeConsistency({
      hasActiveSubscription: true,
      windowDays: 7,
      minDays: 3,
      earliestSubscriptionStart: '2026-04-03', // only 4 days ago, < 7
      attendanceDates: ['2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06', '2026-04-07'],
      today: '2026-04-07',
    });
    expect(result).toEqual({
      status: 'building',
      message: 'You are building your consistency, keep it up!',
    });
  });

  it('should return consistent when streak >= window_days', () => {
    // Window: 7 days, min: 3 days
    // Earliest subscription: 2026-03-20 (18 days ago)
    // Need at least 3 attendance days in every trailing 7-day window
    // going back from today for at least 7 consecutive days
    const attendanceDates = [
      '2026-03-25', '2026-03-26', '2026-03-27',
      '2026-03-28', '2026-03-29', '2026-03-30',
      '2026-03-31',
      '2026-04-01', '2026-04-02', '2026-04-03',
      '2026-04-04', '2026-04-05', '2026-04-06',
      '2026-04-07',
    ];
    const result = computeConsistency({
      hasActiveSubscription: true,
      windowDays: 7,
      minDays: 3,
      earliestSubscriptionStart: '2026-03-20',
      attendanceDates,
      today: '2026-04-07',
    });
    expect(result!.status).toBe('consistent');
    if (result?.status !== 'consistent') {
      throw new Error('Expected a consistent result');
    }
    expect(result.days).toBeGreaterThanOrEqual(7);
    expect(result!.message).toMatch(/You have been consistent for the last \d+ days/);
  });

  it('should return building when streak < window_days', () => {
    // Only attended on 2026-04-07, streak will be short
    const result = computeConsistency({
      hasActiveSubscription: true,
      windowDays: 7,
      minDays: 3,
      earliestSubscriptionStart: '2026-03-01',
      attendanceDates: ['2026-04-07'],
      today: '2026-04-07',
    });
    expect(result).toEqual({
      status: 'building',
      message: 'You are building your consistency, keep it up!',
    });
  });

  it('should evaluate at exactly the eligible boundary', () => {
    // earliest = 2026-04-01, window = 7, today = 2026-04-07
    // first_eligible_day = 2026-04-01 + 7 = 2026-04-08 => today < first_eligible => building
    const result = computeConsistency({
      hasActiveSubscription: true,
      windowDays: 7,
      minDays: 3,
      earliestSubscriptionStart: '2026-04-01',
      attendanceDates: ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06', '2026-04-07'],
      today: '2026-04-07',
    });
    // today - earliest = 6 days, < 7 => building
    expect(result!.status).toBe('building');
  });

  it('should handle consistency across subscription boundaries', () => {
    // Member had sub1 starting 2026-03-01, sub2 starting 2026-04-01
    // Attendance spans both subscriptions
    const attendanceDates = [
      '2026-03-25', '2026-03-26', '2026-03-27',
      '2026-03-29', '2026-03-31',
      '2026-04-01', '2026-04-02', '2026-04-03',
      '2026-04-05', '2026-04-06', '2026-04-07',
    ];
    const result = computeConsistency({
      hasActiveSubscription: true,
      windowDays: 7,
      minDays: 3,
      earliestSubscriptionStart: '2026-03-01',
      attendanceDates,
      today: '2026-04-07',
    });
    // With 3+ attendances in every 7-day window, should be consistent
    expect(result!.status).toBe('consistent');
  });

  it('should break streak when a window has insufficient attendance', () => {
    // Gap in attendance breaks the streak
    const attendanceDates = [
      '2026-04-05', '2026-04-06', '2026-04-07', // recent - good
      // gap from 2026-03-28 to 2026-04-04 - only 1 attendance
      '2026-04-01',
    ];
    const result = computeConsistency({
      hasActiveSubscription: true,
      windowDays: 7,
      minDays: 3,
      earliestSubscriptionStart: '2026-03-01',
      attendanceDates,
      today: '2026-04-07',
    });
    // The window [2026-04-01, 2026-04-07] has 4 attendance days (04-01, 04-05, 04-06, 04-07) -> ok
    // The window [2026-03-31, 2026-04-06] has 3 attendance days (04-01, 04-05, 04-06) -> ok
    // The window [2026-03-30, 2026-04-05] has 2 attendance days (04-01, 04-05) -> NOT ok, breaks
    // streak = 2 < 7 -> building
    expect(result!.status).toBe('building');
  });

  it('should return building when no attendance at all', () => {
    const result = computeConsistency({
      hasActiveSubscription: true,
      windowDays: 7,
      minDays: 3,
      earliestSubscriptionStart: '2026-03-01',
      attendanceDates: [],
      today: '2026-04-07',
    });
    expect(result!.status).toBe('building');
  });

  it('should handle min_days = 1 (easy consistency)', () => {
    // MMA package: 1 exercise day in 7 days
    const attendanceDates = [
      '2026-03-15', '2026-03-22', '2026-03-29', '2026-04-05',
    ];
    const result = computeConsistency({
      hasActiveSubscription: true,
      windowDays: 7,
      minDays: 1,
      earliestSubscriptionStart: '2026-03-01',
      attendanceDates,
      today: '2026-04-07',
    });
    // Every 7-day window back from 04-07 will have at least 1 attendance
    // [04-01..04-07] has 04-05 -> ok
    // [03-31..04-06] has 04-05 -> ok
    // ... continues until a window doesn't have one
    expect(result!.status).toBe('consistent');
  });

  it('should end the ribbon at the latest attended day until today is marked', () => {
    const input = {
      hasActiveSubscription: true,
      windowDays: 7,
      minDays: 3,
      earliestSubscriptionStart: '2026-03-20',
      attendanceDates: [
        '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31',
        '2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06',
      ],
      today: '2026-04-08',
    } as const;

    const consistency = computeConsistency(input);
    const ribbon = computeConsistencyWindow(input);

    expect(consistency?.status).toBe('consistent');
    if (consistency?.status !== 'consistent' || !ribbon) {
      throw new Error('Expected a consistent result with ribbon metadata');
    }

    expect(ribbon.start_date).toBe('2026-03-25');
    expect(ribbon.end_date).toBe('2026-04-06');
    expect(ribbon.streak_days).toBe(consistency.days);
  });

  it('should include today and the bridged rest day once today is marked', () => {
    const input = {
      hasActiveSubscription: true,
      windowDays: 7,
      minDays: 3,
      earliestSubscriptionStart: '2026-03-20',
      attendanceDates: [
        '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31',
        '2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06', '2026-04-08',
      ],
      today: '2026-04-08',
    } as const;

    const consistency = computeConsistency(input);
    const ribbon = computeConsistencyWindow(input);

    expect(consistency?.status).toBe('consistent');
    if (consistency?.status !== 'consistent' || !ribbon) {
      throw new Error('Expected a consistent result with ribbon metadata');
    }

    expect(ribbon.start_date).toBe('2026-03-25');
    expect(ribbon.end_date).toBe('2026-04-08');
    expect(ribbon.streak_days).toBe(consistency.days);
  });

  it('should return the latest completed consistency window even after today breaks the streak', () => {
    const input = {
      hasActiveSubscription: true,
      windowDays: 7,
      minDays: 3,
      earliestSubscriptionStart: '2026-02-01',
      attendanceDates: [
        '2026-03-02', '2026-03-04', '2026-03-11', '2026-03-13', '2026-03-16', '2026-03-18',
        '2026-03-20', '2026-03-23', '2026-03-25', '2026-03-27', '2026-03-30', '2026-04-01',
        '2026-04-03', '2026-04-06', '2026-04-08', '2026-04-10', '2026-04-13',
      ],
      today: '2026-04-15',
    } as const;

    expect(computeConsistency(input)).toEqual({
      status: 'building',
      message: 'You are building your consistency, keep it up!',
    });

    expect(computeConsistencyWindow(input)).toEqual({
      start_date: '2026-03-11',
      end_date: '2026-04-13',
      streak_days: 30,
    });
  });
});
