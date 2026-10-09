import type { AdminSessionResponse, OtpRequestResponse } from '@hamdastan/types';

import { apiClient } from './api-client';

/**
 * Every route the admin sign-in touches, named once. The session arrives as
 * an `httpOnly` cookie the browser stores on its own; no token passes
 * through this code.
 */

/** A call made while rendering on the server forwards the request's cookies. */
type ServerCall = { cookie?: string };

export const adminAuthService = {
  requestOtp(phone: string): Promise<OtpRequestResponse> {
    return apiClient.post<OtpRequestResponse>('/admin/auth/otp/request', { phone });
  },

  verifyOtp(phone: string, code: string): Promise<AdminSessionResponse> {
    return apiClient.post<AdminSessionResponse>('/admin/auth/otp/verify', { phone, code });
  },

  logout(): Promise<{ loggedOut: boolean }> {
    return apiClient.post<{ loggedOut: boolean }>('/admin/auth/logout');
  },

  /** The current admin. Throws `HttpError` 401 when there is no live session. */
  getSession(options?: ServerCall): Promise<AdminSessionResponse> {
    return apiClient.get<AdminSessionResponse>('/admin/me', {
      ...(options?.cookie ? { headers: { cookie: options.cookie } } : {}),
      cache: 'no-store',
    });
  },
};
