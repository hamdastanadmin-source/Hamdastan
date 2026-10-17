'use client';

import { useEffect, useState } from 'react';

import type { AdminEventCategory, AdminWorld } from '@hamdastan/types';

import { adminEventsService, adminWorldsService } from '@/services';

/**
 * The categories and worlds an event can be filed under, for the editor's
 * choices and the list's filters. Empty until they arrive; a failure leaves
 * them empty — the API still checks every id on save.
 */
export function useEventOptions() {
  const [categories, setCategories] = useState<AdminEventCategory[]>([]);
  const [worlds, setWorlds] = useState<AdminWorld[]>([]);

  useEffect(() => {
    let active = true;
    adminEventsService.categories().then((list) => active && setCategories(list), () => undefined);
    adminWorldsService.list().then((list) => active && setWorlds(list), () => undefined);
    return () => {
      active = false;
    };
  }, []);

  return { categories, worlds };
}
