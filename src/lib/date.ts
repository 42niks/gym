const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getIstDate(now?: Date): string {
  const d = now ?? new Date();
  const istTime = new Date(d.getTime() + IST_OFFSET_MS);
  return istTime.toISOString().slice(0, 10);
}

export function parseYmd(value: string): { year: number; month: number; day: number } {
  const [y, m, d] = value.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function isValidYmdDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= maxDay;
}

export function addMonthsClamped(ymd: string, months: number): string {
  const { year, month, day } = parseYmd(ymd);
  let targetMonth = month + months;
  let targetYear = year;
  while (targetMonth > 12) {
    targetMonth -= 12;
    targetYear++;
  }
  // Clamp day to the last valid day of the target month
  const maxDay = new Date(targetYear, targetMonth, 0).getDate();
  const clampedDay = Math.min(day, maxDay);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function addDays(ymd: string, days: number): string {
  const { year, month, day } = parseYmd(ymd);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  const dateA = new Date(a + 'T00:00:00Z');
  const dateB = new Date(b + 'T00:00:00Z');
  return Math.round((dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24));
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatHumanDate(ymd: string): string {
  const { year, month, day } = parseYmd(ymd);
  return `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
}
