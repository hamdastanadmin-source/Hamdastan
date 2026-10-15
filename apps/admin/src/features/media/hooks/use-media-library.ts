'use client';

import { useCallback, useEffect, useState } from 'react';

import type { MediaAsset, MediaCategory, MediaKind, Paginated } from '@hamdastan/types';

import { errorMessage } from '@/lib';
import { adminMediaService } from '@/services';

import { rememberAsset } from './use-media-asset';

const SEARCH_DEBOUNCE_MS = 300;

export type MediaFilters = { category?: MediaCategory; kind?: MediaKind; search: string };

/**
 * A page of the library under its filters, and a reload after any change —
 * the list is always what the API last answered.
 */
export function useMediaLibrary(initial: Partial<MediaFilters> = {}) {
  const [filters, setFilters] = useState<MediaFilters>({ search: '', ...initial });
  const [query, setQuery] = useState({ ...filters, page: 1 });
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: Paginated<MediaAsset>; error?: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery({ ...filters, page: 1 }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters]);

  const key = JSON.stringify({ query, reloads });

  useEffect(() => {
    let active = true;
    adminMediaService.list(query).then(
      (data) => {
        data.items.forEach(rememberAsset);
        if (active) setResult({ key, data });
      },
      (error) => active && setResult({ key, error: errorMessage(error) })
    );
    return () => {
      active = false;
    };
  }, [query, key]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  const setPage = useCallback((page: number) => setQuery((current) => ({ ...current, page })), []);
  const current = result?.key === key ? result : null;

  return {
    filters,
    setFilters,
    page: query.page,
    setPage,
    reload,
    loading: current === null,
    data: current?.data ?? result?.data ?? null,
    error: current?.error ?? null,
  };
}

export type MediaLibraryApi = ReturnType<typeof useMediaLibrary>;
