/**
 * The Persian (Jalali) calendar.
 *
 * The product is Persian, so a date a user picks or reads is Jalali; a date the
 * backend stores is an ISO Gregorian `YYYY-MM-DD`, because that is what every
 * database and every other system understands. This module is the only place
 * that translates between the two.
 *
 * The mapping is not computed from an almanac of leap rules — it is asked of
 * the platform's own Persian calendar (`Intl` with `ca-persian`, i.e. ICU), so
 * it cannot drift from the calendar the user's operating system shows them, and
 * there is no arithmetic here to get subtly wrong. Only the month lengths are
 * stated directly, and those are fixed by definition: six months of 31 days,
 * five of 30, and Esfand of 29 or 30.
 *
 * Self-contained by design — see the note in `number.ts`.
 */

export type JalaliDate = { year: number; month: number; day: number };

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

const DAY_MS = 86_400_000;

/** Days in months 1–11. Esfand is the only one that varies. */
const FIXED_MONTH_LENGTHS = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30];

const persianCalendar = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});

/** What the platform's Persian calendar calls this instant. */
function readJalali(utcMs: number): JalaliDate {
  const parts = persianCalendar.formatToParts(new Date(utcMs));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

/**
 * Midnight UTC on Nowruz — 1 Farvardin — of a Jalali year.
 *
 * It falls on 20 or 21 March of `year + 621`, and which one is exactly the
 * thing a leap-year rule would have to predict, so the calendar is asked
 * instead. Everything else in this module is an offset from here.
 */
function nowruzUtcMs(year: number): number {
  for (const marchDay of [20, 21, 19, 22]) {
    const candidate = Date.UTC(year + 621, 2, marchDay);
    const jalali = readJalali(candidate);
    if (jalali.year === year && jalali.month === 1 && jalali.day === 1) {
      return candidate;
    }
  }
  throw new Error(`Nowruz of ${year} is not within 19–22 March ${year + 621}`);
}

/** Whether Esfand has 30 days: the day before the next Nowruz says so. */
export function isJalaliLeapYear(year: number): boolean {
  return readJalali(nowruzUtcMs(year + 1) - DAY_MS).day === 30;
}

export function daysInJalaliMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  if (month <= 11) return FIXED_MONTH_LENGTHS[month - 1];
  return isJalaliLeapYear(year) ? 30 : 29;
}

/** 1-based day of the Jalali year. */
function dayOfYear(year: number, month: number, day: number): number {
  let total = day;
  for (let m = 1; m < month; m += 1) total += daysInJalaliMonth(year, m);
  return total;
}

/** `2026-09-25` → `{ year: 1405, month: 7, day: 3 }`, or null if unparseable. */
export function isoToJalali(iso: string): JalaliDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const utcMs = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(utcMs)) return null;
  return readJalali(utcMs);
}

/**
 * `{ year: 1370, month: 5, day: 20 }` → `1991-08-11`.
 *
 * Returns null for a date the calendar does not have, such as 31 Mehr or
 * 30 Esfand in a common year — the caller is usually three dropdowns, and a
 * null is what tells it the combination is not a real day.
 */
export function jalaliToISO({ year, month, day }: JalaliDate): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInJalaliMonth(year, month)) return null;

  const utcMs = nowruzUtcMs(year) + (dayOfYear(year, month, day) - 1) * DAY_MS;
  return new Date(utcMs).toISOString().slice(0, 10);
}

/** `فروردین` for 1. Empty for a month that does not exist. */
export function jalaliMonthName(month: number): string {
  return JALALI_MONTHS[month - 1] ?? '';
}

/**
 * A stored ISO date as a reader sees it: `۲۰ مرداد ۱۳۷۰`.
 *
 * Every screen that shows a stored date wants exactly this, so it is written
 * once rather than in each table. The digits are converted here rather than
 * through `toPersianDigits` because this module imports nothing — see the note
 * at the top of `number.ts` for why that matters.
 *
 * Returns the input unchanged if it is not a date, so a malformed value shows
 * as itself instead of as `NaN`.
 */
export function formatJalaliDate(iso: string): string {
  const parts = isoToJalali(iso.slice(0, 10));
  if (!parts) return iso;

  const persian = (value: number) =>
    String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

  return `${persian(parts.day)} ${jalaliMonthName(parts.month)} ${persian(parts.year)}`;
}
