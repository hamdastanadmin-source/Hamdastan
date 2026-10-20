'use client';

import { useEffect, useState } from 'react';

import type { AdminWorld } from '@hamdastan/types';

import { adminWorldsService } from '@/services';

/**
 * The worlds content can be filed under, for filters and pickers. Empty
 * until they arrive; a failure leaves them empty — the API still checks
 * every id on save.
 */
export function useWorldOptions() {
  const [worlds, setWorlds] = useState<AdminWorld[]>([]);

  useEffect(() => {
    let active = true;
    adminWorldsService.list().then((list) => active && setWorlds(list), () => undefined);
    return () => {
      active = false;
    };
  }, []);

  return worlds;
}
