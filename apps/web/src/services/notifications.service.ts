import { API_BASE_URL, API_PREFIX } from '@hamdastan/config';
import type {
  NotificationFilter,
  NotificationInbox,
  NotificationOpenResult,
  NotificationPreference,
  NotificationPreferences,
  PushSubscriptionInput,
} from '@hamdastan/types';

import { apiClient } from './api-client';

/**
 * The Notification Center, its preferences and this device's push
 * subscription, as the product reads them. Every route is scoped by the API
 * to the signed-in person; this only names them.
 */
type ServerCall = { cookie?: string };

const withCookie = (options?: ServerCall) => (options?.cookie ? { headers: { cookie: options.cookie } } : {});

export const notificationsService = {
  inbox(filter: NotificationFilter, before?: string, options?: ServerCall): Promise<NotificationInbox> {
    return apiClient.get<NotificationInbox>('/notifications', { ...withCookie(options), query: { filter, before }, cache: 'no-store' });
  },

  unread(options?: ServerCall): Promise<{ unread: number }> {
    return apiClient.get<{ unread: number }>('/notifications/unread', { ...withCookie(options), cache: 'no-store' });
  },

  /** Without ids, everything. */
  markRead(ids?: string[]): Promise<{ unread: number }> {
    return apiClient.post<{ unread: number }>('/notifications/read', ids ? { ids } : {});
  },

  /** Marks it read and answers where to go — the API re-checks the destination for this person. */
  open(id: string): Promise<NotificationOpenResult> {
    return apiClient.post<NotificationOpenResult>(`/notifications/${id}/open`);
  },

  dismiss(id: string): Promise<{ unread: number }> {
    return apiClient.delete<{ unread: number }>(`/notifications/${id}`);
  },

  preferences(options?: ServerCall): Promise<NotificationPreferences> {
    return apiClient.get<NotificationPreferences>('/notifications/preferences', { ...withCookie(options), cache: 'no-store' });
  },

  savePreferences(categories: NotificationPreference[]): Promise<NotificationPreferences> {
    return apiClient.put<NotificationPreferences>('/notifications/preferences', { categories });
  },

  subscribe(subscription: PushSubscriptionInput): Promise<{ subscribed: true }> {
    return apiClient.post<{ subscribed: true }>('/notifications/push/subscriptions', subscription);
  },

  unsubscribe(endpoint: string): Promise<{ subscribed: false }> {
    return apiClient.post<{ subscribed: false }>('/notifications/push/unsubscribe', { endpoint });
  },

  /** Where a library image is loaded from — our API. */
  mediaUrl(id: string): string {
    return `${API_BASE_URL}${API_PREFIX}/media/${id}`;
  },
};
