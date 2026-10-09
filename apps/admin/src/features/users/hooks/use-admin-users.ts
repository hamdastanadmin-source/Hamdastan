'use client';

import { useCallback, useEffect, useState } from 'react';

import type { AdminUser, Paginated } from '@hamdastan/types';
import type { AdminUserCreateOutput, AdminUserUpdateOutput } from '@hamdastan/validation';

import { errorMessage } from '@/lib';
import { adminUsersService } from '@/services';

const SEARCH_DEBOUNCE_MS = 300;

/** Which request the API last answered, and its error if it failed. */
type Loaded = { key: string; error?: string };

/**
 * The user list's state: the search box, the page, what the API last
 * answered, and the writes. Every write reloads the page it was made
 * from, so the table always shows what the server holds.
 *
 * `loading` is derived — the request in flight differs from the one last
 * answered — rather than set, so no state is written synchronously inside
 * an effect. The previous page stays on screen while the next one loads.
 */
export function useAdminUsers() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ search: '', page: 1 });
  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [data, setData] = useState<Paginated<AdminUser> | null>(null);

  // A new search starts again from the first page.
  useEffect(() => {
    const timer = setTimeout(
      () => setQuery((current) => (current.search === search ? current : { search, page: 1 })),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [search]);

  const requestKey = `${query.search}|${query.page}|${reloads}`;

  useEffect(() => {
    let active = true;
    adminUsersService.list(query).then(
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

  const createUser = useCallback(
    async (fields: AdminUserCreateOutput): Promise<AdminUser> => {
      const created = await adminUsersService.create(fields);
      // Newest first: the new row is at the top of page one.
      setQuery((current) => ({ ...current, page: 1 }));
      reload();
      return created;
    },
    [reload]
  );

  const updateUser = useCallback(
    async (id: string, fields: AdminUserUpdateOutput): Promise<AdminUser> => {
      const updated = await adminUsersService.update(id, fields);
      reload();
      return updated;
    },
    [reload]
  );

  const deleteUser = useCallback(
    async (id: string): Promise<void> => {
      await adminUsersService.remove(id);
      reload();
    },
    [reload]
  );

  return {
    search,
    setSearch,
    page: query.page,
    setPage,
    data,
    loading: loaded?.key !== requestKey,
    error: loaded?.key === requestKey ? (loaded.error ?? null) : null,
    reload,
    createUser,
    updateUser,
    deleteUser,
  };
}
