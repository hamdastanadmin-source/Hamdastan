/**
 * The sign-in and sign-up rules, written once.
 *
 * The forms in `apps/web` and the route schemas in `apps/api` both parse with
 * these, so a field cannot be accepted by one side and rejected by the other.
 * The Persian messages below are the exact strings the user reads under the
 * field — they are part of the contract, not a placeholder.
 *
 * Every schema normalises before it validates (`.transform` then `.refine`),
 * which is what makes `۰۹۱۲…`, `+98 912…` and `0912…` one value by the time
 * anything downstream sees them.
 */

import { OTP, PROFILE } from '@hamdastan/config';
// Deep imports rather than the barrel: `@hamdastan/shared`'s index also
// exports the HTTP client, which is browser-typed and has no business being
// pulled into the API's TypeScript program by a validation schema.
import {
  isValidJalaliDate,
  jalaliAge,
  jalaliToIsoDate,
} from '@hamdastan/shared/format/jalali';
import {
  normalizeIranMobile,
  normalizePersianText,
  toLatinDigits,
  toPersianDigits,
} from '@hamdastan/shared/format/persian';

import { z } from 'zod';

const PHONE_ERROR = 'شماره موبایل معتبر نیست';

/**
 * Any way a person writes their own number, in — `09xxxxxxxxx` out. Invalid
 * input never reaches the refine as a partial value, because the transform
 * hands on `null` and the refine is what rejects it.
 */
export const phoneSchema = z
  .string({ error: PHONE_ERROR })
  .transform((value) => normalizeIranMobile(value))
  .refine((value): value is string => value !== null, { error: PHONE_ERROR });

/** Persian letters, space and the zero-width non-joiner — nothing else. */
const PERSIAN_NAME_PATTERN = /^[ء-ی‌ ]+$/;

const personNameSchema = (min: number, max: number, message: string) =>
  z
    .string({ error: message })
    .transform((value) => normalizePersianText(value))
    .refine(
      (value) =>
        value.length >= min && value.length <= max && PERSIAN_NAME_PATTERN.test(value),
      { error: message }
    );

export const firstNameSchema = personNameSchema(
  PROFILE.FIRST_NAME_MIN,
  PROFILE.FIRST_NAME_MAX,
  'نام رو به فارسی وارد کن'
);

export const lastNameSchema = personNameSchema(
  PROFILE.LAST_NAME_MIN,
  PROFILE.LAST_NAME_MAX,
  'نام خانوادگی رو به فارسی وارد کن'
);

export const genderSchema = z.enum(['male', 'female'], {
  error: 'یکی از گزینه‌ها رو انتخاب کن',
});

export const otpCodeSchema = z
  .string({ error: 'کد اشتباهه، دوباره امتحان کن' })
  .transform((value) => toLatinDigits(value).replace(/\s/g, ''))
  .refine((value) => new RegExp(`^\\d{${OTP.LENGTH}}$`).test(value), {
    error: 'کد اشتباهه، دوباره امتحان کن',
  });

// ─── Birth date ──────────────────────────────────────────────────────────────

const BIRTH_DATE_ERROR = 'تاریخ تولد رو کامل انتخاب کن';

/**
 * One part of the date, as either side sends it.
 *
 * A `<select>`'s value is a string and JSON may carry a number, so both are
 * accepted and both become a number. Declared as a union rather than with
 * `z.coerce` because coercion types its input as `unknown`, and the form on
 * the other side needs to know that its three fields hold strings.
 */
const datePartSchema = z
  .union([z.string(), z.number()], { error: BIRTH_DATE_ERROR })
  .transform((value) =>
    typeof value === 'number' ? value : Number(toLatinDigits(value.trim()))
  )
  .refine((value) => Number.isInteger(value) && value > 0, {
    error: BIRTH_DATE_ERROR,
  });

/** The three `<Select>`s, as the form holds them: Jalali year, month, day. */
export const jalaliBirthDateSchema = z
  .object({
    year: datePartSchema,
    month: datePartSchema,
    day: datePartSchema,
  })
  .refine((date) => isValidJalaliDate(date), { error: BIRTH_DATE_ERROR })
  .refine(
    (date) => {
      const age = jalaliAge(date);
      return age >= PROFILE.MIN_AGE && age <= PROFILE.MAX_AGE;
    },
    {
      // Persian digits: this string is read by the user, under the field.
      error: `سن باید بین ${toPersianDigits(PROFILE.MIN_AGE)} تا ${toPersianDigits(
        PROFILE.MAX_AGE
      )} سال باشد`,
    }
  );

// ─── Request payloads ────────────────────────────────────────────────────────

export const otpRequestSchema = z.object({ phone: phoneSchema });

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

/**
 * What `PUT /me/basic-info` takes. `birthDate` arrives as Jalali parts and
 * leaves as the `YYYY-MM-DD` Gregorian string a `date` column stores — the
 * calendar the user thinks in never reaches the database, and the calendar
 * the database stores never reaches the form.
 */
export const basicInfoSchema = z.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  birthDate: jalaliBirthDateSchema.transform(jalaliToIsoDate),
  gender: genderSchema,
});

export type OtpRequestInput = z.input<typeof otpRequestSchema>;
export type OtpRequestOutput = z.output<typeof otpRequestSchema>;
export type OtpVerifyInput = z.input<typeof otpVerifySchema>;
export type BasicInfoInput = z.input<typeof basicInfoSchema>;
export type BasicInfoOutput = z.output<typeof basicInfoSchema>;
