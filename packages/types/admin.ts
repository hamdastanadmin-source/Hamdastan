/**
 * The admin panel's wire contract.
 *
 * An admin user is not a product user: they are rows in `v2_admin_users`,
 * created only from the panel itself, and signing in to the product never
 * makes one.
 */

export type AdminUserStatus = 'active' | 'inactive';

export type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  /** Normalised to `09xxxxxxxxx`. */
  phone: string;
  status: AdminUserStatus;
  /** ISO timestamp; null until the first sign-in. */
  lastLoginAt: string | null;
  createdAt: string;
};

/** `GET /admin/me`, and the body of a successful admin verify. */
export type AdminSessionResponse = {
  admin: AdminUser;
};

/** The stable `code` values the admin panel switches on. */
export const ADMIN_ERROR_CODES = {
  /** The code was right, but the number is not an active admin. */
  ADMIN_ACCESS_DENIED: 'ADMIN_ACCESS_DENIED',
  ADMIN_PHONE_TAKEN: 'ADMIN_PHONE_TAKEN',
  ADMIN_SELF_DEACTIVATION: 'ADMIN_SELF_DEACTIVATION',
  ADMIN_SELF_DELETION: 'ADMIN_SELF_DELETION',
} as const;
