/**
 * The admin panel's calls to `apps/api`.
 *
 * This is the only file in the feature that names a route. Components and
 * hooks go through it, and it goes through the shared client in `@/services` —
 * so the panel still talks to our backend and to nothing else. There is no SMS
 * gateway, no database and no external identity provider on this side of the
 * wire; the backend fronts all of it.
 *
 * The session token is never handled here. It is set by the backend as an
 * httpOnly cookie, which is why every call travels with credentials.
 */

import { ADMIN_SESSION_COOKIE_NAME } from '@hamdastan/config';
import type {
  AdminChangePasswordRequest,
  AdminChangePasswordResponse,
  AdminLoginRequest,
  AdminLoginResponse,
  AdminSessionResponse,
} from '@hamdastan/types';

import { apiClient } from '@/services';

export const adminAuthApi = {
  /** The only call that signs anybody in. */
  login(input: AdminLoginRequest) {
    return apiClient.post<AdminLoginResponse>('/admin/auth/login', input);
  },

  /**
   * The forced change. The backend rotates the session, so the cookie the
   * browser ends up with is a new one.
   */
  changePassword(input: AdminChangePasswordRequest) {
    return apiClient.post<AdminChangePasswordResponse>(
      '/admin/auth/change-password',
      input
    );
  },

  logout() {
    return apiClient.post<{ loggedOut: boolean }>('/admin/auth/logout');
  },

  /**
   * Resolves the session cookie to its admin, and to what they may do.
   *
   * Called while rendering on the server, where the browser's cookie is not
   * attached automatically, so the token is forwarded by hand. Never cached: a
   * stale answer here is an admin seeing somebody else's permissions.
   */
  session(token: string) {
    return apiClient.get<AdminSessionResponse>('/admin/auth/session', {
      headers: { cookie: `${ADMIN_SESSION_COOKIE_NAME}=${token}` },
      cache: 'no-store',
    });
  },
};
