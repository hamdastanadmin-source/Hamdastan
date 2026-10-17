import { API_BASE_URL, API_PREFIX } from '@hamdastan/config';
import type {
  EventBookingInput,
  EventCard,
  EventCategory,
  EventDetail,
  EventHandoff,
  EventListQuery,
  MyEventBooking,
  MyEventsTab,
  Paginated,
  World,
} from '@hamdastan/types';

import { apiClient } from './api-client';

/**
 * Events and the world list, as the product reads them. What a person may
 * see is decided by the API; this only names the routes.
 */
type ServerCall = { cookie?: string };

const withCookie = (options?: ServerCall) => (options?.cookie ? { headers: { cookie: options.cookie } } : {});

/** Lists travel as `a,b` — one parameter, however many values. */
function toQuery(query: EventListQuery & { pageSize?: number }) {
  return {
    ...query,
    category: query.category?.length ? query.category.join(',') : undefined,
    type: query.type?.length ? query.type.join(',') : undefined,
    available: query.available || undefined,
    interested: query.interested || undefined,
  };
}

export const eventsService = {
  list(query: EventListQuery & { pageSize?: number }, options?: ServerCall): Promise<Paginated<EventCard>> {
    return apiClient.get<Paginated<EventCard>>('/events', { ...withCookie(options), query: toQuery(query), cache: 'no-store' });
  },

  categories(options?: ServerCall): Promise<EventCategory[]> {
    return apiClient.get<EventCategory[]>('/events/categories', { ...withCookie(options), cache: 'no-store' });
  },

  get(slug: string, options?: ServerCall): Promise<EventDetail> {
    return apiClient.get<EventDetail>(`/events/${slug}`, { ...withCookie(options), cache: 'no-store' });
  },

  related(slug: string, options?: ServerCall): Promise<EventCard[]> {
    return apiClient.get<EventCard[]>(`/events/${slug}/related`, { ...withCookie(options), cache: 'no-store' });
  },

  /** An admin's preview of an event in any status; the API checks the admin session it carries. */
  preview(id: string, options?: ServerCall): Promise<EventDetail> {
    return apiClient.get<EventDetail>(`/admin/events/${id}/preview`, { ...withCookie(options), cache: 'no-store' });
  },

  worlds(options?: ServerCall): Promise<World[]> {
    return apiClient.get<World[]>('/worlds', { ...withCookie(options), cache: 'no-store' });
  },

  /** «رویدادهای من»: one tab's events. */
  mine(tab: MyEventsTab, options?: ServerCall): Promise<EventCard[]> {
    return apiClient.get<EventCard[]>('/me/events', { ...withCookie(options), query: { tab }, cache: 'no-store' });
  },

  setInterest(id: string, remindInApp: boolean): Promise<{ remindInApp: boolean }> {
    return apiClient.put<{ remindInApp: boolean }>(`/events/${id}/interest`, { remindInApp });
  },

  removeInterest(id: string): Promise<{ removed: true }> {
    return apiClient.delete<{ removed: true }>(`/events/${id}/interest`);
  },

  /** A free registration, confirmed by the API at once — or refused when there is no room. */
  register(id: string, input: EventBookingInput): Promise<MyEventBooking> {
    return apiClient.post<MyEventBooking>(`/events/${id}/registrations`, input);
  },

  cancelRegistration(id: string): Promise<{ cancelled: true }> {
    return apiClient.delete<{ cancelled: true }>(`/events/${id}/registrations`);
  },

  /** Records a pending booking and answers the partner's page. Nothing here confirms a purchase. */
  handoff(id: string, input: EventBookingInput): Promise<EventHandoff> {
    return apiClient.post<EventHandoff>(`/events/${id}/booking-handoff`, input);
  },

  /** Where a library image is loaded from — our API. */
  mediaUrl(id: string): string {
    return `${API_BASE_URL}${API_PREFIX}/media/${id}`;
  },
};
