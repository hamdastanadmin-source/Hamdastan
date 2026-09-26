/**
 * Validation primitives shared by the front-end forms and the backend
 * `*.schema.ts` files, so a field is validated the same way on both sides.
 */

import { z } from 'zod';

export const idSchema = z.string().min(1, 'شناسه الزامی است');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQueryInput = z.input<typeof paginationQuerySchema>;
export type PaginationQueryOutput = z.output<typeof paginationQuerySchema>;

export const sortDirectionSchema = z.enum(['asc', 'desc']).default('asc');

/** Persian and Arabic-Indic digit forms to ASCII, so ۰۹۱۲ and 0912 are one number. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/**
 * A person's name, as every form in the product collects it.
 *
 * Shared by the product's registration form and the admin panel's create-user
 * form so the two cannot disagree about what a name is. `label` is what the
 * message names, which is why it is a factory rather than a constant.
 */
export const personNameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} باید حداقل ۲ نویسه باشد`)
    .max(50, `${label} طولانی‌تر از حد مجاز است`);
