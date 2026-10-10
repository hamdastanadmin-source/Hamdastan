'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  ActivityStatus,
  ActivityStatusAction,
  ActivityType,
  AdminActivityDetail,
  AdminActivitySummary,
  Paginated,
} from '@hamdastan/types';

import { errorMessage } from '@/lib';
import { adminEngagementService } from '@/services';

const SEARCH_DEBOUNCE_MS = 300;

export type ActivityFilters = { status?: ActivityStatus; type?: ActivityType; search: string };

type Loaded = { key: string; error?: string };

/**
 * The studio's list: filters, the page, what the API last answered, and the
 * row actions. Every action reloads, so the figures are always the server's.
 * `loading` is derived from the request in flight, as in the users list.
 */
export function useActivities() {
  const [filters, setFilters] = useState<ActivityFilters>({ search: '' });
  const [query, setQuery] = useState({ ...filters, page: 1 });
  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [data, setData] = useState<Paginated<AdminActivitySummary> | null>(null);

  // A filter change starts again from page one; typing is debounced.
  useEffect(() => {
    const timer = setTimeout(() => setQuery({ ...filters, page: 1 }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters]);

  const requestKey = JSON.stringify({ query, reloads });

  useEffect(() => {
    let active = true;
    adminEngagementService.list(query).then(
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

  const changeStatus = useCallback(
    async (id: string, action: ActivityStatusAction): Promise<AdminActivityDetail> => {
      const updated = await adminEngagementService.changeStatus(id, action);
      reload();
      return updated;
    },
    [reload]
  );

  const duplicate = useCallback(
    async (id: string): Promise<AdminActivityDetail> => {
      const copy = await adminEngagementService.duplicate(id);
      reload();
      return copy;
    },
    [reload]
  );

  return {
    filters,
    setFilters,
    page: query.page,
    setPage,
    data,
    loading: loaded?.key !== requestKey,
    error: loaded?.key === requestKey ? (loaded.error ?? null) : null,
    reload,
    changeStatus,
    duplicate,
  };
}
