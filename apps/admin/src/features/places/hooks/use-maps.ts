'use client';

import { useCallback, useEffect, useState } from 'react';

import type { AdminPlaceSummary } from '@hamdastan/types';

import { errorMessage } from '@/lib';
import { adminPlacesService } from '@/services';

/** Every world's map, as the API last answered; null until they arrive. */
export function useMaps() {
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<{ key: number; items?: AdminPlaceSummary[]; error?: string } | null>(null);

  useEffect(() => {
    let active = true;
    adminPlacesService.list().then(
      (items) => active && setResult({ key: reloads, items }),
      (error) => active && setResult({ key: reloads, error: errorMessage(error) })
    );
    return () => {
      active = false;
    };
  }, [reloads]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  const current = result?.key === reloads ? result : null;
  return { items: current?.items ?? result?.items ?? null, error: current?.error ?? null, loading: result === null, reload };
}
