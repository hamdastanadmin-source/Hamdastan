import type {
  EventBookingModeId,
  EventCategoryIconId,
  EventSortId,
  EventTypeId,
  EventVisibilityId,
  TicketAvailabilityId,
} from '@hamdastan/config';

import type { ActivityAudience } from './engagement';

/**
 * Events (رویدادها) — the wire contract. One event model serves global
 * discovery, a world's events, the detail page, «رویدادهای من» and the admin
 * panel; what a person may see of it is decided by `apps/api`.
 *
 * Times are ISO strings. Prices are toman.
 */

export type EventType = EventTypeId;
export type EventVisibility = EventVisibilityId;
export type EventBookingMode = EventBookingModeId;
export type TicketAvailability = TicketAvailabilityId;
export type EventSort = EventSortId;

/** As stored. */
export type EventStoredStatus = 'draft' | 'published' | 'unpublished' | 'cancelled' | 'archived';
/** As the panel shows it: a published event whose time has not come is «scheduled». */
export type EventStatus = EventStoredStatus | 'scheduled';

/** Where the event is in time, for the person looking at it. */
export type EventPhase = 'upcoming' | 'ongoing' | 'ended' | 'cancelled';

/** Whether there is still room. `none` when the event takes no bookings. */
export type EventAvailability = 'available' | 'limited' | 'sold_out' | 'none';

export type EventBookingStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled';
export type EventBookingSource = 'internal' | 'external';

// ─── Categories and worlds ───────────────────────────────────────────────────

export type EventCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: EventCategoryIconId;
  imageId: string | null;
};

export type AdminEventCategory = EventCategory & {
  position: number;
  isActive: boolean;
  /** Events filed under it, in any status. One with events cannot be deleted. */
  eventCount: number;
};

/** `POST /admin/events/categories`, `PUT /admin/events/categories/:id`. */
export type EventCategoryInput = {
  slug: string;
  name: string;
  description: string;
  icon: EventCategoryIconId;
  imageId: string | null;
  isActive: boolean;
};

export type World = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  coverId: string | null;
};

export type AdminWorld = World & {
  position: number;
  isActive: boolean;
  eventCount: number;
};

/** `POST /admin/worlds`, `PUT /admin/worlds/:id`. */
export type WorldInput = {
  slug: string;
  name: string;
  summary: string;
  coverId: string | null;
  isActive: boolean;
};

// ─── Product ─────────────────────────────────────────────────────────────────

export type EventTicketOption = {
  id: string;
  title: string;
  description: string;
  priceToman: number;
  capacity: number | null;
  benefits: string[];
  availability: TicketAvailability;
};

export type MyEventBooking = {
  id: string;
  status: EventBookingStatus;
  source: EventBookingSource;
  quantity: number;
  ticketTitle: string | null;
  totalToman: number;
  createdAt: string;
};

/**
 * The one action the detail page offers, decided by the API from the
 * event's status, time, booking mode, room and the person's own booking.
 */
export type EventCta =
  | { kind: 'register' }
  | { kind: 'registered' }
  | { kind: 'external'; free: boolean }
  | { kind: 'sold_out' }
  | { kind: 'registration_closed' }
  | { kind: 'ended' }
  | { kind: 'cancelled' }
  | { kind: 'none' };

/** One event in a list: discovery, a world, related events, home, «رویدادهای من». */
export type EventCard = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverId: string | null;
  coverAlt: string;
  type: EventType;
  startAt: string;
  endAt: string;
  city: string;
  venueName: string;
  categories: Pick<EventCategory, 'slug' | 'name' | 'icon'>[];
  worlds: Pick<World, 'slug' | 'name'>[];
  /** The cheapest ticket; null when no ticket has a price. */
  startingPriceToman: number | null;
  /** No ticket costs anything. */
  isFree: boolean;
  phase: EventPhase;
  availability: EventAvailability;
  interested: boolean;
  /** The person's latest booking that is not cancelled — «رویدادهای من» tells interest from booking by it. */
  bookingStatus: EventBookingStatus | null;
};

export type EventDetail = EventCard & {
  description: string;
  gallery: { mediaId: string; alt: string }[];
  timeZone: string;
  registrationDeadline: string | null;
  venue: { name: string; city: string; address: string; latitude: number | null; longitude: number | null } | null;
  /** `url` only when the person may join: an open event, or one they are registered for. */
  online: { instructions: string; url: string | null } | null;
  organizer: { name: string; logoId: string | null; contact: string } | null;
  bookingMode: EventBookingMode;
  tickets: EventTicketOption[];
  interest: { remindInApp: boolean } | null;
  /** The person's latest booking that is not cancelled. */
  booking: MyEventBooking | null;
  cta: EventCta;
  /** Only on an admin's preview: how the event stands in the panel. */
  preview?: { status: EventStatus; visibility: EventVisibility };
};

