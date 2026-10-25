'use client';

import { useEffect, useState } from 'react';

import { usernameSchema } from '@hamdastan/validation';

import { authService } from '@/services';

export type UsernameAvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken';

/** Long enough that typing a name is one request, not one per letter. */
const CHECK_DELAY_MS = 400;

/**
 * Asks the API, while the person types, whether a username is free.
 *
 * Only names that already pass `usernameSchema` are sent — the form shows
 * its own message for the rest. The answer is a hint: two people can still
 * race for one name, and the 409 from saving is what settles it. A failed
 * check says nothing about the name, so it falls back to `idle`.
 */
export function useUsernameAvailability(value: string): UsernameAvailabilityStatus {
  const [result, setResult] = useState<{
    username: string;
    status: Exclude<UsernameAvailabilityStatus, 'checking'>;
  } | null>(null);

  const parsed = usernameSchema.safeParse(value);
  const username = parsed.success ? parsed.data : null;

  useEffect(() => {
    if (!username) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      authService
        .checkUsername(username, controller.signal)
        .then(({ available }) => setResult({ username, status: available ? 'available' : 'taken' }))
        .catch(() => {
          if (!controller.signal.aborted) setResult({ username, status: 'idle' });
        });
    }, CHECK_DELAY_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username]);

  if (!username) return 'idle';
  // An answer for a different name is stale: the one on screen is still being checked.
  return result?.username === username ? result.status : 'checking';
}
