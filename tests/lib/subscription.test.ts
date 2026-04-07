import { describe, it, expect } from 'vitest';
import { computeEndDate, deriveLifecycleState, checkOverlap } from '../../src/lib/subscription.js';

describe('subscription helpers', () => {
  describe('computeEndDate', () => {
    it('should compute end date: 2026-04-07 + 1 month = 2026-05-06', () => {
      expect(computeEndDate('2026-04-07', 1)).toBe('2026-05-06');
    });

    it('should clamp and subtract: 2026-01-31 + 1 month = 2026-02-27', () => {
      expect(computeEndDate('2026-01-31', 1)).toBe('2026-02-27');
    });

    it('should handle leap year: 2028-01-31 + 1 month = 2028-02-28', () => {
      expect(computeEndDate('2028-01-31', 1)).toBe('2028-02-28');
    });

    it('should compute 3 months: 2026-04-07 + 3 = 2026-07-06', () => {
      expect(computeEndDate('2026-04-07', 3)).toBe('2026-07-06');
    });

    it('should compute 5 months: 2026-01-15 + 5 = 2026-06-14', () => {
      expect(computeEndDate('2026-01-15', 5)).toBe('2026-06-14');
    });
  });

  describe('deriveLifecycleState', () => {
    const today = '2026-04-07';

    it('should be "completed" when owner_completed is true', () => {
      expect(deriveLifecycleState({
        start_date: '2026-04-01',
        end_date: '2026-04-30',
        total_sessions: 12,
        attended_sessions: 4,
        owner_completed: 1,
      }, today)).toBe('completed');
    });

    it('should be "completed" when past end_date', () => {
      expect(deriveLifecycleState({
        start_date: '2026-03-01',
        end_date: '2026-04-06',
        total_sessions: 12,
        attended_sessions: 4,
        owner_completed: 0,
      }, today)).toBe('completed');
    });

    it('should be "completed" when remaining_sessions is 0', () => {
      expect(deriveLifecycleState({
        start_date: '2026-04-01',
        end_date: '2026-04-30',
        total_sessions: 12,
        attended_sessions: 12,
        owner_completed: 0,
      }, today)).toBe('completed');
    });

    it('should be "upcoming" when start_date is in the future', () => {
      expect(deriveLifecycleState({
        start_date: '2026-04-10',
        end_date: '2026-05-09',
        total_sessions: 12,
        attended_sessions: 0,
        owner_completed: 0,
      }, today)).toBe('upcoming');
    });

    it('should be "active" when in date range with sessions remaining', () => {
      expect(deriveLifecycleState({
        start_date: '2026-04-01',
        end_date: '2026-04-30',
        total_sessions: 12,
        attended_sessions: 4,
        owner_completed: 0,
      }, today)).toBe('active');
    });

    it('should be "active" on start_date', () => {
      expect(deriveLifecycleState({
        start_date: '2026-04-07',
        end_date: '2026-05-06',
        total_sessions: 12,
        attended_sessions: 0,
        owner_completed: 0,
      }, today)).toBe('active');
    });

    it('should be "active" on end_date', () => {
      expect(deriveLifecycleState({
        start_date: '2026-04-01',
        end_date: '2026-04-07',
        total_sessions: 12,
        attended_sessions: 4,
        owner_completed: 0,
      }, today)).toBe('active');
    });
  });

  describe('checkOverlap', () => {
    it('should detect overlap when ranges intersect', () => {
      expect(checkOverlap(
        { start_date: '2026-04-01', end_date: '2026-04-30' },
        { start_date: '2026-04-15', end_date: '2026-05-15' }
      )).toBe(true);
    });

    it('should detect overlap when boundary touches (inclusive)', () => {
      expect(checkOverlap(
        { start_date: '2026-04-01', end_date: '2026-05-09' },
        { start_date: '2026-05-09', end_date: '2026-06-08' }
      )).toBe(true);
    });

    it('should NOT overlap when new starts after existing ends', () => {
      expect(checkOverlap(
        { start_date: '2026-04-01', end_date: '2026-05-09' },
        { start_date: '2026-05-10', end_date: '2026-06-09' }
      )).toBe(false);
    });

    it('should NOT overlap when new ends before existing starts', () => {
      expect(checkOverlap(
        { start_date: '2026-06-01', end_date: '2026-06-30' },
        { start_date: '2026-04-01', end_date: '2026-05-31' }
      )).toBe(false);
    });

    it('should detect overlap when one contains the other', () => {
      expect(checkOverlap(
        { start_date: '2026-04-01', end_date: '2026-06-30' },
        { start_date: '2026-04-15', end_date: '2026-05-15' }
      )).toBe(true);
    });
  });
});