/** `GET /events` — every filter is optional and they combine. */
export type EventListQuery = {
  q?: string;
  category?: string[];
  type?: EventType[];
  world?: string;
  /** Tehran calendar days, `YYYY-MM-DD`, inclusive. */
  from?: string;
  to?: string;
  city?: string;
  price?: 'free' | 'paid';
  available?: boolean;
  interested?: boolean;
  sort?: EventSort;
  page?: number;
};

/** `GET /events/calendar` — the days, in the range, that have events matching the filters. */
export type EventCalendarDay = { date: string; count: number };

export type MyEventsTab = 'interested' | 'booked' | 'past' | 'soon';

/** `PUT /events/:id/interest`. */
export type EventInterestInput = { remindInApp: boolean };

/** `POST /events/:id/registrations`, `POST /events/:id/booking-handoff`. */
export type EventBookingInput = { ticketOptionId: string | null; quantity: number };

/** `POST /events/:id/booking-handoff` — where to send the person. Nothing is confirmed by it. */
export type EventHandoff = { booking: MyEventBooking; url: string };

// ─── Admin ───────────────────────────────────────────────────────────────────

export type EventTicketInput = {
  /** Present when editing an existing option, so bookings keep pointing at it. */
  id?: string;
  title: string;
  description: string;
  priceToman: number;
  capacity: number | null;
  benefits: string[];
  availability: TicketAvailability;
  externalId: string;
};

/** `POST /admin/events`, `PUT /admin/events/:id`. A draft may be incomplete; publishing checks. */
export type EventInput = {
  title: string;
  slug: string;
  summary: string;
  description: string;
  type: EventType;
  categoryIds: string[];
  coverId: string | null;
  coverAlt: string;
  gallery: { mediaId: string; alt: string }[];
  visibility: EventVisibility;
  worldIds: string[];
  /** Restricted events only. */
  audience: ActivityAudience | null;
  startAt: string | null;
  endAt: string | null;
  timeZone: string;
  registrationDeadline: string | null;
  venueName: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  onlineUrl: string | null;
  onlineInstructions: string;
  organizerName: string;
  organizerLogoId: string | null;
  organizerContact: string;
  bookingMode: EventBookingMode;
  externalBookingUrl: string | null;
  partnerRef: string;
  capacity: number | null;
  tickets: EventTicketInput[];
};

export type AdminEventSummary = {
  id: string;
  slug: string;
  title: string;
  status: EventStatus;
  visibility: EventVisibility;
  type: EventType;
  startAt: string | null;
  endAt: string | null;
  publishAt: string | null;
  organizerName: string;
  worlds: Pick<World, 'id' | 'name'>[];
  categories: Pick<EventCategory, 'id' | 'name'>[];
  interestCount: number;
  bookingCount: number;
  updatedAt: string;
};

export type AdminEventDetail = Omit<EventInput, 'tickets'> & {
  id: string;
  status: EventStatus;
  publishAt: string | null;
  tickets: (EventTicketInput & { id: string })[];
  createdAt: string;
  updatedAt: string;
};

export type AdminEventListQuery = {
  search?: string;
  status?: EventStatus;
  visibility?: EventVisibility;
  world?: string;
  category?: string;
  sort?: 'updated' | 'start';
  page?: number;
};

export type EventStatusAction = 'publish' | 'unpublish' | 'cancel' | 'archive';

/** `POST /admin/events/:id/status`. `publishAt` schedules a publish; omitted is now. */
export type EventStatusInput = { action: EventStatusAction; publishAt?: string | null };

export type AdminEventBooking = {
  id: string;
  person: { name: string; phone: string };
  status: EventBookingStatus;
  source: EventBookingSource;
  quantity: number;
  ticketTitle: string | null;
  totalToman: number;
  externalRef: string;
  createdAt: string;
  updatedAt: string;
};

/** `POST /admin/events/bookings/:id` — an operator records what the partner reported. */
export type EventBookingReviewInput = { status: 'confirmed' | 'failed' | 'cancelled'; externalRef: string };

export type AdminEventHistoryEntry = {
  id: string;
  action: string;
  admin: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export const EVENT_ERROR_CODES = {
  EVENT_INCOMPLETE: 'EVENT_INCOMPLETE',
  EVENT_INVALID_TRANSITION: 'EVENT_INVALID_TRANSITION',
  EVENT_SLUG_TAKEN: 'EVENT_SLUG_TAKEN',
  EVENT_BOOKING_CLOSED: 'EVENT_BOOKING_CLOSED',
  EVENT_SOLD_OUT: 'EVENT_SOLD_OUT',
  EVENT_CATEGORY_IN_USE: 'EVENT_CATEGORY_IN_USE',
  WORLD_IN_USE: 'WORLD_IN_USE',
} as const;
