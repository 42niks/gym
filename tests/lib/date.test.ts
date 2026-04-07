import { describe, it, expect } from 'vitest';
import { getIstDate, parseYmd, addMonthsClamped, addDays, diffDays, formatHumanDate } from '../../src/lib/date.js';

describe('date helpers', () => {
  describe('getIstDate', () => {
    it('should return YYYY-MM-DD string', () => {
      const result = getIstDate();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should accept a Date object and convert to IST', () => {
      // 2026-04-07 23:00 UTC = 2026-04-08 04:30 IST
      const utcDate = new Date('2026-04-07T23:00:00Z');
      expect(getIstDate(utcDate)).toBe('2026-04-08');
    });

    it('should handle midnight boundary in IST', () => {
      // 2026-04-07 18:29 UTC = 2026-04-07 23:59 IST
      const utcDate = new Date('2026-04-07T18:29:00Z');
      expect(getIstDate(utcDate)).toBe('2026-04-07');
    });
  });

  describe('parseYmd', () => {
    it('should parse a valid date', () => {
      expect(parseYmd('2026-04-07')).toEqual({ year: 2026, month: 4, day: 7 });
    });

    it('should parse January 1', () => {
      expect(parseYmd('2026-01-01')).toEqual({ year: 2026, month: 1, day: 1 });
    });

    it('should parse December 31', () => {
      expect(parseYmd('2026-12-31')).toEqual({ year: 2026, month: 12, day: 31 });
    });
  });

  describe('addMonthsClamped', () => {
    it('should add 1 month to a normal date', () => {
      expect(addMonthsClamped('2026-04-07', 1)).toBe('2026-05-07');
    });

    it('should clamp Jan 31 + 1 month to Feb 28 (non-leap)', () => {
      expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    });

    it('should clamp Jan 31 + 1 month to Feb 29 (leap year)', () => {
      expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
    });

    it('should add 3 months', () => {
      expect(addMonthsClamped('2026-04-07', 3)).toBe('2026-07-07');
    });

    it('should roll over year boundary', () => {
      expect(addMonthsClamped('2026-11-15', 3)).toBe('2027-02-15');
    });

    it('should clamp March 31 + 1 month to April 30', () => {
      expect(addMonthsClamped('2026-03-31', 1)).toBe('2026-04-30');
    });

    it('should add 12 months (1 year)', () => {
      expect(addMonthsClamped('2026-04-07', 12)).toBe('2027-04-07');
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      expect(addDays('2026-04-07', 5)).toBe('2026-04-12');
    });

    it('should subtract days with negative value', () => {
      expect(addDays('2026-04-07', -1)).toBe('2026-04-06');
    });

    it('should handle month boundary', () => {
      expect(addDays('2026-04-30', 1)).toBe('2026-05-01');
    });

    it('should handle year boundary', () => {
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    });
  });

  describe('diffDays', () => {
    it('should return 0 for same date', () => {
      expect(diffDays('2026-04-07', '2026-04-07')).toBe(0);
    });

    it('should return positive when a > b', () => {
      expect(diffDays('2026-04-10', '2026-04-07')).toBe(3);
    });

    it('should return negative when a < b', () => {
      expect(diffDays('2026-04-07', '2026-04-10')).toBe(-3);
    });

    it('should work across month boundaries', () => {
      expect(diffDays('2026-05-01', '2026-04-28')).toBe(3);
    });
  });

  describe('formatHumanDate', () => {
    it('should format as "7 Apr 2026"', () => {
      expect(formatHumanDate('2026-04-07')).toBe('7 Apr 2026');
    });

    it('should format "10 May 2026"', () => {
      expect(formatHumanDate('2026-05-10')).toBe('10 May 2026');
    });

    it('should format "1 Jan 2027"', () => {
      expect(formatHumanDate('2027-01-01')).toBe('1 Jan 2027');
    });
  });
});
