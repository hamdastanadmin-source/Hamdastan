import { NextResponse, type NextRequest } from 'next/server';

import { SESSION } from '@hamdastan/config';
import type { NextStep, SessionResponse } from '@hamdastan/types';

import { SESSION_HANDOFF_HEADER, encodeSessionHandoff } from '@/lib';
import { HttpError, authService, refreshSession } from '@/services';

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

/**
 * The one onboarding page a finished account may still open: the
 * questionnaire can be put off, and home and the profile offer it as a
 * mission until it is done.
 */
const DEFERRABLE_ONBOARDING = '/onboarding/questionnaire';

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/** Copies the API's `Set-Cookie` headers onto the response we are sending. */
function applyCookies(response: NextResponse, setCookie: string[]): NextResponse {
  for (const cookie of setCookie) response.headers.append('set-cookie', cookie);
  return response;
}

/**
 * The request headers the page renders with.
 *
 * Any handoff the browser sent is dropped: only this function may set it.
 * With a session, it is handed on (see `@/lib/session-handoff`). After a
 * refresh, the rotated cookies replace the spent ones in the `cookie` header
 * too — otherwise the render would call the API with the access token that
 * just expired, while the browser is being given the new one.
 */
function forwardedHeaders(
  request: NextRequest,
  session: SessionResponse | null = null,
  setCookie: string[] = []
): Headers {
  const headers = new Headers(request.headers);
  headers.delete(SESSION_HANDOFF_HEADER);
  if (session) headers.set(SESSION_HANDOFF_HEADER, encodeSessionHandoff(session));

  if (setCookie.length > 0) {
    const jar = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]));
    for (const cookie of setCookie) {
      const [pair] = cookie.split(';');
      const separator = pair.indexOf('=');
      if (separator > 0) jar.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
    }
    headers.set('cookie', [...jar].map(([name, value]) => `${name}=${value}`).join('; '));
  }

  return headers;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookie = request.headers.get('cookie') ?? '';
  const hasSessionCookie = Boolean(
    request.cookies.get(SESSION.REFRESH_COOKIE) ?? request.cookies.get(SESSION.ACCESS_COOKIE)
  );

  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));
  /** On to the page, with no session handed on. */
  const proceed = () => NextResponse.next({ request: { headers: forwardedHeaders(request) } });

  if (!hasSessionCookie) {
    return isPublic(pathname) ? proceed() : redirectTo('/welcome');
  }

  // A session cookie is present, so ask the API what it is worth. The access
  // token lives fifteen minutes and the refresh token thirty days, so most
  // visits after the first go through the refresh branch below.
  let session: SessionResponse | null = null;
  let setCookie: string[] = [];

  try {
    session = await authService.getSession({ cookie });
  } catch (error) {
    // The API did not answer at all — down, restarting, unreachable. That
    // says nothing about the session, so decide nothing: keep the cookies
    // and let the page render what it can. Treating it as an expired session
    // would sign every visitor out each time the API restarts.
    if (!(error instanceof HttpError)) return proceed();
    // Only a 401 means the access token is spent. A 429 or a 503 is the API
    // being busy, and refreshing then would burn a single-use token for
    // nothing — so, again, decide nothing.
    if (error.status !== 401) return proceed();

    const refreshed = await refreshSession(cookie).catch(() => undefined);
    if (refreshed === undefined) return proceed();
    if (refreshed) {
      session = refreshed.session;
      setCookie = refreshed.setCookie;
    }
  }

  if (!session) {
    // The session is gone for good. Clearing the cookies here stops every
    // later navigation paying for the same two failed calls.
    const response = isPublic(pathname) ? proceed() : redirectTo('/welcome');
    response.cookies.delete(SESSION.ACCESS_COOKIE);
    response.cookies.delete(SESSION.REFRESH_COOKIE);
    return response;
  }

  const { nextStep } = session;
  const target = PATH_FOR[nextStep];

  // An unfinished account is pinned to its step: it may be on that step's
  // page, or on a page beneath it — onboarding is several screens under
  // `/onboarding` — and nowhere else until the step is done.
  const onStep = pathname === target || pathname.startsWith(`${target}/`);
  if (nextStep !== 'home' && !onStep) {
    return applyCookies(redirectTo(target), setCookie);
  }

  // A finished one is free to go anywhere except back through the door —
  // or back into onboarding, which it has already been through, bar the
  // questionnaire it may have put off.
  const inOnboarding =
    (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) &&
    pathname !== DEFERRABLE_ONBOARDING;
  if (nextStep === 'home' && (SIGNED_IN_EXITS.has(pathname) || inOnboarding)) {
    return applyCookies(redirectTo('/'), setCookie);
  }

  return applyCookies(
    NextResponse.next({ request: { headers: forwardedHeaders(request, session, setCookie) } }),
    setCookie
  );
}

export const config = {
  /**
   * Everything the visitor navigates to, and nothing they merely download:
   * a session check on a font or an icon is latency spent on no decision.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|images/|fonts/|api/).*)'],
};
