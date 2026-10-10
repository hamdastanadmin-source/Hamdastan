import type { AppUserSessions } from '@hamdastan/types';

import { apiClient } from './api-client';

/**
 * A product account's sessions — find, list, end. The number goes in a POST
 * body rather than a query string so it stays out of access logs.
 */
export const adminSessionsService = {
  lookup(phone: string): Promise<AppUserSessions> {
    return apiClient.post<AppUserSessions>('/admin/app-users/sessions/lookup', { phone });
  },

  list(userId: string): Promise<AppUserSessions> {
    return apiClient.get<AppUserSessions>(`/admin/app-users/${userId}/sessions`, { cache: 'no-store' });
  },

  revoke(userId: string, sessionId: string): Promise<{ revoked: number }> {
    return apiClient.delete<{ revoked: number }>(`/admin/app-users/${userId}/sessions/${sessionId}`);
  },

  revokeAll(userId: string): Promise<{ revoked: number }> {
    return apiClient.delete<{ revoked: number }>(`/admin/app-users/${userId}/sessions`);
  },
};
