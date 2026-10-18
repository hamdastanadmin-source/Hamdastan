import type {
  AdminCampaign,
  AdminCampaignSummary,
  AudienceEstimate,
  CampaignCategory,
  CampaignHistoryEntry,
  CampaignInput,
  CampaignListQuery,
  CampaignOptions,
  CampaignReport,
  NotificationAudience,
  NotificationDestination,
  NotificationsOverview,
  Paginated,
} from '@hamdastan/types';

import { apiClient } from './api-client';

/** Notification campaigns' routes in the panel, named once. */

const base = '/admin/notifications';

export const adminNotificationsService = {
  overview() {
    return apiClient.get<NotificationsOverview>(`${base}/overview`, { cache: 'no-store' });
  },

  options() {
    return apiClient.get<CampaignOptions>(`${base}/options`, { cache: 'no-store' });
  },

  estimate(input: { audience: NotificationAudience; category: CampaignCategory; destination: NotificationDestination }) {
    return apiClient.post<AudienceEstimate>(`${base}/audience`, input);
  },

  list(query: CampaignListQuery) {
    return apiClient.get<Paginated<AdminCampaignSummary>>(`${base}/campaigns`, {
      query: { ...query, search: query.search || undefined },
      cache: 'no-store',
    });
  },

  /** On the server, pass the request's cookie through. */
  get(id: string, options?: { cookie?: string }) {
    return apiClient.get<AdminCampaign>(`${base}/campaigns/${id}`, {
      ...(options?.cookie ? { headers: { cookie: options.cookie } } : {}),
      cache: 'no-store',
    });
  },

  create(input: CampaignInput) {
    return apiClient.post<AdminCampaign>(`${base}/campaigns`, input);
  },

  update(id: string, input: CampaignInput) {
    return apiClient.put<AdminCampaign>(`${base}/campaigns/${id}`, input);
  },

  duplicate(id: string) {
    return apiClient.post<AdminCampaign>(`${base}/campaigns/${id}/duplicate`);
  },

  /** `scheduledAt: null` sends now — the dispatcher sends it within seconds, not this request. */
  send(id: string, scheduledAt: string | null) {
    return apiClient.post<AdminCampaign>(`${base}/campaigns/${id}/send`, { scheduledAt });
  },

  cancel(id: string) {
    return apiClient.post<AdminCampaign>(`${base}/campaigns/${id}/cancel`);
  },

  stopPush(id: string) {
    return apiClient.post<{ cancelled: number }>(`${base}/campaigns/${id}/stop-push`);
  },

  archive(id: string) {
    return apiClient.post<AdminCampaign>(`${base}/campaigns/${id}/archive`);
  },

  report(id: string) {
    return apiClient.get<CampaignReport>(`${base}/campaigns/${id}/report`, { cache: 'no-store' });
  },

  history(id: string) {
    return apiClient.get<CampaignHistoryEntry[]>(`${base}/campaigns/${id}/history`, { cache: 'no-store' });
  },
};
