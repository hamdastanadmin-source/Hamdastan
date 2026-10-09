import type { AdminUser, Paginated } from '@hamdastan/types';
import type { AdminUserCreateOutput, AdminUserUpdateOutput } from '@hamdastan/validation';

import { apiClient } from './api-client';

/** The admin user-management routes. */
export const adminUsersService = {
  list(query: { search?: string; page?: number; pageSize?: number }): Promise<Paginated<AdminUser>> {
    return apiClient.get<Paginated<AdminUser>>('/admin/users', {
      query: { ...query, search: query.search || undefined },
      cache: 'no-store',
    });
  },

  create(fields: AdminUserCreateOutput): Promise<AdminUser> {
    return apiClient.post<AdminUser>('/admin/users', fields);
  },

  update(id: string, fields: AdminUserUpdateOutput): Promise<AdminUser> {
    return apiClient.patch<AdminUser>(`/admin/users/${id}`, fields);
  },

  remove(id: string): Promise<{ deleted: boolean }> {
    return apiClient.delete<{ deleted: boolean }>(`/admin/users/${id}`);
  },
};
