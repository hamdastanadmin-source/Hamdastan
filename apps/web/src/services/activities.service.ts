import { API_BASE_URL, API_PREFIX } from '@hamdastan/config';
import type {
  ActivityAnswers,
  ActivityAnswerValue,
  ActivityCard,
  ActivitySubmission,
  JourneyAnswerOutcome,
  JourneyPreview,
  Leaderboard,
  PlayerActivity,
  PlayerMedia,
} from '@hamdastan/types';

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

  /** Records the moment the person starts — a competition's time runs from it. Starting again changes nothing. */
  start(id: string): Promise<{ started: true }> {
    return apiClient.post<{ started: true }>(`/me/activities/${id}/start`);
  },

  /** A competition's leaderboard, with the person's own place. */
  leaderboard(id: string, options?: ServerCall): Promise<Leaderboard> {
    return apiClient.get<Leaderboard>(`/me/activities/${id}/leaderboard`, { ...withCookie(options), cache: 'no-store' });
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

  /**
   * One journey answer. Safe to send again: the API keeps the first answer
   * to a question and answers a repeat as one, without writing or paying.
   */
  answer(id: string, questionId: string, value: ActivityAnswerValue | null): Promise<JourneyAnswerOutcome> {
    return apiClient.post<JourneyAnswerOutcome>(`/me/activities/${id}/answers`, { questionId, value });
  },

  /** An admin's full preview of a journey; the API checks the admin session it carries. */
  preview(id: string, options?: ServerCall): Promise<JourneyPreview> {
    return apiClient.get<JourneyPreview>(`/admin/engagement/activities/${id}/preview`, {
      ...withCookie(options),
      cache: 'no-store',
    });
  },

  /** A Lottie motion's animation data. */
  lottie(mediaId: string): Promise<object> {
    return apiClient.get<object>(`/media/${mediaId}/lottie`);
  },

  /** Where a library file is loaded from — our API; its version is a new address when it is replaced. */
  mediaUrl(media: PlayerMedia): string {
    return `${API_BASE_URL}${API_PREFIX}/media/${media.id}?v=${media.version}`;
  },
};
