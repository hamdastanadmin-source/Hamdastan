/**
 * The login flow's calls to `apps/api`.
 *
 * This is the only file in the feature that names a route. Components and
 * hooks go through it, and it goes through the shared client in
 * `@/services` — so the front-end still talks to our backend and to nothing
 * else. There is no SMS gateway on this side of the wire; the backend fronts
 * it.
 *
 * The session token is never handled here. It is set by the backend as an
 * httpOnly cookie, which is why every call travels with credentials.
 */

import { SESSION_COOKIE_NAME } from '@hamdastan/config';
import type {
  AuthResponse,
  CancelOtpRequest,
  CheckPhoneRequest,
  CheckPhoneResponse,
  OtpChallenge,
  RegisterRequest,
  SendOtpRequest,
  SessionResponse,
  VerifyOtpRequest,
} from '@hamdastan/types';

import { apiClient } from '@/services';

export const authApi = {
  /** Step one: decides whether the user is signing in or registering. */
  checkPhone(phone: CheckPhoneRequest['phone']) {
    return apiClient.post<CheckPhoneResponse>('/auth/check-phone', { phone });
  },

  /** Sends a code. Called again, it is the resend — the backend enforces both. */
  sendOtp(phone: SendOtpRequest['phone']) {
    return apiClient.post<OtpChallenge>('/auth/otp/send', { phone });
  },

  /** Holds the profile and sends a code. No user exists yet. */
  register(input: RegisterRequest) {
    return apiClient.post<OtpChallenge>('/auth/register', input);
  },

  /** The only call that signs anyone in. */
  verifyOtp(input: VerifyOtpRequest) {
    return apiClient.post<AuthResponse>('/auth/otp/verify', input);
  },

  /** Behind "ویرایش شماره": the code already sent stops working. */
  cancelOtp(phone: CancelOtpRequest['phone']) {
    return apiClient.post<{ cancelled: boolean }>('/auth/otp/cancel', { phone });
  },

  logout() {
    return apiClient.post<{ loggedOut: boolean }>('/auth/logout');
  },

  /**
   * Resolves the session cookie to its user.
   *
   * Called while rendering on the server, where the browser's cookie is not
   * attached automatically, so the token is forwarded by hand. Never cached:
   * a stale answer here is a user seeing somebody else's session.
   */
  session(token: string) {
    return apiClient.get<SessionResponse>('/auth/session', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      cache: 'no-store',
    });
  },
};
