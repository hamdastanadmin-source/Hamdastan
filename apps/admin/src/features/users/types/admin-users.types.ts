/**
 * Types private to «مدیریت کاربران» in this app.
 *
 * The wire contract lives in `@hamdastan/types` — what is here is the shape of
 * the screen: what the create and edit forms hold while they are being filled
 * in, and where a backend message belongs.
 */

import type { AdminAccountStatus, AdminRoleCode } from '@hamdastan/types';

/**
 * The create form's fields, before they are valid.
 *
 * Everything is a string because that is what an input holds: the schema in
 * `@hamdastan/validation` is what turns them into the request, and it is the
 * same schema the backend parses with.
 */
export type CreateUserFormValues = {
  firstName: string;
  lastName: string;
  username: string;
  mobile: string;
  /** Empty until a role is picked — the schema is what rejects that. */
  roleCode: AdminRoleCode | '';
  /** ISO `YYYY-MM-DD`, or empty while the date is incomplete. */
  accessExpiresAt: string;
};

export type EditUserFormValues = {
  firstName: string;
  lastName: string;
  mobile: string;
  roleCode: AdminRoleCode;
  accessExpiresAt: string;
  status: AdminAccountStatus;
};

/** A message, and the field it belongs under. `form` means above the form. */
export type UserFormError = {
  message: string;
  field: keyof CreateUserFormValues | 'form';
};
