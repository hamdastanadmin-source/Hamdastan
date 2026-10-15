import { API_BASE_URL, API_PREFIX } from '@hamdastan/config';
import type {
  MediaAsset,
  MediaCategory,
  MediaKind,
  MediaUpdateInput,
  Paginated,
} from '@hamdastan/types';

import { apiClient } from './api-client';

/** The media & motion library's routes, named once. */

const base = '/admin/media';

/** A file's bytes as base64 — how an upload travels inside the JSON body. */
async function toBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export const adminMediaService = {
  list(query: { category?: MediaCategory; kind?: MediaKind; search?: string; page?: number; pageSize?: number }) {
    return apiClient.get<Paginated<MediaAsset>>(base, {
      query: { ...query, search: query.search || undefined },
      cache: 'no-store',
    });
  },

  get(id: string) {
    return apiClient.get<MediaAsset>(`${base}/${id}`, { cache: 'no-store' });
  },

  async upload(file: Blob, fields: { name: string; category: MediaCategory }) {
    return apiClient.post<MediaAsset>(base, { ...fields, data: await toBase64(file) });
  },

  async replace(id: string, file: Blob) {
    return apiClient.put<MediaAsset>(`${base}/${id}/file`, { data: await toBase64(file) });
  },

  update(id: string, fields: MediaUpdateInput) {
    return apiClient.patch<MediaAsset>(`${base}/${id}`, fields);
  },

  remove(id: string) {
    return apiClient.delete<{ deleted: true }>(`${base}/${id}`);
  },

  /** A Lottie motion's animation data. */
  lottie(id: string) {
    return apiClient.get<object>(`/media/${id}/lottie`);
  },

  /**
   * Where the browser loads a file from — our API, like everything else. The
   * version makes a replaced file a new address, so no cache shows the old one.
   */
  fileUrl(asset: { id: string; version?: number }) {
    return `${API_BASE_URL}${API_PREFIX}/media/${asset.id}${asset.version ? `?v=${asset.version}` : ''}`;
  },
};
