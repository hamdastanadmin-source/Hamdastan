'use client';

import { useEffect, useState } from 'react';

/**
 * Seconds remaining, ticking down to zero.
 *
 * It counts to a *deadline* rather than decrementing a number, so a tab that
 * was backgrounded — where browsers throttle timers to once a minute — shows
 * the right figure the moment it comes back rather than however far the
 * interval happened to get.
 *
 * Passing a new `seconds` restarts it, which is what a resend does: the
 * screen hands over the `resendIn` the API just returned, and the countdown
 * begins again from the server's number instead of a locally guessed one.
 */
export function useCountdown(seconds: number): number {
  const [remaining, setRemaining] = useState(seconds);

  // React's own pattern for a value derived from a prop: adjust during
  // render, not in an effect, so the new figure is on screen in the same
  // paint rather than a frame later.
  const [startedFrom, setStartedFrom] = useState(seconds);
  if (startedFrom !== seconds) {
    setStartedFrom(seconds);
    setRemaining(seconds);
  }

  useEffect(() => {
    if (seconds <= 0) return;
    const deadline = Date.now() + seconds * 1000;

    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [seconds]);

  return remaining;
}
