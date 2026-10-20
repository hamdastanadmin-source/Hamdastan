import type {
  AdminWorld,
  AdminWorldDetail,
  AdminWorldHome,
  WorldHome,
  WorldHomeCandidate,
  WorldHomeInput,
  WorldHomeKind,
  WorldInput,
  WorldStatusAction,
} from '@hamdastan/types';

import { apiClient } from './api-client';

/** The world CMS's routes in the panel: worlds, their home and its preview. */

const base = '/admin/worlds';

export const adminWorldsService = {
  list() {
    return apiClient.get<AdminWorld[]>(base, { cache: 'no-store' });
  },

  /** On the server, pass the request's cookie through. */
  get(id: string, options?: { cookie?: string }) {
    return apiClient.get<AdminWorldDetail>(`${base}/${id}`, {
      ...(options?.cookie ? { headers: { cookie: options.cookie } } : {}),
      cache: 'no-store',
    });
  },

  create(input: WorldInput) {
    return apiClient.post<AdminWorldDetail>(base, input);
  },

  update(id: string, input: WorldInput) {
    return apiClient.put<AdminWorldDetail>(`${base}/${id}`, input);
  },

  changeStatus(id: string, action: WorldStatusAction) {
    return apiClient.post<AdminWorldDetail>(`${base}/${id}/status`, { action });
  },

  reorder(ids: string[]) {
    return apiClient.put<AdminWorld[]>(`${base}/order`, { ids });
  },

  remove(id: string) {
    return apiClient.delete<{ deleted: true }>(`${base}/${id}`);
  },

  home(id: string) {
    return apiClient.get<AdminWorldHome>(`${base}/${id}/home`, { cache: 'no-store' });
  },

  saveHome(id: string, input: WorldHomeInput) {
    return apiClient.put<AdminWorldHome>(`${base}/${id}/home`, input);
  },

  candidates(id: string, kind: WorldHomeKind, q: string) {
    return apiClient.get<WorldHomeCandidate[]>(`${base}/${id}/home/candidates`, { query: { kind, q: q || undefined }, cache: 'no-store' });
  },

  preview(id: string) {
    return apiClient.get<WorldHome>(`${base}/${id}/preview`, { cache: 'no-store' });
  },
};
