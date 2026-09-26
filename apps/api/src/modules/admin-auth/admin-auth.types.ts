/**
 * Types internal to the admin-auth module.
 *
 * The admin account itself belongs to `admin-users`, which owns that record and
 * the store it lives in; this module authenticates it. What is declared here is
 * the part only a sign-in needs: the session row and what a successful login
 * hands back.
 *
 * Anything the panel also has to agree on is in `@hamdastan/types`.
 */

import type { AdminPermission, AdminPrincipal } from '@hamdastan/types';

export type AdminSessionRecord = {
  /**
   * SHA-256 of the opaque token. The token itself is never stored, so a leaked
   * session table cannot be replayed as a cookie.
   */
  tokenHash: string;
  adminUserId: string;
  createdAt: Date;
  /**
   * The account's `credentialsVersion` when the session was issued. A session
   * whose version no longer matches the account's is refused, which is what
   * makes a password reset sign every device out without a session sweep.
   */
  credentialsVersion: number;
  expiresAt: Date;
};

/** What the service hands back once a password has been verified. */
export type IssuedAdminSession = {
  admin: AdminPrincipal;
  /** Opaque, 256 bits of randomness. Travels in an httpOnly cookie. */
  token: string;
  expiresAt: Date;
};

/** What a guarded route asks for before it will run. */
export type AdminAuthorization = {
  /** The permission the route needs, or none for a route any admin may call. */
  permission?: AdminPermission;
  /**
   * Whether an admin who still owes a password change may pass.
   *
   * False everywhere but the change-password endpoint and the session lookup:
   * an account on a temporary password can do exactly two things, choose a new
   * password and be told that it has to.
   */
  allowPasswordChangePending?: boolean;
};
