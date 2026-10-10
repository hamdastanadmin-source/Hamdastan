/**
 * The admin panel's rules, written once — the user form in `apps/admin` and
 * the `admin` module in `apps/api` both parse with these.
 *
 * Names and the phone number reuse the product's own field schemas, so an
 * admin's name is held to the same Persian-letters rule and their number is
 * normalised to the same `09xxxxxxxxx` the OTP flow looks it up by.
 */

import { ADMIN_USERS_PAGE_SIZE } from '@hamdastan/config';
import { ADMIN_ROLES } from '@hamdastan/types';
import { normalizePersianText } from '@hamdastan/shared/format/persian';

import { z } from 'zod';

import { firstNameSchema, lastNameSchema, phoneSchema } from './auth';

export const adminUserStatusSchema = z.enum(['active', 'inactive'], {
  error: 'وضعیت رو انتخاب کن',
});

export const adminRoleSchema = z.enum(ADMIN_ROLES, { error: 'نقش رو انتخاب کن' });

const adminUserFields = {
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  phone: phoneSchema,
  status: adminUserStatusSchema,
  role: adminRoleSchema,
};

/**
 * `POST /admin/users`. A new admin is active unless the form says otherwise;
 * the role has no default — what someone may do is chosen, never assumed.
 */
export const adminUserCreateSchema = z.object({
  ...adminUserFields,
  status: adminUserStatusSchema.default('active'),
});

/** `PATCH /admin/users/:id`. Any subset; the status switch sends only `status`. */
export const adminUserUpdateSchema = z
  .object(adminUserFields)
  .partial()
  .refine((fields) => Object.values(fields).some((value) => value !== undefined), {
    error: 'چیزی برای ذخیره نیست',
  });

/**
 * `GET /admin/users`. The search matches a name or a phone number, so it is
 * normalised the way both are stored: Persian letters, Latin digits.
 */
export const adminUsersQuerySchema = z.object({
  search: z
    .string()
    .max(50)
    .transform((value) => normalizePersianText(value))
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(ADMIN_USERS_PAGE_SIZE),
});

export type AdminUserCreateInput = z.input<typeof adminUserCreateSchema>;
export type AdminUserCreateOutput = z.output<typeof adminUserCreateSchema>;
export type AdminUserUpdateInput = z.input<typeof adminUserUpdateSchema>;
export type AdminUserUpdateOutput = z.output<typeof adminUserUpdateSchema>;
export type AdminUsersQueryInput = z.input<typeof adminUsersQuerySchema>;
export type AdminUsersQueryOutput = z.output<typeof adminUsersQuerySchema>;

/** The session manager's search: one product account, by its number. */
export const appUserLookupSchema = z.object({ phone: phoneSchema });
export type AppUserLookupInput = z.infer<typeof appUserLookupSchema>;
