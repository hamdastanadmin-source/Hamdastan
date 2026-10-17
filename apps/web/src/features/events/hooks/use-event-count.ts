'use client';

import { useEffect, useState } from 'react';

import { eventsService } from '@/services';

import { toListQuery, type DiscoveryState } from '../utils/filters';

const DEBOUNCE_MS = 400;

/**
 * How many events a set of filters would show, asked of the API while the
 * person changes them in the sheet — so «نمایش n رویداد» is the server's
 * count, not a guess. Null while it is on its way.
 */
export function useEventCount(draft: DiscoveryState, enabled: boolean): number | null {
  const [answer, setAnswer] = useState<{ key: string; total: number } | null>(null);
  const key = JSON.stringify(toListQuery(draft));

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = setTimeout(() => {
      eventsService.list({ ...toListQuery(draft), page: 1, pageSize: 1 }).then(
        ({ total }) => active && setAnswer({ key, total }),
        () => undefined
      );
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // `key` stands for `draft`: the same filters in a new object are no change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return answer?.key === key ? answer.total : null;
}
