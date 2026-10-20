/**
 * Validation primitives shared by the front-end forms and the backend
 * `*.schema.ts` files, so a field is validated the same way on both sides.
 */

import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { z } from 'zod';

const fa = (n: number) => toPersianDigits(n);

export const idSchema = z.string().min(1, 'شناسه لازمه');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQueryInput = z.input<typeof paginationQuerySchema>;
export type PaginationQueryOutput = z.output<typeof paginationQuerySchema>;

export const sortDirectionSchema = z.enum(['asc', 'desc']).default('asc');

// ─── Text ────────────────────────────────────────────────────────────────────

/**
 * Free text as an admin types it: Arabic ي/ك become Persian, and the ends
 * are trimmed. Digits are left as typed — this is copy, not a value to
 * compare. A single line also has its runs of whitespace collapsed.
 */
export function cleanText(value: string, multiline: boolean): string {
  const letters = value.replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  return (multiline ? letters.replace(/\r\n/g, '\n') : letters.replace(/\s+/g, ' ')).trim();
}

export const line = (max: number, required: string | null) =>
  z
    .string()
    .transform((value) => cleanText(value, false))
    .refine((value) => (required ? value.length > 0 : true), { error: required ?? '' })
    .refine((value) => value.length <= max, { error: `حداکثر ${fa(max)} کاراکتر` });

export const paragraph = (max: number) =>
  z
    .string()
    .transform((value) => cleanText(value, true))
    .refine((value) => value.length <= max, { error: `حداکثر ${fa(max)} کاراکتر` });

// ─── Identifiers ─────────────────────────────────────────────────────────────

export const uuidSchema = z.uuid({ error: 'شناسه معتبر نیست' });

/** A de-duplicated list of ids, at most `max` of them. */
export const uniqueIdsSchema = (max: number, label: string) =>
  z
    .array(uuidSchema)
    .max(max, { error: `حداکثر ${fa(max)} ${label}` })
    .transform((ids) => [...new Set(ids)]);

/** Lower-case Latin letters, digits and single hyphens: it is part of a URL. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A slug as an admin types it. Empty is allowed here; a schema that needs one says so. */
export const slugSchema = (max: number, reserved: readonly string[] = []) =>
  z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .refine((value) => value === '' || SLUG_PATTERN.test(value), { error: 'فقط حروف کوچک انگلیسی، عدد و خط تیره' })
    .refine((value) => value.length <= max, { error: `حداکثر ${fa(max)} کاراکتر` })
    .refine((value) => !reserved.includes(value), { error: 'این نامک رزرو شده است؛ نامک دیگری انتخاب کنید' });
