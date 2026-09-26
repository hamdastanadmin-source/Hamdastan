/**
 * The rules the admin panel is judged by, on both sides.
 *
 * `apps/admin` parses with these so a field error appears before a request is
 * made; `apps/api` parses with the same schemas in its admin controllers and is
 * the only authority — a client that skips the check gets the same answer.
 *
 * Nothing here is shared with the product's own sign-in: admins use a username
 * and a password, product users use a mobile number and a one-time code. The
 * two flows only share the phone-number normalisation, because a phone number
 * means the same thing in both.
 */

import { ADMIN_ROLE_CODES } from '@hamdastan/shared/rbac';
import { z } from 'zod';

import { personNameSchema, toLatinDigits } from './common';
import { phoneSchema } from './auth';

/**
 * Digits in a generated temporary password.
 *
 * The backend generates to this length and nothing else may: a temporary
 * password is short because it is read off an SMS and used once, and it is the
 * forced change plus the expiry that make it safe, not its length.
 */
export const TEMPORARY_PASSWORD_LENGTH = 6;

/** Characters an admin's final password must be at least this long. */
export const ADMIN_PASSWORD_MIN_LENGTH = 8;

// ─── Username ────────────────────────────────────────────────────────────────

/**
 * Usernames are compared case-insensitively, so `Admin` and `admin` are one
 * account. This is the form everything looks up by; what the admin typed is
 * kept for display.
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export const adminUsernameSchema = z
  .string()
  .trim()
  .min(3, 'نام کاربری باید حداقل ۳ نویسه باشد')
  .max(32, 'نام کاربری طولانی‌تر از حد مجاز است')
  .refine((value) => /^[A-Za-z0-9._-]+$/.test(value), {
    message: 'نام کاربری فقط می‌تواند شامل حرف انگلیسی، رقم، نقطه، خط تیره و زیرخط باشد',
  });

// ─── Password policy ─────────────────────────────────────────────────────────

/**
 * The policy for a password an admin chooses for themselves.
 *
 * Every rule gets its own `refine` so the form can show exactly which one is
 * unmet rather than one sentence listing all five. The order matches the order
 * the checklist is rendered in.
 *
 * Deliberately **not** applied to the password field on the login form: a
 * temporary password does not satisfy this policy, and rejecting it there would
 * lock out every new admin before they could reach the change-password screen.
 */
export const adminPasswordSchema = z
  .string()
  .min(ADMIN_PASSWORD_MIN_LENGTH, 'رمز عبور باید حداقل ۸ نویسه باشد')
  .max(72, 'رمز عبور طولانی‌تر از حد مجاز است')
  .refine((value) => /[A-Z]/.test(value), {
    message: 'رمز عبور باید حداقل یک حرف بزرگ انگلیسی داشته باشد',
  })
  .refine((value) => /[a-z]/.test(value), {
    message: 'رمز عبور باید حداقل یک حرف کوچک انگلیسی داشته باشد',
  })
  .refine((value) => /\d/.test(value), {
    message: 'رمز عبور باید حداقل یک رقم داشته باشد',
  })
  .refine((value) => /[^A-Za-z0-9]/.test(value), {
    message: 'رمز عبور باید حداقل یک نویسهٔ ویژه داشته باشد',
  });

/**
 * The five rules, for the checklist under the password field.
 *
 * The same predicates the schema refines on, so the ticks a user watches and
 * the answer the backend gives cannot disagree.
 */
export const ADMIN_PASSWORD_RULES = [
  { id: 'length', label: 'حداقل ۸ نویسه', test: (v: string) => v.length >= ADMIN_PASSWORD_MIN_LENGTH },
  { id: 'uppercase', label: 'یک حرف بزرگ انگلیسی', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lowercase', label: 'یک حرف کوچک انگلیسی', test: (v: string) => /[a-z]/.test(v) },
  { id: 'digit', label: 'یک رقم', test: (v: string) => /\d/.test(v) },
  { id: 'special', label: 'یک نویسهٔ ویژه', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

// ─── Access expiration ───────────────────────────────────────────────────────

/**
 * When an admin's access runs out, as an ISO Gregorian date.
 *
 * The UI collects it in the Jalali calendar and converts; what crosses the wire
 * is always `YYYY-MM-DD`. Access lasts to the end of the named day, and the
 * backend is the clock that decides — this schema only refuses a date that was
 * already in the past when it was submitted.
 */
export const accessExpiresAtSchema = z
  .string()
  .transform((value) => toLatinDigits(value).trim())
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: 'تاریخ اعتبار دسترسی را کامل وارد کنید',
  })
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return false;
      // Rejects 1404-12-31 style overflow, which Date would roll forward.
      return date.toISOString().slice(0, 10) === value;
    },
    { message: 'تاریخ اعتبار دسترسی معتبر نیست' }
  )
  // ISO dates compare correctly as strings, so this needs no parsing.
  .refine((value) => value >= new Date().toISOString().slice(0, 10), {
    message: 'تاریخ اعتبار دسترسی نمی‌تواند در گذشته باشد',
  });

export const adminRoleCodeSchema = z.enum(ADMIN_ROLE_CODES, {
  message: 'نقش را انتخاب کنید',
});

export const adminAccountStatusSchema = z.enum(['ACTIVE', 'SUSPENDED'], {
  message: 'وضعیت را انتخاب کنید',
});

// ─── Request bodies ──────────────────────────────────────────────────────────

/**
 * Sign-in. The username is only required to be present: judging it against
 * `adminUsernameSchema` here would tell an attacker which spellings exist, and
 * an account whose username predates the rule could no longer sign in.
 */
export const adminLoginSchema = z.object({
  username: z.string().trim().min(1, 'نام کاربری الزامی است'),
  password: z.string().min(1, 'رمز عبور الزامی است'),
});

export const adminChangePasswordSchema = z
  .object({
    newPassword: adminPasswordSchema,
    confirmPassword: z.string().min(1, 'تکرار رمز عبور الزامی است'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'تکرار رمز عبور با رمز عبور یکسان نیست',
    path: ['confirmPassword'],
  });

export const createAdminUserSchema = z.object({
  firstName: personNameSchema('نام'),
  lastName: personNameSchema('نام خانوادگی'),
  username: adminUsernameSchema,
  mobile: phoneSchema,
  roleCode: adminRoleCodeSchema,
  accessExpiresAt: accessExpiresAtSchema,
});

/**
 * Editing an account. Every field is optional — the dialog sends what changed —
 * but an empty body is a mistake rather than a no-op, so it is refused.
 *
 * The username is absent on purpose: it is what credentials were sent against
 * and what the audit trail will read by, so it is fixed at creation.
 */
export const updateAdminUserSchema = z
  .object({
    firstName: personNameSchema('نام').optional(),
    lastName: personNameSchema('نام خانوادگی').optional(),
    mobile: phoneSchema.optional(),
    roleCode: adminRoleCodeSchema.optional(),
    accessExpiresAt: accessExpiresAtSchema.optional(),
    status: adminAccountStatusSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'موردی برای تغییر ارسال نشده است',
  });

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminLoginInput = z.output<typeof adminLoginSchema>;
export type AdminChangePasswordInput = z.output<typeof adminChangePasswordSchema>;
export type CreateAdminUserInput = z.output<typeof createAdminUserSchema>;
export type UpdateAdminUserInput = z.output<typeof updateAdminUserSchema>;
export type AdminUsersQueryInput = z.output<typeof adminUsersQuerySchema>;
