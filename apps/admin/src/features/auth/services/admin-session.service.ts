/**
 * Who is signed in to the panel, as the server sees it.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Admin accounts, passwords and sessions all live in `apps/api` — this     │
 * │ module stores nothing and decides nothing. It reads the session cookie   │
 * │ the backend set and asks the backend who it belongs to and what they may │
 * │ do.                                                                     │
 * │                                                                         │
 * │ The guards below redirect; they do not authorise. A page that renders    │
 * │ because `requirePermission` let it through still gets its data from a    │
 * │ backend route that checks the same permission again — see               │
 * │ `apps/api/src/middleware/admin-guard.ts`.                               │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Server-only. It is exported through the feature's `server.ts` and must not be
 * reachable from `index.ts`, or `next/headers` would be pulled into a client
 * bundle.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { ADMIN_SESSION_COOKIE_NAME } from '@hamdastan/config';
import { logger } from '@hamdastan/shared/logger';
import { hasAdminPermission } from '@hamdastan/shared/rbac';
import type { AdminPermission, AdminPrincipal } from '@hamdastan/types';

import { HttpError } from '@/services';

import { adminAuthApi } from './admin-auth.api';

/**
 * The current admin, or null.
 *
 * Deduplicated within a single request by React's `cache`, so a layout and the
 * page inside it cost one call to the backend rather than two.
 */
export const getAdminSession = cache(async (): Promise<AdminPrincipal | null> => {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { admin } = await adminAuthApi.session(token);
    return admin;
  } catch (error) {
    // 401 is the ordinary answer for an expired or revoked cookie; 403 is a
    // suspended account or one whose access has run out. Both mean the same
    // thing to the panel: this browser has no usable session.
    if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
      return null;
    }

    // Anything else — the backend is down, the network is gone — is not the
    // admin's fault, but there is no way to prove a session either. Rendering
    // them as signed out is recoverable; a 500 on every page is not.
    logger.warn({ err: error }, 'could not resolve the admin session');
    return null;
  }
});

/**
 * The signed-in admin, past the forced password change.
 *
 * Every page inside the dashboard goes through this, so an account still on a
 * temporary password can only ever land on `/change-password`.
 */
export async function requireAdmin(): Promise<AdminPrincipal> {
  const admin = await getAdminSession();
  if (!admin) redirect('/login');
  if (admin.mustChangePassword) redirect('/change-password');
  return admin;
}

/** The admin, if their role carries `permission`. Otherwise back to the dashboard. */
export async function requirePermission(
  permission: AdminPermission
): Promise<AdminPrincipal> {
  const admin = await requireAdmin();
  if (!hasAdminPermission(admin.permissions, permission)) redirect('/');
  return admin;
}

/**
 * The admin on the change-password screen.
 *
 * The mirror of `requireAdmin`: it is the one page that wants an account which
 * still owes a change, and it sends anybody who does not owe one back to the
 * dashboard so the screen cannot be used as a way to change a password on a
 * whim.
 */
export async function requirePasswordChange(): Promise<AdminPrincipal> {
  const admin = await getAdminSession();
  if (!admin) redirect('/login');
  if (!admin.mustChangePassword) redirect('/');
  return admin;
}
