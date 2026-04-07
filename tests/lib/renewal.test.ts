import { describe, it, expect } from 'vitest';
import { computeRenewal } from '../../src/lib/renewal.js';

describe('renewal logic', () => {
  const today = '2026-04-07';

  it('should return ends_soon when active is nearing end (few sessions) and no upcoming', () => {
    const result = computeRenewal({
      active: {
        end_date: '2026-04-30',
        total_sessions: 12,
        attended_sessions: 10, // remaining = 2 < 3
      },
      upcomingStartDate: null,
      today,
    });
    expect(result).toEqual({
      kind: 'ends_soon',
      message: 'Your subscription ends soon, please renew.',
    });
  });

  it('should return ends_soon when active is nearing end (few days) and no upcoming', () => {
    const result = computeRenewal({
      active: {
        end_date: '2026-04-11', // 4 days away <= 4
        total_sessions: 12,
        attended_sessions: 5,
      },
      upcomingStartDate: null,
      today,
    });
    expect(result).toEqual({
      kind: 'ends_soon',
      message: 'Your subscription ends soon, please renew.',
    });
  });

  it('should return null when active is nearing end but upcoming exists', () => {
    const result = computeRenewal({
      active: {
        end_date: '2026-04-11',
        total_sessions: 12,
        attended_sessions: 10,
      },
      upcomingStartDate: '2026-04-12',
      today,
    });
    expect(result).toBeNull();
  });

  it('should return starts_on when no active but upcoming exists', () => {
    const result = computeRenewal({
      active: null,
      upcomingStartDate: '2026-05-10',
      today,
    });
    expect(result).toEqual({
      kind: 'starts_on',
      message: 'Your subscription starts on 10 May 2026.',
      upcoming_start_date: '2026-05-10',
    });
  });

  it('should return no_active when no active and no upcoming', () => {
    const result = computeRenewal({
      active: null,
      upcomingStartDate: null,
      today,
    });
    expect(result).toEqual({
      kind: 'no_active',
      message: 'You have no active subscription, please activate.',
    });
  });

  it('should return null when active is not nearing end', () => {
    const result = computeRenewal({
      active: {
        end_date: '2026-04-30',
        total_sessions: 12,
        attended_sessions: 5, // remaining = 7 >= 3 and days > 4
      },
      upcomingStartDate: null,
      today,
    });
    expect(result).toBeNull();
  });

  it('should return ends_soon at exactly remaining_sessions = 2', () => {
    const result = computeRenewal({
      active: {
        end_date: '2026-04-30',
        total_sessions: 12,
        attended_sessions: 10, // remaining = 2 < 3
      },
      upcomingStartDate: null,
      today,
    });
    expect(result!.kind).toBe('ends_soon');
  });

  it('should NOT return ends_soon at exactly remaining_sessions = 3', () => {
    const result = computeRenewal({
      active: {
        end_date: '2026-04-30',
        total_sessions: 12,
        attended_sessions: 9, // remaining = 3, not < 3
      },
      upcomingStartDate: null,
      today,
    });
    expect(result).toBeNull();
  });

  it('should return ends_soon at exactly days_until_end = 4', () => {
    const result = computeRenewal({
      active: {
        end_date: '2026-04-11', // diff = 4 <= 4
        total_sessions: 12,
        attended_sessions: 5,
      },
      upcomingStartDate: null,
      today,
    });
    expect(result!.kind).toBe('ends_soon');
  });

  it('should NOT return ends_soon at exactly days_until_end = 5', () => {
    const result = computeRenewal({
      active: {
        end_date: '2026-04-12', // diff = 5, not <= 4
        total_sessions: 12,
        attended_sessions: 5,
      },
      upcomingStartDate: null,
      today,
    });
    expect(result).toBeNull();
  });
});
