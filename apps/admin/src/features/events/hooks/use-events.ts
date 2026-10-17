'use client';

import { useCallback, useEffect, useState } from 'react';

import type { AdminEventDetail, AdminEventListQuery, AdminEventSummary, EventStatusInput, Paginated } from '@hamdastan/types';

import { errorMessage } from '@/lib';
import { adminEventsService } from '@/services';

const SEARCH_DEBOUNCE_MS = 300;

export type EventFilters = Omit<AdminEventListQuery, 'page' | 'search'> & { search: string };

type Loaded = { key: string; error?: string };

/**
 * The events list: filters, the page, what the API last answered, and the
 * row actions. Every action reloads, so what is shown is the server's.
 */
export function useEvents() {
  const [filters, setFilters] = useState<EventFilters>({ search: '', sort: 'updated' });
  const [query, setQuery] = useState({ ...filters, page: 1 });
  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [data, setData] = useState<Paginated<AdminEventSummary> | null>(null);

  // A filter change starts again from page one; typing is debounced.
  useEffect(() => {
    const timer = setTimeout(() => setQuery({ ...filters, page: 1 }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters]);

  const requestKey = JSON.stringify({ query, reloads });

  useEffect(() => {
    let active = true;
    adminEventsService.list(query).then(
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
    async (id: string, input: EventStatusInput): Promise<AdminEventDetail> => {
      const updated = await adminEventsService.changeStatus(id, input);
      reload();
      return updated;
    },
    [reload]
  );

  const duplicate = useCallback(
    async (id: string): Promise<AdminEventDetail> => {
      const copy = await adminEventsService.duplicate(id);
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
