import { describe, expect, it } from 'vitest';

import {
  gregorianToJalali,
  isValidJalaliDate,
  jalaliMonthLength,
  jalaliToIsoDate,
  todayJalali,
} from '@hamdastan/shared/format/jalali';
import {
  normalizeIranMobile,
  normalizePersianText,
  toLatinDigits,
} from '@hamdastan/shared/format/persian';
import { basicInfoSchema, otpVerifySchema, phoneSchema } from '@hamdastan/validation';

/**
 * The sign-in rules, tested where they are defined.
 *
 * These schemas are the one place the browser and `apps/api` agree on what a
 * valid phone number, name or birth date is, so a failure here is a failure
 * on both sides at once — which is exactly why they are worth a test and the
 * screens that use them are not.
 */

describe('phone numbers', () => {
  it.each([
    ['09123456789', '09123456789'],
    ['9123456789', '09123456789'],
    ['+989123456789', '09123456789'],
    ['00989123456789', '09123456789'],
    ['0912 345 6789', '09123456789'],
    ['0912-345-6789', '09123456789'],
    ['۰۹۱۲۳۴۵۶۷۸۹', '09123456789'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalizeIranMobile(input)).toBe(expected);
    expect(phoneSchema.parse(input)).toBe(expected);
  });

  it.each([
    ['08123456789', 'a landline prefix'],
    ['0912345678', 'one digit short'],
    ['091234567890', 'one digit long'],
    ['', 'empty'],
    ['not a number', 'letters'],
  ])('rejects %s (%s)', (input) => {
    expect(normalizeIranMobile(input)).toBeNull();
    expect(phoneSchema.safeParse(input).success).toBe(false);
  });

  it('gives the spec’s message, because the form shows it verbatim', () => {
    const result = phoneSchema.safeParse('123');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('شماره موبایل معتبر نیست');
    }
  });
});

describe('Persian text', () => {
  it('folds Arabic ي and ك onto their Persian forms', () => {
    expect(normalizePersianText('يكتا')).toBe('یکتا');
  });

  it('keeps the zero-width non-joiner, which is a spelling rule', () => {
    expect(normalizePersianText('نام‌خانوادگی')).toBe('نام‌خانوادگی');
  });

  it('trims and collapses whitespace', () => {
    expect(normalizePersianText('  علی   رضا  ')).toBe('علی رضا');
  });

  it('rewrites Persian and Arabic-Indic digits as 0-9', () => {
    expect(toLatinDigits('۱۲۳٤٥٦')).toBe('123456');
  });
});

describe('the Jalali calendar', () => {
  it.each([
    [{ year: 1403, month: 1, day: 1 }, '2024-03-20'],
    [{ year: 1399, month: 12, day: 30 }, '2021-03-20'],
    [{ year: 1380, month: 7, day: 15 }, '2001-10-07'],
  ])('converts %o to %s', (jalali, iso) => {
    expect(jalaliToIsoDate(jalali)).toBe(iso);
  });

  it('round-trips back to the same Jalali date', () => {
    const jalali = { year: 1372, month: 5, day: 23 };
    const [year, month, day] = jalaliToIsoDate(jalali).split('-').map(Number);
    expect(gregorianToJalali({ year, month, day })).toEqual(jalali);
  });

  it('gives Esfand 30 days in a leap year and 29 otherwise', () => {
    // 1399 and 1403 are leap; 1400–1402 are not.
    expect(jalaliMonthLength(1399, 12)).toBe(30);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1400, 12)).toBe(29);
  });

  it('refuses a day the month does not have', () => {
    expect(isValidJalaliDate({ year: 1400, month: 12, day: 30 })).toBe(false);
    expect(isValidJalaliDate({ year: 1403, month: 12, day: 30 })).toBe(true);
    expect(isValidJalaliDate({ year: 1403, month: 7, day: 31 })).toBe(false);
    expect(isValidJalaliDate({ year: 1403, month: 1, day: 31 })).toBe(true);
  });
});

describe('the basic-info form', () => {
  const currentYear = todayJalali().year;

  const valid = {
    firstName: 'علی',
    lastName: 'رضایی',
    birthDate: { year: String(currentYear - 20), month: '5', day: '23' },
    gender: 'male' as const,
  };

  it('accepts a complete form and hands back a Gregorian date', () => {
    const result = basicInfoSchema.parse(valid);
    expect(result.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.firstName).toBe('علی');
  });

  it('accepts `other` as a gender', () => {
    expect(basicInfoSchema.safeParse({ ...valid, gender: 'other' }).success).toBe(true);
  });

  it('rejects a Latin name', () => {
    const result = basicInfoSchema.safeParse({ ...valid, firstName: 'Ali' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('نام رو به فارسی وارد کن');
    }
  });

  it.each([
    [12, 'under thirteen'],
    [81, 'over eighty'],
  ])('rejects an age of %i (%s)', (age) => {
    const result = basicInfoSchema.safeParse({
      ...valid,
      birthDate: { year: String(currentYear - age), month: '5', day: '23' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an impossible date', () => {
    const result = basicInfoSchema.safeParse({
      ...valid,
      birthDate: { year: String(currentYear - 20), month: '7', day: '31' },
    });
    expect(result.success).toBe(false);
  });
});

describe('the one-time code', () => {
  const phone = '09123456789';

  it('accepts six digits, in either script', () => {
    expect(otpVerifySchema.parse({ phone, code: '123456' }).code).toBe('123456');
    expect(otpVerifySchema.parse({ phone, code: '۱۲۳۴۵۶' }).code).toBe('123456');
  });

  it.each(['12345', '1234567', 'abcdef', ''])('rejects %s', (code) => {
    expect(otpVerifySchema.safeParse({ phone, code }).success).toBe(false);
  });
});
