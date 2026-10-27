import type { AdminPlaceDetail, AdminPlaceSummary, PlaceCreateInput, PlaceInput, PlaceStatusAction } from '@hamdastan/types';

import { apiClient } from './api-client';

/** Places' routes in the panel: every world's map, one place, its status. */

const base = '/admin/places';

export const adminPlacesService = {
  /** Every world's map; what is inside each comes with the map itself. */
  list() {
    return apiClient.get<AdminPlaceSummary[]>(base, { cache: 'no-store' });
  },

  /** On the server, pass the request's cookie through. */
  get(id: string, options?: { cookie?: string }) {
    return apiClient.get<AdminPlaceDetail>(`${base}/${id}`, {
      ...(options?.cookie ? { headers: { cookie: options.cookie } } : {}),
      cache: 'no-store',
    });
  },

  create(input: PlaceCreateInput) {
    return apiClient.post<AdminPlaceDetail>(base, input);
  },

  update(id: string, input: PlaceInput) {
    return apiClient.put<AdminPlaceDetail>(`${base}/${id}`, input);
  },

  changeStatus(id: string, action: PlaceStatusAction) {
    return apiClient.post<AdminPlaceDetail>(`${base}/${id}/status`, { action });
  },

  remove(id: string) {
    return apiClient.delete<{ deleted: true }>(`${base}/${id}`);
  },
};
