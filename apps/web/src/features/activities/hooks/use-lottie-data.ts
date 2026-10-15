'use client';

import { useEffect, useState } from 'react';

import { activitiesService } from '@/services';

/** A Lottie motion's data by id; `failed` when it cannot be had, so the caller moves on. */
export function useLottieData(id: string | null) {
  const [state, setState] = useState<{ id: string; data: object | null } | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    activitiesService.lottie(id).then(
      (data) => active && setState({ id, data }),
      () => active && setState({ id, data: null })
    );
    return () => {
      active = false;
    };
  }, [id]);

  if (!id || state?.id !== id) return { data: null, failed: false };
  return { data: state.data, failed: state.data === null };
}
