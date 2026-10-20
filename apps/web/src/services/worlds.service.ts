import { API_BASE_URL, API_PREFIX } from '@hamdastan/config';
import type { ActivityCard, World, WorldDetail, WorldHome } from '@hamdastan/types';

import { apiClient } from './api-client';

/**
 * Worlds as the product reads them: the published list, one world, its
 * home and its activities tab. What may appear is decided by the API.
 */
type ServerCall = { cookie?: string };

const withCookie = (options?: ServerCall) => (options?.cookie ? { headers: { cookie: options.cookie } } : {});

export const worldsService = {
  list(options?: ServerCall): Promise<World[]> {
    return apiClient.get<World[]>('/worlds', { ...withCookie(options), cache: 'no-store' });
  },

  get(slug: string, options?: ServerCall): Promise<WorldDetail> {
    return apiClient.get<WorldDetail>(`/worlds/${slug}`, { ...withCookie(options), cache: 'no-store' });
  },

  home(slug: string, options?: ServerCall): Promise<WorldHome> {
    return apiClient.get<WorldHome>(`/worlds/${slug}/home`, { ...withCookie(options), cache: 'no-store' });
  },

  activities(slug: string, options?: ServerCall): Promise<ActivityCard[]> {
    return apiClient.get<ActivityCard[]>(`/worlds/${slug}/activities`, { ...withCookie(options), cache: 'no-store' });
  },

  /** An admin's preview of a world's home in any status; the API checks the admin session it carries. */
  preview(id: string, options?: ServerCall): Promise<WorldHome> {
    return apiClient.get<WorldHome>(`/admin/worlds/${id}/preview`, { ...withCookie(options), cache: 'no-store' });
  },

  /** A library file, served by the API. */
  mediaUrl(id: string): string {
    return `${API_BASE_URL}${API_PREFIX}/media/${id}`;
  },
};
