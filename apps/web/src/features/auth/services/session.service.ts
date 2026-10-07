import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import type { SessionResponse } from '@hamdastan/types';

import { SESSION_HANDOFF_HEADER, decodeSessionHandoff } from '@/lib';
import { authService } from '@/services';

/**
 * The session, read on the server.
 *
 * There is no session store in this app any more. `apps/api` owns users,
 * tokens and the decision about where someone goes next; this file forwards
 * the request's own cookies to `GET /me` and returns what comes back.
 *
 * It is a read, never a write: rotating an expired access token is the job of
 * `src/proxy.ts`, which runs before this and is the only place in a Next
 * app that can set a cookie on the way to a page. By the time a server
 * component calls `getSession`, the cookies are already fresh — or the
 * visitor has already been redirected and this never runs.
 */

/**
 * Deduplicated within a single request by React's `cache()`.
 *
 * `proxy.ts` has already read the session for this request and hands it on
 * in a header (`@/lib/session-handoff`), so a page normally renders without
 * a second `GET /me`. Asking the API is the fallback for a request the proxy
 * did not hand one to.
 */
export const getSession = cache(async (): Promise<SessionResponse | null> => {
  const handedOn = decodeSessionHandoff((await headers()).get(SESSION_HANDOFF_HEADER));
  if (handedOn) return handedOn;

  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  if (!cookie) return null;

  try {
    return await authService.getSession({ cookie });
  } catch {
    // 401, or the API being down. Either way there is no session to render
    // with, and the middleware has already decided where the visitor goes.
    return null;
  }
});

/**
 * For a page that cannot render without a user. The redirect is a backstop:
 * the middleware should have caught this first, and a hit here means a route
 * escaped its matcher.
 */
export async function requireSession(): Promise<SessionResponse> {
  const session = await getSession();
  if (!session) redirect('/welcome');
  return session;
}

export async function requireAdmin(): Promise<SessionResponse> {
  const session = await requireSession();
  if (session.user.role !== 'ADMIN') redirect('/');
  return session;
}
