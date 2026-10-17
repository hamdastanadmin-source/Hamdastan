import type {
  ActivityAudience,
  EventAvailability,
  EventBookingMode,
  EventBookingSource,
  EventBookingStatus,
  EventStoredStatus,
  EventType,
  EventVisibility,
  TicketAvailability,
} from '@hamdastan/types';
import type { EventCategoryIconId } from '@hamdastan/config';
import type { EventInputOutput } from '@hamdastan/validation';

/**
 * Types internal to the Events module. The wire shapes are in
 * `@hamdastan/types`; these are what the repository hands the service.
 */

export type TicketRecord = {
  id: string;
  title: string;
  description: string;
  priceToman: number;
  capacity: number | null;
  benefits: string[];
  availability: TicketAvailability;
  externalId: string;
};

export type EventRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  type: EventType;
  coverId: string | null;
  coverAlt: string;
  startAt: Date | null;
  endAt: Date | null;
  timeZone: string;
  registrationDeadline: Date | null;
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
  status: EventStoredStatus;
  publishAt: Date | null;
  visibility: EventVisibility;
  audience: ActivityAudience | null;
  createdAt: Date;
  updatedAt: Date;
  categories: { id: string; slug: string; name: string; icon: EventCategoryIconId }[];
  /** Inactive worlds included — the product leaves them out, the panel shows them. */
  worlds: { id: string; slug: string; name: string; isActive: boolean }[];
  gallery: { mediaId: string; alt: string }[];
  tickets: TicketRecord[];
  interestCount: number;
  /** Bookings that are not cancelled. */
  bookingCount: number;
  availability: EventAvailability;
  startingPriceToman: number | null;
  isFree: boolean;
  /** For the person asking; false without one. */
  interested: boolean;
  bookingStatus: EventBookingStatus | null;
};

export type BookingRecord = {
  id: string;
  status: EventBookingStatus;
  source: EventBookingSource;
  quantity: number;
  ticketTitle: string | null;
  totalToman: number;
  createdAt: Date;
};

export type AdminBookingRecord = BookingRecord & {
  firstName: string | null;
  lastName: string | null;
  phone: string;
  externalRef: string;
  updatedAt: Date;
};

export type EventFields = EventInputOutput;

/** Discovery's filters, as the repository applies them. */
export type EventFilter = {
  q?: string;
  category?: string[];
  type?: EventType[];
  world?: string;
  from?: string;
  to?: string;
  city?: string;
  price?: 'free' | 'paid';
  available?: boolean;
  interested?: boolean;
};

export type CategoryRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: EventCategoryIconId;
  imageId: string | null;
  position: number;
  isActive: boolean;
  eventCount: number;
};

export type HistoryRecord = {
  id: string;
  action: string;
  adminName: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
};

export type BookingWrite = {
  eventId: string;
  userId: string;
  ticketOptionId: string | null;
  quantity: number;
  totalToman: number;
};
