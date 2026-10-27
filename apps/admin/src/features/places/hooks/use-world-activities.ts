'use client';

import { useEffect, useState } from 'react';

import type { WorldHomeCandidate } from '@hamdastan/types';

import { adminWorldsService } from '@/services';

/**
 * The activities filed under a world, in any status — what a place's tasks
 * and entry conditions are chosen from. A failure leaves the list empty; the
 * API checks every id on save.
 */
export function useWorldActivities(worldId: string) {
  const [items, setItems] = useState<WorldHomeCandidate[]>([]);

  useEffect(() => {
    let active = true;
    adminWorldsService.candidates(worldId, 'activities', '').then((list) => active && setItems(list), () => undefined);
    return () => {
      active = false;
    };
  }, [worldId]);

  return items;
}
