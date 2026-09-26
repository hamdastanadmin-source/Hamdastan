/**
 * Types internal to the admin-user modules — the shapes that get stored.
 *
 * The record below is the one this module owns and `admin-auth` reads: a single
 * account, seen once as something to manage and once as something to
 * authenticate. Anything the front-end also has to agree on is in
 * `@hamdastan/types` instead, so both sides compile against one definition.
 *
 * What stays here is everything a client must never see: the password hash,
 * failed-attempt counters and the lock that follows them.
 */

import type { AdminAccountStatus, AdminRoleCode } from '@hamdastan/types';

export type AdminUserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  /** As the creating admin typed it. Shown in the panel. */
  username: string;
  /**
   * Lower-cased `username`. **Unique.** Everything looks an account up by this,
   * so `Admin` and `admin` cannot become two accounts.
   */
  usernameKey: string;
  /** Normalised to `09xxxxxxxxx`. Where credentials are sent. */
  mobile: string;
  /** From `shared/password.ts`. A plain password is never stored. */
  passwordHash: string;
  /** True while the account is on a password it did not choose. */
  mustChangePassword: boolean;
  /**
   * When the generated password stops working, or null once the admin has
   * chosen one of their own. An expired temporary password needs a reset — it
   * is never re-sent.
   */
  temporaryPasswordExpiresAt: Date | null;
  status: AdminAccountStatus;
  /** References the catalogue in `@hamdastan/shared/rbac` by code, not by id. */
  roleCode: AdminRoleCode;
  /** ISO calendar date, `YYYY-MM-DD`. Access lasts to the end of this day. */
  accessExpiresAt: string;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  /**
   * Bumped every time this account's password is written, by anybody.
   *
   * It is what invalidates sessions without a session sweep: a session carries
   * the version it was issued under, and `admin-auth` refuses one that no
   * longer matches. So resetting an admin's temporary password signs out
   * whatever devices were holding a session, while the admin changing their own
   * password gets a session stamped with the new version in the same request
   * and is not thrown out of the panel by their own change.
   *
   * A counter rather than a timestamp on purpose: two writes inside one
   * millisecond are indistinguishable by clock, and "the session issued a
   * moment before the reset" is exactly the case that must not survive.
   */
  credentialsVersion: number;
  /** Consecutive wrong passwords. Reset by a successful sign-in. */
  failedLoginAttempts: number;
  /** Set once the attempts run out; sign-in is refused until it passes. */
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewAdminUserRecord = Omit<
  AdminUserRecord,
  | 'id'
  | 'lastLoginAt'
  | 'passwordChangedAt'
  | 'credentialsVersion'
  | 'failedLoginAttempts'
  | 'lockedUntil'
  | 'createdAt'
  | 'updatedAt'
>;

/** What an edit may change. The username is fixed at creation — see the schema. */
export type AdminUserUpdate = Partial<
  Pick<
    AdminUserRecord,
    'firstName' | 'lastName' | 'mobile' | 'roleCode' | 'accessExpiresAt' | 'status'
  >
>;

/**
 * What replacing an account's password writes, whoever asked for it.
 *
 * `credentialsVersion` is absent because the repository owns it: the write
 * increments it, which a data layer can do atomically and a caller reading it
 * first could not.
 */
export type AdminPasswordUpdate = {
  passwordHash: string;
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt: Date | null;
  /** Null while the account is still on a password somebody else generated. */
  passwordChangedAt: Date | null;
};

export type AdminUserListFilter = {
  /** Matches name, username or mobile. Already trimmed. */
  search?: string;
  page: number;
  pageSize: number;
};

export type AdminUserPage = {
  items: AdminUserRecord[];
  total: number;
};
