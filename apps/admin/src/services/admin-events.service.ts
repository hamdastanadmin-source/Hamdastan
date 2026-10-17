import type {
  AdminEventBooking,
  AdminEventCategory,
  AdminEventDetail,
  AdminEventHistoryEntry,
  AdminEventListQuery,
  AdminEventSummary,
  EventBookingReviewInput,
  EventCategoryInput,
  EventInput,
  EventStatusInput,
  Paginated,
} from '@hamdastan/types';

import { apiClient } from './api-client';

/** Events' routes in the panel — events, their bookings and their categories — named once. */

const base = '/admin/events';

export const adminEventsService = {
  list(query: AdminEventListQuery) {
    return apiClient.get<Paginated<AdminEventSummary>>(base, {
      query: { ...query, search: query.search || undefined },
      cache: 'no-store',
    });
  },

  /** On the server, pass the request's cookie through. */
  get(id: string, options?: { cookie?: string }) {
    return apiClient.get<AdminEventDetail>(`${base}/${id}`, {
      ...(options?.cookie ? { headers: { cookie: options.cookie } } : {}),
      cache: 'no-store',
    });
  },

  create(input: EventInput) {
    return apiClient.post<AdminEventDetail>(base, input);
  },

  update(id: string, input: EventInput) {
    return apiClient.put<AdminEventDetail>(`${base}/${id}`, input);
  },

  changeStatus(id: string, input: EventStatusInput) {
    return apiClient.post<AdminEventDetail>(`${base}/${id}/status`, input);
  },

  duplicate(id: string) {
    return apiClient.post<AdminEventDetail>(`${base}/${id}/duplicate`);
  },

  history(id: string) {
    return apiClient.get<AdminEventHistoryEntry[]>(`${base}/${id}/history`, { cache: 'no-store' });
  },

  bookings(id: string, page: number) {
    return apiClient.get<Paginated<AdminEventBooking>>(`${base}/${id}/bookings`, { query: { page }, cache: 'no-store' });
  },

  reviewBooking(bookingId: string, input: EventBookingReviewInput) {
    return apiClient.post<{ updated: true }>(`${base}/bookings/${bookingId}`, input);
  },

  categories() {
    return apiClient.get<AdminEventCategory[]>(`${base}/categories`, { cache: 'no-store' });
  },

  createCategory(input: EventCategoryInput) {
    return apiClient.post<AdminEventCategory>(`${base}/categories`, input);
  },

  updateCategory(id: string, input: EventCategoryInput) {
    return apiClient.put<AdminEventCategory>(`${base}/categories/${id}`, input);
  },

  reorderCategories(ids: string[]) {
    return apiClient.put<AdminEventCategory[]>(`${base}/categories/order`, { ids });
  },

  removeCategory(id: string) {
    return apiClient.delete<{ deleted: true }>(`${base}/categories/${id}`);
  },
};
