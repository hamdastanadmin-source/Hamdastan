import type { AdminWorld, WorldInput } from '@hamdastan/types';

import { apiClient } from './api-client';

/** The world list's routes in the panel. */

const base = '/admin/worlds';

export const adminWorldsService = {
  list() {
    return apiClient.get<AdminWorld[]>(base, { cache: 'no-store' });
  },

  create(input: WorldInput) {
    return apiClient.post<AdminWorld>(base, input);
  },

  update(id: string, input: WorldInput) {
    return apiClient.put<AdminWorld>(`${base}/${id}`, input);
  },

  reorder(ids: string[]) {
    return apiClient.put<AdminWorld[]>(`${base}/order`, { ids });
  },

  remove(id: string) {
    return apiClient.delete<{ deleted: true }>(`${base}/${id}`);
  },
};
