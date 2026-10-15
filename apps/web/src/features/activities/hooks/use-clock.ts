'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The time, for a countdown on screen — ticking every `everyMs`. When
 * `until` passes, `onReached` runs once: the screen asks the API again,
 * because only its answer opens anything.
 */
export function useClock(until: string | null, onReached: () => void, everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  const reached = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);

  useEffect(() => {
    if (until && reached.current !== until && new Date(until) <= now) {
      reached.current = until;
      onReached();
    }
  }, [now, until, onReached]);

  return now;
}
