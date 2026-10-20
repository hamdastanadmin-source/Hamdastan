'use client';

import { useCallback, useState } from 'react';

import type { AdminWorldDetail, WorldInput, WorldStatusAction } from '@hamdastan/types';

import { adminWorldsService } from '@/services';

/** The world as the API last answered it, and the writes on it. */
export function useWorld(initial: AdminWorldDetail) {
  const [world, setWorld] = useState(initial);

  const save = useCallback(
    async (input: WorldInput) => {
      const detail = await adminWorldsService.update(initial.id, input);
      setWorld(detail);
      return detail;
    },
    [initial.id]
  );

  const changeStatus = useCallback(
    async (action: WorldStatusAction) => {
      const detail = await adminWorldsService.changeStatus(initial.id, action);
      setWorld(detail);
      return detail;
    },
    [initial.id]
  );

  return { world, save, changeStatus };
}
