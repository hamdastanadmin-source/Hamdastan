'use client';

import { useCallback, useEffect, useState } from 'react';

import { errorMessage } from '@/lib';

/**
 * A short list the admin keeps in order — worlds, event categories: what the
 * API last answered, and moving an item one place up or down. The order is
 * the server's: a move sends the whole new order and shows what comes back.
 */
export function useOrderedList<T extends { id: string }>(load: () => Promise<T[]>, reorder: (ids: string[]) => Promise<T[]>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;
    load().then(
      (list) => {
        if (!active) return;
        setItems(list);
        setError(null);
      },
      (caught) => active && setError(errorMessage(caught))
    );
    return () => {
      active = false;
    };
  }, [load, reloads]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  const move = useCallback(
    async (id: string, by: -1 | 1) => {
      if (!items) return;
      const from = items.findIndex((item) => item.id === id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= items.length) return;
      const ids = items.map((item) => item.id);
      [ids[from], ids[to]] = [ids[to], ids[from]];
      setItems(await reorder(ids));
    },
    [items, reorder]
  );

  return { items, error, loading: items === null && error === null, reload, move };
}
