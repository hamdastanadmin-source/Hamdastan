import type { ActivityAnswers, ActivityCard, ActivitySubmission, PlayerActivity } from '@hamdastan/types';

import { apiClient } from './api-client';

/**
 * Engagement Studio's routes, as the product uses them. The answers go up;
 * whether they complete anything and what they earn comes back from the
 * API — nothing here decides either.
 */
type ServerCall = { cookie?: string };

const withCookie = (options?: ServerCall) =>
  options?.cookie ? { headers: { cookie: options.cookie } } : {};

export const activitiesService = {
  list(options?: ServerCall): Promise<ActivityCard[]> {
    return apiClient.get<ActivityCard[]>('/me/activities', { ...withCookie(options), cache: 'no-store' });
  },

  get(id: string, options?: ServerCall): Promise<PlayerActivity> {
    return apiClient.get<PlayerActivity>(`/me/activities/${id}`, { ...withCookie(options), cache: 'no-store' });
  },

  saveDraft(id: string, answers: ActivityAnswers): Promise<{ saved: true }> {
    return apiClient.put<{ saved: true }>(`/me/activities/${id}/draft`, { answers });
  },

  /**
   * `idempotencyKey` is what makes this safe to retry — the client does so
   * on a dropped connection, and the API answers a repeat from its record
   * instead of storing the answers, or paying the XP, twice. One key per
   * submission the person makes, reused if they tap again after a failure.
   */
  submit(
    id: string,
    versionId: string,
    answers: ActivityAnswers,
    idempotencyKey: string
  ): Promise<ActivitySubmission> {
    return apiClient.post<ActivitySubmission>(
      `/me/activities/${id}/submit`,
      { versionId, answers },
      { idempotencyKey }
    );
  },
};
