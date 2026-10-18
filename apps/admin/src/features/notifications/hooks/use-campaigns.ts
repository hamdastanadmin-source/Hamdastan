'use client';

import { useCallback, useEffect, useState } from 'react';

import type { AdminCampaignSummary, CampaignStatus, NotificationsOverview, Paginated } from '@hamdastan/types';

import { errorMessage } from '@/lib';
import { adminNotificationsService } from '@/services';

const SEARCH_DEBOUNCE_MS = 300;

export type CampaignFilters = { search: string; status?: CampaignStatus };

type Loaded = { key: string; error?: string };

/**
 * The campaigns list and the figures above it: filters, the page, and what
 * the API last answered. Every row action reloads, so what is shown is the
 * server's.
 */
export function useCampaigns() {
  const [filters, setFilters] = useState<CampaignFilters>({ search: '' });
  const [query, setQuery] = useState({ ...filters, page: 1 });
  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [data, setData] = useState<Paginated<AdminCampaignSummary> | null>(null);
  const [overview, setOverview] = useState<NotificationsOverview | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery({ ...filters, page: 1 }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters]);

  const requestKey = JSON.stringify({ query, reloads });

  useEffect(() => {
    let active = true;
    Promise.all([adminNotificationsService.list(query), adminNotificationsService.overview()]).then(
      ([page, figures]) => {
        if (!active) return;
        setData(page);
        setOverview(figures);
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
    page: query.page,
    setPage,
    data,
    overview,
    loading: loaded?.key !== requestKey,
    error: loaded?.key === requestKey ? (loaded.error ?? null) : null,
    reload,
  };
}
