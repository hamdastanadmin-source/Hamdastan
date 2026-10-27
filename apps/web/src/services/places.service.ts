import type { PlaceView } from '@hamdastan/types';

import { apiClient } from './api-client';

/** A world's map and the places on it, as the product reads them. What may appear is decided by the API. */
type ServerCall = { cookie?: string };

const withCookie = (options?: ServerCall) => (options?.cookie ? { headers: { cookie: options.cookie } } : {});

export const placesService = {
  /** The world's map with its pins; null when it has none to show. */
  map(slug: string, options?: ServerCall): Promise<PlaceView | null> {
    return apiClient.get<PlaceView | null>(`/worlds/${slug}/places/map`, { ...withCookie(options), cache: 'no-store' });
  },

  get(slug: string, id: string, options?: ServerCall): Promise<PlaceView> {
    return apiClient.get<PlaceView>(`/worlds/${slug}/places/${id}`, { ...withCookie(options), cache: 'no-store' });
  },
};
