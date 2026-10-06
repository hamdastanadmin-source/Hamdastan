'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { OwlLoader } from '@/components';

const SetPendingContext = createContext<(pending: boolean) => void>(() => {});

/**
 * The full social-profile result opens behind the detective owl. The owl is
 * ready to leave once the result has arrived — when `SocialProfilePending`,
 * the route's `loading.tsx`, has unmounted.
 */
export function SocialProfileLoader({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false);

  return (
    <SetPendingContext.Provider value={setPending}>
      {children}
      <OwlLoader ready={!pending} />
    </SetPendingContext.Provider>
  );
}

/** The route's `loading.tsx`: draws nothing, only tells the owl the result is not here yet. */
export function SocialProfilePending() {
  const setPending = useContext(SetPendingContext);

  useEffect(() => {
    setPending(true);
    return () => setPending(false);
  }, [setPending]);

  return null;
}
