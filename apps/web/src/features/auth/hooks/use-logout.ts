'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { authApi } from '../services/auth.api';

/**
 * Signs the user out.
 *
 * The call goes to the backend because the backend is what issued the session
 * cookie and is the only thing that can invalidate the token behind it —
 * clearing the cookie alone would leave a usable session on the server.
 *
 * The redirect happens either way: if the request failed, the user still asked
 * to leave, and the stale cookie is refused on its next use.
 */
export function useLogout(): { logout: () => void; isPending: boolean } {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const logout = useCallback(() => {
    setIsPending(true);
    void authApi
      .logout()
      .catch(() => undefined)
      .finally(() => {
        router.replace('/login');
        router.refresh();
      });
  }, [router]);

  return { logout, isPending };
}
