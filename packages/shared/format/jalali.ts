/**
 * Jalali (Solar Hijri) ↔ Gregorian conversion.
 *
 * The product asks for a birth date the way an Iranian user knows it — a
 * Jalali year, month and day — and stores it the way PostgreSQL understands
 * one, as a Gregorian `date`. Both sides of that translation happen here, so
 * the browser's three `<Select>`s and the backend's validator agree to the
 * day.
 *
 * The arithmetic is the standard Birashk/Khayyam leap-year algorithm with the
 * observational correction table (`BREAKS`), which is exact for Jalali years
 * -61…3177 — every birth date the product will ever see.
 *
 * No dependency: a date library would bring a locale system, a parser and a
 * formatter for four functions this file already has.
 */

export type JalaliDate = { year: number; month: number; day: number };
export type GregorianDate = { year: number; month: number; day: number };

/** ۱ = فروردین. Index 0 is unused so a month number indexes directly. */
export const JALALI_MONTHS = [
  '',
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

/**
 * Integer division that truncates toward zero, and the remainder that goes
 * with it — not `Math.floor`.
 *
 * The algorithm below relies on it: `div(month - 8, 6)` for March is
 * `div(-5, 6)`, which must be 0 and which `Math.floor` would make -1, moving
 * every converted date a year.
 */
const div = (a: number, b: number): number => Math.trunc(a / b);
const mod = (a: number, b: number): number => a - Math.trunc(a / b) * b;

/** Years at which the 33-year leap cycle is interrupted. */
const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192,
  2262, 2324, 2394, 2456, 3178,
];

type JalaliYearInfo = {
  /** 0 when the year is a leap year. */
  leap: number;
  /** The Gregorian year the Jalali year begins in. */
  gy: number;
  /** The day of March on which 1 Farvardin falls. */
  march: number;
};

function jalaliYearInfo(jy: number): JalaliYearInfo {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];

  if (jy < jp || jy >= BREAKS[BREAKS.length - 1]) {
    throw new RangeError(`Jalali year ${jy} is outside the supported range.`);
  }

  let jump = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

export function isLeapJalaliYear(year: number): boolean {
  return jalaliYearInfo(year).leap === 0;
}

/** 31, 30, or — for اسفند — 29 or 30 depending on the year. */
export function jalaliMonthLength(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isLeapJalaliYear(year) ? 30 : 29;
}

/** Julian Day Number for a Gregorian date. */
function gregorianToJdn(gy: number, gm: number, gd: number): number {
  let jdn =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  jdn = jdn - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return jdn;
}

function jdnToGregorian(jdn: number): GregorianDate {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const day = div(mod(i, 153), 5) + 1;
  const month = mod(div(i, 153), 12) + 1;
  const year = div(j, 1461) - 100100 + div(8 - month, 6);
  return { year, month, day };
}

export function jalaliToGregorian(date: JalaliDate): GregorianDate {
  const { gy, march } = jalaliYearInfo(date.year);
  const jdn =
    gregorianToJdn(gy, 3, march) +
    (date.month - 1) * 31 -
    div(date.month, 7) * (date.month - 7) +
    date.day -
    1;
  return jdnToGregorian(jdn);
}

export function gregorianToJalali(date: GregorianDate): JalaliDate {
  const jdn = gregorianToJdn(date.year, date.month, date.day);
  let jy = date.year - 621;
  const { leap, march } = jalaliYearInfo(jy);
  const farvardin1 = gregorianToJdn(date.year, 3, march);
  let k = jdn - farvardin1;

  if (k >= 0) {
    if (k <= 185) {
      return { year: jy, month: 1 + div(k, 31), day: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    // Before 1 Farvardin: the date belongs to the previous Jalali year.
    jy -= 1;
    k += 179;
    if (leap === 1) k += 1;
  }

  return { year: jy, month: 7 + div(k, 30), day: mod(k, 30) + 1 };
}

/** Whether the three parts name a day that exists. */
export function isValidJalaliDate({ year, month, day }: JalaliDate): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return day <= jalaliMonthLength(year, month);
}

/** `YYYY-MM-DD` in the Gregorian calendar — the form a `date` column takes. */
export function jalaliToIsoDate(date: JalaliDate): string {
  const { year, month, day } = jalaliToGregorian(date);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Today, as a Jalali date in Asia/Tehran. */
export function todayJalali(now: Date = new Date()): JalaliDate {
  // `en-CA` formats as YYYY-MM-DD, which parses without a locale guess.
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .split('-')
    .map(Number);
  return gregorianToJalali({ year, month, day });
}

/** Whole years between a Jalali birth date and a Jalali reference date. */
export function jalaliAge(birth: JalaliDate, on: JalaliDate = todayJalali()): number {
  let age = on.year - birth.year;
  if (on.month < birth.month || (on.month === birth.month && on.day < birth.day)) {
    age -= 1;
  }
  return age;
}
