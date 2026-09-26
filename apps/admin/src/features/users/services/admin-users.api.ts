/**
 * «مدیریت کاربران»'s calls to `apps/api`.
 *
 * The only file in the feature that names a route. Nothing here decides
 * anything: the backend validates every body against the same schemas the forms
 * use, checks the caller's permission on every route, and is what generates and
 * sends a temporary password. The panel never sees a password it did not just
 * cause to be created, and never in production.
 *
 * The list is read on the server, where the session cookie has to be forwarded
 * by hand; the mutations run in the browser, where it rides along.
 */

import type {
  AdminUser,
  AdminUsersQuery,
  CreateAdminUserRequest,
  CreateAdminUserResponse,
  Paginated,
  ResetAdminPasswordResponse,
  UpdateAdminUserRequest,
  UpdateAdminUserResponse,
} from '@hamdastan/types';

import { apiClient } from '@/services';

export const adminUsersApi = {
  /**
   * The list behind the table. `headers` carries the session when this is
   * called while rendering on the server; in the browser it is left off.
   *
   * Never cached: an admin list that is one edit stale is a list showing
   * access somebody has already had revoked.
   */
  list(query: AdminUsersQuery, headers: Record<string, string> = {}) {
    return apiClient.get<Paginated<AdminUser>>('/admin/users', {
      query: {
        ...(query.search ? { search: query.search } : {}),
        ...(query.page ? { page: query.page } : {}),
        ...(query.pageSize ? { pageSize: query.pageSize } : {}),
      },
      headers,
      cache: 'no-store',
    });
  },

  create(input: CreateAdminUserRequest) {
    return apiClient.post<CreateAdminUserResponse>('/admin/users', input);
  },

  update(id: string, patch: UpdateAdminUserRequest) {
    return apiClient.patch<UpdateAdminUserResponse>(`/admin/users/${id}`, patch);
  },

  /**
   * Replaces the account's password with a new temporary one and texts it.
   *
   * There is no "send the old one again": the backend cannot read a password
   * back, so re-sending credentials *is* this call.
   */
  resetPassword(id: string) {
    return apiClient.post<ResetAdminPasswordResponse>(
      `/admin/users/${id}/reset-password`
    );
  },
};
