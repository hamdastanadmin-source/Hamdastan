'use client';

import { useEffect, useState } from 'react';

import { adminMediaService } from '@/services';

/** A Lottie motion's animation data, by id; null until it arrives or if it cannot. */
export function useLottieData(id: string, version: number) {
  const [data, setData] = useState<{ key: string; value: object | null } | null>(null);
  const key = `${id}:${version}`;

  useEffect(() => {
    let active = true;
    adminMediaService.lottie(id).then(
      (value) => active && setData({ key, value }),
      () => active && setData({ key, value: null })
    );
    return () => {
      active = false;
    };
  }, [id, key]);

  return data?.key === key ? { data: data.value, failed: data.value === null } : { data: null, failed: false };
}
