'use client';

import { useCallback, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { toSearch, type DiscoveryState } from '../utils/filters';

/**
 * Changes discovery's state by changing the address — the server reads it
 * and answers with the matching events, so the list, the count and the
 * calendar all come from one source. Any change but the page starts again
 * from page one. `pending` is true while the new list is on its way.
 */
export function useDiscovery(state: DiscoveryState) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (patch: Partial<DiscoveryState>) => {
      const next = { ...state, page: 1, ...patch };
      startTransition(() => router.replace(`${pathname}${toSearch(next)}`, { scroll: false }));
    },
    [pathname, router, state]
  );

  return { apply, pending };
}
