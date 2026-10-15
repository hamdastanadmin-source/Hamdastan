/**
 * The media & motion library's rules, written once: the upload, the motion
 * setting every motion picker in the builder produces, and the shapes the
 * API parses them with. Whether a file is what it claims is decided by the
 * API from its bytes (`media.sniff.ts`), not here.
 */

import {
  BUILTIN_MOTION_EFFECTS,
  MEDIA_CATEGORIES,
  MEDIA_LIMITS,
  MOTION_DURATION as D,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { MotionSetting } from '@hamdastan/types';

import { z } from 'zod';

const fa = (n: number) => toPersianDigits(n);

/** Base64 of at most MAX_BYTES once decoded: four characters carry three bytes. */
const base64File = z
  .string({ error: 'فایل رو انتخاب کن' })
  .min(1, { error: 'فایل رو انتخاب کن' })
  .max(Math.ceil(MEDIA_LIMITS.MAX_BYTES / 3) * 4 + 4, {
    error: `حجم فایل باید حداکثر ${fa(MEDIA_LIMITS.MAX_BYTES / 1024)} کیلوبایت باشه`,
  })
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, { error: 'فایل معتبر نیست' });

const name = z
  .string()
  .transform((value) => value.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim())
  .refine((value) => value.length > 0, { error: 'یک نام برای فایل بنویس' })
  .refine((value) => value.length <= MEDIA_LIMITS.NAME_MAX, { error: `حداکثر ${fa(MEDIA_LIMITS.NAME_MAX)} کاراکتر` });

const category = z.enum(MEDIA_CATEGORIES, { error: 'دسته رو انتخاب کن' });

/** `POST /admin/media`. */
export const mediaUploadSchema = z.object({ name, category, data: base64File });

/** `PATCH /admin/media/:id`. */
export const mediaUpdateSchema = z
  .object({ name: name.optional(), category: category.optional() })
  .refine((input) => input.name !== undefined || input.category !== undefined, { error: 'چیزی برای تغییر نیست' });

/** `PUT /admin/media/:id/file`. */
export const mediaReplaceSchema = z.object({ data: base64File });

export const mediaListQuerySchema = z.object({
  category: category.optional(),
  kind: z.enum(['image', 'motion']).optional(),
  search: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(MEDIA_LIMITS.PAGE_SIZE),
});

/** A library id inside a definition: the API checks it exists. */
export const mediaIdSchema = z.uuid({ error: 'فایل انتخاب‌شده معتبر نیست' });

const motionCommon = {
  durationMs: z
    .number()
    .int()
    .min(D.MIN_MS, { error: `حداقل ${fa(D.MIN_MS / 1000)} ثانیه` })
    .max(D.MAX_MS, { error: `حداکثر ${fa(D.MAX_MS / 1000)} ثانیه` }),
  caption: z
    .string()
    .transform((value) => value.replace(/\s+/g, ' ').trim())
    .refine((value) => value.length <= D.CAPTION_MAX, { error: `حداکثر ${fa(D.CAPTION_MAX)} کاراکتر` }),
  sound: z.boolean(),
};

/** One motion setting, in any of its five modes. */
export const motionSettingSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('off'), ...motionCommon }),
  z.object({ mode: z.enum(['mascot', 'custom']), assetId: mediaIdSchema, ...motionCommon }),
  z.object({ mode: z.literal('builtin'), effect: z.enum(BUILTIN_MOTION_EFFECTS), ...motionCommon }),
  z.object({
    mode: z.literal('random'),
    assetIds: z
      .array(mediaIdSchema)
      .min(2, { error: 'حداقل دو فایل برای انتخاب تصادفی لازمه' })
      .max(D.RANDOM_MAX, { error: `حداکثر ${fa(D.RANDOM_MAX)} فایل` })
      .transform((ids) => [...new Set(ids)]),
    ...motionCommon,
  }),
]);

/** A motion that is off — what an unset place starts as. */
export const motionOff = (durationMs: number = D.ANSWER_MS): MotionSetting => ({
  mode: 'off',
  durationMs,
  caption: '',
  sound: false,
});

/** Every library id a motion refers to. */
export function motionAssetIds(motion: MotionSetting | undefined | null): string[] {
  if (!motion) return [];
  if (motion.mode === 'mascot' || motion.mode === 'custom') return [motion.assetId];
  if (motion.mode === 'random') return motion.assetIds;
  return [];
}

export type MediaUploadOutput = z.output<typeof mediaUploadSchema>;
export type MediaListQueryOutput = z.output<typeof mediaListQuerySchema>;
