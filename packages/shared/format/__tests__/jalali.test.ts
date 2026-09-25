import { describe, expect, it } from 'vitest';

import {
  daysInJalaliMonth,
  isJalaliLeapYear,
  isoToJalali,
  jalaliMonthName,
  jalaliToISO,
} from '../jalali';

/**
 * A wrong calendar conversion is the kind of bug that shows up as one user's
 * birthday being a day out, years later, so this covers the awkward cases
 * rather than a couple of happy ones: the year boundary, both lengths of
 * Esfand, and a full round trip over a century.
 */

/** Independently known pairs, none of them near a boundary by accident. */
const KNOWN: ReadonlyArray<[string, [number, number, number]]> = [
  ['1991-08-11', [1370, 5, 20]],
  ['2024-03-20', [1403, 1, 1]], // Nowruz
  ['2021-03-20', [1399, 12, 30]], // last day of a leap year
  ['2020-03-19', [1398, 12, 29]], // last day of a common year
  ['2026-09-25', [1405, 7, 3]],
  ['1906-03-21', [1284, 12, 30]],
];

describe('isoToJalali', () => {
  it.each(KNOWN)('reads %s as the right Jalali date', (iso, [year, month, day]) => {
    expect(isoToJalali(iso)).toEqual({ year, month, day });
  });

  it('returns null for anything that is not an ISO date', () => {
    for (const bad of ['', '2024-3-1', '20240320', '۱۴۰۳-۰۱-۰۱', 'yesterday']) {
      expect(isoToJalali(bad), bad).toBeNull();
    }
  });
});

describe('jalaliToISO', () => {
  it.each(KNOWN)('writes %s back from the Jalali date', (iso, [year, month, day]) => {
    expect(jalaliToISO({ year, month, day })).toBe(iso);
  });

  it('refuses a day the calendar does not have', () => {
    // Mehr has 30 days, and Esfand has 30 only in a leap year.
    expect(jalaliToISO({ year: 1403, month: 7, day: 31 })).toBeNull();
    expect(jalaliToISO({ year: 1398, month: 12, day: 30 })).toBeNull();
    expect(jalaliToISO({ year: 1399, month: 12, day: 30 })).toBe('2021-03-20');
  });

  it('refuses a month that does not exist, and a non-integer', () => {
    expect(jalaliToISO({ year: 1403, month: 0, day: 1 })).toBeNull();
    expect(jalaliToISO({ year: 1403, month: 13, day: 1 })).toBeNull();
    expect(jalaliToISO({ year: 1403, month: 1, day: 1.5 })).toBeNull();
  });

  it('round-trips every day of a century', () => {
    for (let year = 1320; year <= 1420; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        for (let day = 1; day <= daysInJalaliMonth(year, month); day += 1) {
          const iso = jalaliToISO({ year, month, day });
          expect(iso, `${year}/${month}/${day}`).not.toBeNull();
          expect(isoToJalali(iso as string), iso as string).toEqual({ year, month, day });
        }
      }
    }
  });

  it('puts consecutive days on consecutive dates across a year boundary', () => {
    // 29 Esfand 1398 → 1 Farvardin 1399: a common year has no 30 Esfand.
    expect(jalaliToISO({ year: 1398, month: 12, day: 29 })).toBe('2020-03-19');
    expect(jalaliToISO({ year: 1399, month: 1, day: 1 })).toBe('2020-03-20');
  });
});

describe('the earliest selectable birth year', () => {
  it('matches the ISO bound `@hamdastan/validation` states', () => {
    // BIRTH_DATE_MIN_ISO is written out there rather than converted, because
    // that package depends on nothing but zod. This is what keeps the two
    // spellings of 1 Farvardin 1320 from drifting apart.
    expect(jalaliToISO({ year: 1320, month: 1, day: 1 })).toBe('1941-03-21');
  });
});

describe('month lengths', () => {
  it('gives the first six months 31 days and the next five 30', () => {
    for (let month = 1; month <= 6; month += 1) {
      expect(daysInJalaliMonth(1403, month)).toBe(31);
    }
    for (let month = 7; month <= 11; month += 1) {
      expect(daysInJalaliMonth(1403, month)).toBe(30);
    }
  });

  it('gives Esfand 30 days only in a leap year', () => {
    expect(daysInJalaliMonth(1399, 12)).toBe(30);
    expect(daysInJalaliMonth(1398, 12)).toBe(29);
  });

  it('agrees with the leap years of the current cycle', () => {
    // 1399, 1403, 1408 are leap; the years between them are not.
    expect(isJalaliLeapYear(1399)).toBe(true);
    expect(isJalaliLeapYear(1403)).toBe(true);
    expect(isJalaliLeapYear(1400)).toBe(false);
    expect(isJalaliLeapYear(1401)).toBe(false);
    expect(isJalaliLeapYear(1402)).toBe(false);
  });

  it('has no month outside 1–12', () => {
    expect(daysInJalaliMonth(1403, 0)).toBe(0);
    expect(daysInJalaliMonth(1403, 13)).toBe(0);
  });
});

describe('jalaliMonthName', () => {
  it('names the months in Persian', () => {
    expect(jalaliMonthName(1)).toBe('فروردین');
    expect(jalaliMonthName(12)).toBe('اسفند');
  });

  it('is empty rather than undefined for a month that does not exist', () => {
    expect(jalaliMonthName(0)).toBe('');
    expect(jalaliMonthName(13)).toBe('');
  });
});
