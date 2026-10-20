'use client';

import { useCallback, useEffect, useState } from 'react';

import type { ContentIndexItem, ContentIndexQuery, Paginated } from '@hamdastan/types';

import { errorMessage } from '@/lib';
import { adminContentService } from '@/services';

const SEARCH_DEBOUNCE_MS = 300;

export type ContentFilters = Omit<ContentIndexQuery, 'page' | 'pageSize' | 'q'> & { q: string };

type Loaded = { key: string; error?: string };

/**
 * The content index: filters, the page, and what the API last answered. A
 * fixed `world` (a world's own content tab) is always part of the query.
 */
export function useContentIndex(fixed: { world?: string } = {}) {
  // Only a world that is set pins the list; an absent one must not clear the filter the admin chose.
  const pinned = fixed.world ? { world: fixed.world } : {};
  const [filters, setFilters] = useState<ContentFilters>({ q: '' });
  const [query, setQuery] = useState<ContentIndexQuery>({ ...filters, ...pinned, page: 1 });
  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [data, setData] = useState<Paginated<ContentIndexItem> | null>(null);

  // A filter change starts again from page one; typing is debounced.
  useEffect(() => {
    const timer = setTimeout(() => setQuery({ ...filters, ...pinned, page: 1 }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `pinned` is set once by the screen that owns the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const requestKey = JSON.stringify({ query, reloads });

  useEffect(() => {
    let active = true;
    adminContentService.index(query).then(
      (page) => {
        if (!active) return;
        setData(page);
        setLoaded({ key: requestKey });
      },
      (error) => active && setLoaded({ key: requestKey, error: errorMessage(error) })
    );
    return () => {
      active = false;
    };
  }, [query, requestKey]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  const setPage = useCallback((page: number) => setQuery((current) => ({ ...current, page })), []);

  return {
    filters,
    setFilters,
    page: query.page ?? 1,
    setPage,
    data,
    loading: loaded?.key !== requestKey,
    error: loaded?.key === requestKey ? (loaded.error ?? null) : null,
    reload,
  };
}
