/**
 * The account area's rules: the profile fields, the avatar and the settings.
 *
 * The edit sheets in `apps/web` and `PATCH /me/profile` parse with the same
 * objects, Persian messages included. Every schema normalises before it
 * validates, as in `auth.ts`.
 */

import {
  ACCOUNT_LIMITS,
  AVATAR_CATALOG,
  AVATAR_SLOTS,
  type AvatarSlot,
} from '@hamdastan/config';
import {
  normalizePersianText,
  toLatinDigits,
  toPersianDigits,
} from '@hamdastan/shared/format/persian';

import { z } from 'zod';

/** Letters of any script, space and the zero-width non-joiner. */
const NAME_PATTERN = /^[\p{L}‌ ]+$/u;

const lettersSchema = (min: number, max: number, message: string) =>
  z
    .string({ error: message })
    .transform((value) => normalizePersianText(value))
    .refine((value) => value.length >= min && value.length <= max && NAME_PATTERN.test(value), {
      error: message,
    });

export const displayNameSchema = lettersSchema(
  ACCOUNT_LIMITS.DISPLAY_NAME_MIN,
  ACCOUNT_LIMITS.DISPLAY_NAME_MAX,
  `نام باید بین ${toPersianDigits(ACCOUNT_LIMITS.DISPLAY_NAME_MIN)} تا ${toPersianDigits(ACCOUNT_LIMITS.DISPLAY_NAME_MAX)} حرف باشه`
);

const USERNAME_MESSAGE =
  'فقط حروف انگلیسی، عدد، نقطه و _ — با یه حرف شروع بشه و بین ۳ تا ۲۰ کاراکتر باشه';

/** Stored lower-case, so `Omid` and `omid` are one name. A leading `@` is dropped. */
export const usernameSchema = z
  .string({ error: USERNAME_MESSAGE })
  .transform((value) => toLatinDigits(value).trim().replace(/^@/, '').toLowerCase())
  .refine(
    (value) =>
      new RegExp(
        `^[a-z][a-z0-9_.]{${ACCOUNT_LIMITS.USERNAME_MIN - 1},${ACCOUNT_LIMITS.USERNAME_MAX - 1}}$`
      ).test(value),
    { error: USERNAME_MESSAGE }
  );

/** An empty city clears it. */
export const citySchema = z.union([
  z.literal('').transform(() => null),
  lettersSchema(ACCOUNT_LIMITS.CITY_MIN, ACCOUNT_LIMITS.CITY_MAX, 'اسم شهر رو درست وارد کن'),
]);

/** Optional; an empty bio clears it. */
export const bioSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length <= ACCOUNT_LIMITS.BIO_MAX, {
    error: `بیو حداکثر ${toPersianDigits(ACCOUNT_LIMITS.BIO_MAX)} کاراکتر می‌تونه باشه`,
  })
  .transform((value) => value || null);

/**
 * A social handle, stored without `@` and in lower case. A pasted profile
 * link is accepted too: only its last path segment is kept, so
 * `https://instagram.com/neg.sal/` becomes `neg.sal`. An empty value clears it.
 */
const handleSchema = (pattern: RegExp, message: string) =>
  z.union([
    z.literal('').transform(() => null),
    z
      .string({ error: message })
      .transform((value) =>
        toLatinDigits(value)
          .trim()
          .replace(/[?#].*$/, '')
          .replace(/\/+$/, '')
          .split('/')
          .pop()!
          .replace(/^@/, '')
          .toLowerCase()
      )
      .refine((value) => pattern.test(value), { error: message }),
  ]);

export const instagramSchema = handleSchema(
  new RegExp(`^[a-z0-9._]{1,${ACCOUNT_LIMITS.INSTAGRAM_MAX}}$`),
  'آیدی اینستاگرام فقط حروف انگلیسی، عدد، نقطه و _ داره'
);

export const telegramSchema = handleSchema(
  new RegExp(`^[a-z][a-z0-9_]{${ACCOUNT_LIMITS.TELEGRAM_MIN - 1},${ACCOUNT_LIMITS.TELEGRAM_MAX - 1}}$`),
  `آیدی تلگرام با حرف انگلیسی شروع می‌شه و بین ${toPersianDigits(ACCOUNT_LIMITS.TELEGRAM_MIN)} تا ${toPersianDigits(ACCOUNT_LIMITS.TELEGRAM_MAX)} کاراکتره`
);

export const linkedinSchema = handleSchema(
  new RegExp(`^[a-z0-9-]{${ACCOUNT_LIMITS.LINKEDIN_MIN},${ACCOUNT_LIMITS.LINKEDIN_MAX}}$`),
  'آیدی لینکدین فقط حروف انگلیسی، عدد و - داره'
);

/** One or more fields; a field that is absent is left as it is. */
export const profileUpdateSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    username: usernameSchema.optional(),
    city: citySchema.optional(),
    bio: bioSchema.optional(),
    instagram: instagramSchema.optional(),
    telegram: telegramSchema.optional(),
    linkedin: linkedinSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: 'چیزی برای ذخیره نیست',
  });

export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;
export type ProfileUpdateOutput = z.output<typeof profileUpdateSchema>;

/** Every slot, each an id from that slot's catalog. Unlocks are checked by the API, which knows the level. */
export const avatarSchema = z.object(
  Object.fromEntries(
    AVATAR_SLOTS.map((slot) => [
      slot,
      z.enum(AVATAR_CATALOG[slot].map(({ id }) => id) as [string, ...string[]], {
        error: 'یکی از گزینه‌ها رو انتخاب کن',
      }),
    ])
  ) as Record<AvatarSlot, z.ZodEnum<Record<string, string>>>
);

export type AvatarInput = z.output<typeof avatarSchema>;

export const settingsSchema = z.object({
  notifications: z.boolean(),
  showSocialProfile: z.boolean(),
});

export type SettingsInput = z.output<typeof settingsSchema>;
