/**
 * The rules the login flow is judged by, on both sides.
 *
 * `apps/web` parses with these to show a field error before a request is
 * made; `apps/api` parses with the same schemas in its auth controller and is
 * the only authority — a client that skips the check gets the same answer.
 */

import { z } from 'zod';

/** Iranian mobile numbers, once normalised. */
export const IRAN_MOBILE_PATTERN = /^09\d{9}$/;

/** Digits in a normalised number — `09` plus nine. What the input caps at. */
export const PHONE_NUMBER_LENGTH = 11;

/**
 * Digits in a one-time code.
 *
 * The backend generates to this length and the boxes on the verify screen are
 * built from it, so it is the only place the number is decided. Shortening it
 * shrinks the search space, which is why the attempt and resend limits in
 * `apps/api` are what make it safe rather than its length — see
 * docs/architecture/auth-flow.md.
 *
 * The message below names it in Persian; change both together.
 */
export const OTP_CODE_LENGTH = 4;

const OTP_CODE_PATTERN = new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`);

/** Persian and Arabic-Indic digit forms to ASCII, so ۰۹۱۲ and 0912 are one number. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/**
 * One phone number has many spellings — `+98 912 …`, `0098912…`, `۰۹۱۲…`,
 * with spaces or dashes. They all mean the same user, so they all have to
 * reduce to one string before anything is looked up or stored.
 */
export function normalizePhone(raw: string): string {
  const digits = toLatinDigits(raw)
    .trim()
    .replace(/^\+/, '00')
    .replace(/[\s()‌-]/g, '');

  if (digits.startsWith('0098')) return `0${digits.slice(4)}`;
  if (digits.startsWith('98') && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith('9') && digits.length === 10) return `0${digits}`;
  return digits;
}

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((value) => IRAN_MOBILE_PATTERN.test(value), {
    message: 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد',
  });

export const otpCodeSchema = z
  .string()
  .transform((value) => toLatinDigits(value).trim())
  .refine((value) => OTP_CODE_PATTERN.test(value), {
    message: 'کد تأیید باید ۴ رقم باشد',
  });

export const genderSchema = z.enum(['MALE', 'FEMALE'], {
  message: 'جنسیت را انتخاب کنید',
});

const nameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} باید حداقل ۲ نویسه باشد`)
    .max(50, `${label} طولانی‌تر از حد مجاز است`);

/**
 * The earliest birth year the product offers, as a Jalali year.
 *
 * The year dropdown runs from here to the current Jalali year, so this is what
 * decides the length of that list. There is no minimum age: the upper end is
 * simply "this year", and a date in the future is rejected below.
 */
export const BIRTH_YEAR_MIN_JALALI = 1320;

/**
 * The same bound as an ISO Gregorian date: 1 Farvardin 1320.
 *
 * Stated rather than converted, because `@hamdastan/validation` deliberately
 * depends on nothing but zod. It is a fixed historical day, so it cannot go
 * stale — and `packages/shared/format/jalali.test.ts` asserts the pair, so the
 * two spellings cannot drift apart unnoticed.
 */
export const BIRTH_DATE_MIN_ISO = '1941-03-21';

export const birthDateSchema = z
  .string()
  .transform((value) => toLatinDigits(value).trim())
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: 'تاریخ تولد را کامل وارد کنید',
  })
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return false;
      // Rejects 2026-02-31, which Date would roll forward into March.
      return date.toISOString().slice(0, 10) === value;
    },
    { message: 'تاریخ تولد معتبر نیست' }
  )
  .refine((value) => value >= BIRTH_DATE_MIN_ISO, {
    message: 'سال تولد خارج از محدودهٔ مجاز است',
  })
  // A birth date in the future is the one thing no calendar can excuse. ISO
  // dates compare correctly as strings, so this needs no parsing.
  .refine((value) => value <= new Date().toISOString().slice(0, 10), {
    message: 'تاریخ تولد نمی‌تواند در آینده باشد',
  });

/** The profile a new user fills in. Held as a draft until the code is verified. */
export const registrationSchema = z.object({
  firstName: nameSchema('نام'),
  lastName: nameSchema('نام خانوادگی'),
  birthDate: birthDateSchema,
  gender: genderSchema,
});

// ─── Request bodies ──────────────────────────────────────────────────────────

export const checkPhoneSchema = z.object({ phone: phoneSchema });

export const sendOtpSchema = z.object({ phone: phoneSchema });

export const cancelOtpSchema = z.object({ phone: phoneSchema });

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

export const registerSchema = registrationSchema.extend({ phone: phoneSchema });

/**
 * The parsed registration body, as the service receives it.
 *
 * The other schemas need no alias — their output is a phone number or a phone
 * number and a code, and the handlers destructure them at the call site.
 */
export type RegisterInput = z.output<typeof registerSchema>;
