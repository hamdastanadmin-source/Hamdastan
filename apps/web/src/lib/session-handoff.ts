import type { SessionResponse } from '@hamdastan/types';

/**
 * How `proxy.ts` hands the session it has just read to the render that
 * follows, so the root layout does not ask `GET /me` a second time for the
 * same request.
 *
 * It travels as a request header that only the proxy sets: the proxy deletes
 * whatever copy the browser sent before it adds its own, on every path it
 * matches — and every page is on one. A header that is missing or does not
 * parse is not an error; `getSession` falls back to asking the API.
 *
 * Headers are ASCII, and a session carries Persian names, so the JSON is
 * percent-encoded.
 */

export const SESSION_HANDOFF_HEADER = 'x-hamdastan-session';

export function encodeSessionHandoff(session: SessionResponse): string {
  return encodeURIComponent(JSON.stringify(session));
}

export function decodeSessionHandoff(value: string | null): SessionResponse | null {
  if (!value) return null;
  try {
    const session = JSON.parse(decodeURIComponent(value)) as SessionResponse;
    return session?.user && session.nextStep ? session : null;
  } catch {
    return null;
  }
}
