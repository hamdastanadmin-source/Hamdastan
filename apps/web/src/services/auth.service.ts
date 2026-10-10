import { API_BASE_URL, API_PREFIX, HTTP_TIMEOUT } from '@hamdastan/config';
import { HttpError } from '@hamdastan/shared';
import type {
  OtpRequestResponse,
  OtpVerifyResponse,
  SessionResponse,
} from '@hamdastan/types';
import type { BasicInfoInput } from '@hamdastan/validation';

import { apiClient } from './api-client';

/**
 * Every route the sign-in flow touches, named once.
 *
 * This is the only file in `apps/web` that knows an auth path exists. A form
 * calls a function here; it does not know the method, the envelope, or that
 * the session arrives as two `httpOnly` cookies the browser stores without
 * being asked.
 *
 * The session cookies are set by `apps/api`, which the browser reaches on the
 * same origin in production (nginx serves both) and as a same-site port in
 * development — so `SameSite=Lax` holds in both, and no token is ever handled
 * by this code.
 */

/**
 * A call made while rendering on the server has no cookie jar of its own; the
 * caller passes the request's own `cookie` header through.
 */
type ServerCall = { cookie?: string };

const withCookie = (options?: ServerCall) =>
  options?.cookie ? { headers: { cookie: options.cookie } } : undefined;

export const authService = {
  requestOtp(phone: string): Promise<OtpRequestResponse> {
    return apiClient.post<OtpRequestResponse>('/auth/otp/request', { phone });
  },

  verifyOtp(phone: string, code: string): Promise<OtpVerifyResponse> {
    return apiClient.post<OtpVerifyResponse>('/auth/otp/verify', { phone, code });
  },

  updateBasicInfo(input: BasicInfoInput): Promise<SessionResponse> {
    return apiClient.put<SessionResponse>('/me/basic-info', input);
  },

  logout(): Promise<{ loggedOut: boolean }> {
    return apiClient.post<{ loggedOut: boolean }>('/auth/logout');
  },

  /** The current session. Throws `HttpError` 401 when there is none. */
  getSession(options?: ServerCall): Promise<SessionResponse> {
    // `no-store`: a session is per-request, and Next would otherwise reuse
    // one visitor's answer for the next.
    return apiClient.get<SessionResponse>('/me', {
      ...withCookie(options),
      cache: 'no-store',
    });
  },
};

/**
 * Rotates the session, and hands back the `Set-Cookie` headers the API
 * answered with.
 *
 * This one bypasses `apiClient` because the client unwraps the JSON envelope
 * and throws the response away — and the response headers are the entire
 * point here. The Next.js middleware copies them onto the redirect or the
 * page it is about to serve, which is how a 15-minute access token is renewed
 * without the visitor noticing.
 *
 * Resolves `null` only when the API says the session is over (401). Any
 * other failure — rate limited, unavailable, timed out — throws, because it
 * says nothing about the session and must not sign the visitor out. It is
 * never retried: a refresh token is single-use.
 */
export async function refreshSession(
  cookie: string
): Promise<{ session: SessionResponse; setCookie: string[] } | null> {
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {
    method: 'POST',
    headers: { cookie, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(HTTP_TIMEOUT.SERVER_MS),
  });

  if (response.status === 401) return null;

  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: SessionResponse }
    | null;
  if (!response.ok || !payload?.ok) {
    throw new HttpError(response.status, {
      code: 'REFRESH_FAILED',
      message: response.statusText || 'Refresh failed',
    });
  }

  return { session: payload.data, setCookie: response.headers.getSetCookie() };
}
