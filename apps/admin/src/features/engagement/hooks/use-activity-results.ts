'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  ActivityResults,
  ActivityResultsQuery,
  ActivityStatusAction,
  AdminActivityEvent,
  AdminSubmission,
  AdminXpGrant,
  Paginated,
  ReviewStatus,
} from '@hamdastan/types';

import { errorMessage } from '@/lib';
import { adminEngagementService } from '@/services';

import { saveTextFile } from '../utils/download';

type Loadable<T> = { key: string; data?: T; error?: string };

/**
 * One request's state, keyed by what was asked: `loading` is the key in
 * flight differing from the key answered, so nothing is set inside an
 * effect's body and an out-of-date answer is never shown as current.
 */
function useLoad<T>(key: string, load: () => Promise<T>) {
  const [state, setState] = useState<Loadable<T> | null>(null);

  useEffect(() => {
    let active = true;
    load().then(
      (data) => active && setState({ key, data }),
      (error) => active && setState({ key, error: errorMessage(error) })
    );
    return () => {
      active = false;
    };
    // `key` encodes everything `load` reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = state?.key === key ? state : null;
  return {
    data: current?.data ?? (state?.data as T | undefined) ?? null,
    loading: !current,
    error: current?.error ?? null,
  };
}

/**
 * The results dashboard: the figures under a filter, the submissions
 * waiting for review, the XP paid and the history — and the writes that
 * change them (status, review, revoke). Every write reloads everything,
 * because a review moves the figures, the grants and the history at once.
 */
export function useActivityResults(id: string) {
  const [filter, setFilter] = useState<ActivityResultsQuery>({});
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | undefined>('pending');
  const [reviewPage, setReviewPage] = useState(1);
  const [grantPage, setGrantPage] = useState(1);
  const [reloads, setReloads] = useState(0);

  const results = useLoad<ActivityResults>(JSON.stringify({ id, filter, reloads }), () =>
    adminEngagementService.results(id, filter)
  );
  const submissions = useLoad<Paginated<AdminSubmission>>(
    JSON.stringify({ id, reviewStatus, reviewPage, reloads }),
    () => adminEngagementService.submissions(id, { status: reviewStatus, page: reviewPage })
  );
  const grants = useLoad<Paginated<AdminXpGrant>>(JSON.stringify({ id, grantPage, reloads }), () =>
    adminEngagementService.grants(id, { page: grantPage })
  );
  const history = useLoad<AdminActivityEvent[]>(JSON.stringify({ id, reloads }), () =>
    adminEngagementService.history(id)
  );

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  const changeStatus = useCallback(
    async (action: ActivityStatusAction) => {
      await adminEngagementService.changeStatus(id, action);
      reload();
    },
    [id, reload]
  );

  const review = useCallback(
    async (responseId: string, decision: 'approve' | 'reject', note?: string) => {
      const outcome = await adminEngagementService.review(responseId, decision, note);
      reload();
      return outcome;
    },
    [reload]
  );

  const revoke = useCallback(
    async (transactionId: string, reason: string) => {
      await adminEngagementService.revokeXp(transactionId, reason);
      reload();
    },
    [reload]
  );

  const exportCsv = useCallback(async () => {
    const { filename, csv } = await adminEngagementService.exportCsv(id, filter);
    saveTextFile(filename, csv);
  }, [id, filter]);

  return {
    filter,
    setFilter,
    results,
    submissions,
    reviewStatus,
    setReviewStatus: (status: ReviewStatus | undefined) => {
      setReviewStatus(status);
      setReviewPage(1);
    },
    reviewPage,
    setReviewPage,
    grants,
    grantPage,
    setGrantPage,
    history,
    reload,
    changeStatus,
    review,
    revoke,
    exportCsv,
  };
}
