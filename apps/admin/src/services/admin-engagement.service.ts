import type {
  ActivityAudience,
  ActivityExport,
  ActivityInput,
  ActivityResults,
  ActivityResultsQuery,
  ActivityStatus,
  ActivityStatusAction,
  ActivityType,
  AdminActivityDetail,
  AdminActivityEvent,
  AdminActivitySummary,
  AdminSubmission,
  AdminXpGrant,
  Paginated,
  ReviewStatus,
} from '@hamdastan/types';

import { apiClient } from './api-client';

/** Engagement Studio's routes, named once. */

type Page = { page?: number; pageSize?: number };

const base = '/admin/engagement';

export const adminEngagementService = {
  list(query: { status?: ActivityStatus; type?: ActivityType; search?: string } & Page) {
    return apiClient.get<Paginated<AdminActivitySummary>>(`${base}/activities`, {
      query: { ...query, search: query.search || undefined },
      cache: 'no-store',
    });
  },

  /** On the server, pass the request's cookie through. */
  get(id: string, options?: { cookie?: string }) {
    return apiClient.get<AdminActivityDetail>(`${base}/activities/${id}`, {
      ...(options?.cookie ? { headers: { cookie: options.cookie } } : {}),
      cache: 'no-store',
    });
  },

  create(input: ActivityInput) {
    return apiClient.post<AdminActivityDetail>(`${base}/activities`, input);
  },

  update(id: string, input: ActivityInput) {
    return apiClient.put<AdminActivityDetail>(`${base}/activities/${id}`, input);
  },

  changeStatus(id: string, action: ActivityStatusAction) {
    return apiClient.post<AdminActivityDetail>(`${base}/activities/${id}/status`, { action });
  },

  duplicate(id: string) {
    return apiClient.post<AdminActivityDetail>(`${base}/activities/${id}/duplicate`);
  },

  previewAudience(audience: ActivityAudience) {
    return apiClient.post<{ eligible: number }>(`${base}/audience/preview`, { audience });
  },

  results(id: string, query: ActivityResultsQuery) {
    return apiClient.get<ActivityResults>(`${base}/activities/${id}/results`, { query, cache: 'no-store' });
  },

  exportCsv(id: string, query: ActivityResultsQuery) {
    return apiClient.get<ActivityExport>(`${base}/activities/${id}/export`, { query, cache: 'no-store' });
  },

  submissions(id: string, query: { status?: ReviewStatus } & Page) {
    return apiClient.get<Paginated<AdminSubmission>>(`${base}/activities/${id}/submissions`, {
      query,
      cache: 'no-store',
    });
  },

  review(responseId: string, decision: 'approve' | 'reject', note?: string) {
    return apiClient.post<{ xpAwarded: number }>(`${base}/submissions/${responseId}/review`, {
      decision,
      note: note || undefined,
    });
  },

  grants(id: string, query: Page) {
    return apiClient.get<Paginated<AdminXpGrant>>(`${base}/activities/${id}/grants`, { query, cache: 'no-store' });
  },

  revokeXp(transactionId: string, reason: string) {
    return apiClient.post<{ revoked: true }>(`${base}/xp/${transactionId}/revoke`, { reason });
  },

  history(id: string) {
    return apiClient.get<AdminActivityEvent[]>(`${base}/activities/${id}/history`, { cache: 'no-store' });
  },
};
