import { NextResponse, type NextRequest } from 'next/server';

import { SESSION } from '@hamdastan/config';
import type { NextStep } from '@hamdastan/types';

import { authService, refreshSession } from '@/services';

/**
 * The routing table from the sign-in spec, in one place.
 *
 * ┌──────────────────────────────────┬──────────────────────┐
 * │ not signed in                    │ /welcome             │
 * │ signed in, profile incomplete    │ /auth/basic-info     │
 * │ signed in, onboarding unfinished │ /onboarding/*        │
 * │ signed in, everything done       │ /                    │
 * └──────────────────────────────────┴──────────────────────┘
 *
 * It is Next's proxy (what earlier versions called middleware) rather than a
 * guard on each page for two reasons. It runs
 * before anything renders, so an unfinished account never sees a flash of a
 * page it is about to be redirected off; and the rule exists once, so adding
 * a page cannot forget it.
 *
 * The decision is always the server's. This file reads `nextStep` out of
 * `GET /me` and obeys it — it never infers "the profile looks complete" from
 * the user object, because then the browser would be deciding.
 */

const PATH_FOR: Record<NextStep, string> = {
  basic_info: '/auth/basic-info',
  onboarding: '/onboarding',
  home: '/',
};

/** Reachable with no session. Everything else redirects to `/welcome`. */
const PUBLIC_PATHS = ['/welcome', '/auth/phone', '/auth/verify'];

/** Pages a completed account has no reason to be on. */
const SIGNED_IN_EXITS = new Set([...PUBLIC_PATHS, '/auth/basic-info']);

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/** Copies the API's `Set-Cookie` headers onto the response we are sending. */
function applyCookies(response: NextResponse, setCookie: string[]): NextResponse {
  for (const cookie of setCookie) response.headers.append('set-cookie', cookie);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookie = request.headers.get('cookie') ?? '';
  const hasSessionCookie = Boolean(
    request.cookies.get(SESSION.REFRESH_COOKIE) ?? request.cookies.get(SESSION.ACCESS_COOKIE)
  );

  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));

  if (!hasSessionCookie) {
    return isPublic(pathname) ? NextResponse.next() : redirectTo('/welcome');
  }

  // A session cookie is present, so ask the API what it is worth. The access
  // token lives fifteen minutes and the refresh token thirty days, so most
  // visits after the first go through the refresh branch below.
  let nextStep: NextStep | null = null;
  let setCookie: string[] = [];

  try {
    nextStep = (await authService.getSession({ cookie })).nextStep;
  } catch {
    const refreshed = await refreshSession(cookie);
    if (refreshed) {
      nextStep = refreshed.session.nextStep;
      setCookie = refreshed.setCookie;
    }
  }

  if (!nextStep) {
    // The session is gone for good. Clearing the cookies here stops every
    // later navigation paying for the same two failed calls.
    const response = isPublic(pathname) ? NextResponse.next() : redirectTo('/welcome');
    response.cookies.delete(SESSION.ACCESS_COOKIE);
    response.cookies.delete(SESSION.REFRESH_COOKIE);
    return response;
  }

  const target = PATH_FOR[nextStep];

  // An unfinished account is pinned to its step: it may be on that step's
  // page, or on a page beneath it — onboarding is several screens under
  // `/onboarding` — and nowhere else until the step is done.
  const onStep = pathname === target || pathname.startsWith(`${target}/`);
  if (nextStep !== 'home' && !onStep) {
    return applyCookies(redirectTo(target), setCookie);
  }

  // A finished one is free to go anywhere except back through the door.
  if (nextStep === 'home' && SIGNED_IN_EXITS.has(pathname)) {
    return applyCookies(redirectTo('/'), setCookie);
  }

  return applyCookies(NextResponse.next(), setCookie);
}

export const config = {
  /**
   * Everything the visitor navigates to, and nothing they merely download:
   * a session check on a font or an icon is latency spent on no decision.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|images/|fonts/|api/).*)'],
};
