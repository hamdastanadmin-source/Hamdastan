'use client';

import { useCallback, useState } from 'react';

import type { AppUserSessions } from '@hamdastan/types';
import { appUserLookupSchema } from '@hamdastan/validation';

import { errorMessage } from '@/lib';
import { adminSessionsService } from '@/services';

/**
 * The session manager's state: the account found, its live sessions, and
 * the two ways to end them. What may be ended, and by whom, is the API's
 * decision; this only asks and shows the answer.
 */
export function useAppUserSessions() {
  const [result, setResult] = useState<AppUserSessions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Finds the account by number. Answers false with `error` set when it cannot. */
  const lookup = useCallback(async (input: string): Promise<boolean> => {
    const parsed = appUserLookupSchema.safeParse({ phone: input });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'شماره معتبر نیست');
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      setResult(await adminSessionsService.lookup(parsed.data.phone));
      return true;
    } catch (caught) {
      setResult(null);
      setError(errorMessage(caught));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async (userId: string) => {
    setResult(await adminSessionsService.list(userId));
  }, []);

  /** Ends one session, then re-reads the list. Throws for the screen to report. */
  const revoke = useCallback(
    async (sessionId: string) => {
      if (!result) return;
      await adminSessionsService.revoke(result.user.id, sessionId);
      await refresh(result.user.id);
    },
    [refresh, result]
  );

  /** Ends every session; answers how many were live. */
  const revokeAll = useCallback(async (): Promise<number> => {
    if (!result) return 0;
    const { revoked } = await adminSessionsService.revokeAll(result.user.id);
    await refresh(result.user.id);
    return revoked;
  }, [refresh, result]);

  return { result, loading, error, lookup, revoke, revokeAll };
}
