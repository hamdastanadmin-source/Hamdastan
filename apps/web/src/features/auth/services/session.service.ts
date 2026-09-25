/**
 * Who is signed in, as the server sees it.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Users, one-time codes and sessions all live in `apps/api` — this module  │
 * │ stores nothing. It reads the session cookie that the backend set and     │
 * │ asks the backend who it belongs to.                                     │
 * │                                                                         │
 * │ Sign-in and sign-out are not here either: the browser calls the backend  │
 * │ directly for those, because the backend is what issues and clears the    │
 * │ cookie. See `auth.api.ts` and `use-auth-flow.ts`.                        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Server-only. It is exported through the feature's `server.ts` and must not
 * be reachable from `index.ts`, or `next/headers` would be pulled into a
 * client bundle.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { SESSION_COOKIE_NAME } from '@hamdastan/config';
import { logger } from '@hamdastan/shared/logger';
import type { AuthUser } from '@hamdastan/types';

import { HttpError } from '@/services';

import { authApi } from './auth.api';

/**
 * The current user, or null.
 *
 * Deduplicated within a single request by React's `cache`, so a layout and the
 * page inside it cost one call to the backend rather than two.
 */
export const getSession = cache(async (): Promise<AuthUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { user } = await authApi.session(token);
    return user;
  } catch (error) {
    // 401 is the ordinary answer for an expired or revoked cookie.
    if (error instanceof HttpError && error.status === 401) return null;

    // Anything else — the backend is down, the network is gone — is not the
    // user's fault, but there is no way to prove a session either. Rendering
    // them as signed out is recoverable; a 500 on every page is not.
    logger.warn({ err: error }, 'could not resolve the session');
    return null;
  }
});

export async function requireAuth(): Promise<AuthUser> {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') {
    redirect('/');
  }
  return user;
}
