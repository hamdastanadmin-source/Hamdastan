import { APP_TIME_ZONE } from '@hamdastan/config';
import type { ActivityAudience, AdminEventDetail, EventInput, EventTicketInput } from '@hamdastan/types';

/**
 * The event editor's working copy. Dates are the `datetime-local` strings
 * the inputs hold and numbers the text the admin typed; `toInput` turns it
 * back into what the API takes, and `fromDetail` reads a saved event.
 */

export const EDITOR_SECTIONS = [
  { id: 'basics', label: 'اطلاعات پایه' },
  { id: 'media', label: 'رسانه' },
  { id: 'audience', label: 'دنیا و مخاطب' },
  { id: 'schedule', label: 'زمان' },
  { id: 'venue', label: 'مکان' },
  { id: 'organizer', label: 'برگزارکننده' },
  { id: 'booking', label: 'بلیت و ثبت‌نام' },
  { id: 'publish', label: 'انتشار' },
] as const;

export type EditorSectionId = (typeof EDITOR_SECTIONS)[number]['id'];

export type TicketDraft = Omit<EventTicketInput, 'priceToman' | 'capacity' | 'benefits'> & {
  /** A key for React; the saved id is `id`. */
  key: string;
  priceToman: string;
  capacity: string;
  benefits: string;
};

export type EditorState = Omit<
  EventInput,
  'startAt' | 'endAt' | 'registrationDeadline' | 'latitude' | 'longitude' | 'capacity' | 'tickets' | 'audience'
> & {
  startAt: string;
  endAt: string;
  registrationDeadline: string;
  latitude: string;
  longitude: string;
  capacity: string;
  tickets: TicketDraft[];
  /** Kept whatever the visibility, so switching back and forth loses nothing; sent only when restricted. */
  audience: ActivityAudience;
};

let ticketKeys = 0;
const nextKey = () => `ticket-${(ticketKeys += 1)}`;

export const emptyTicket = (): TicketDraft => ({
  key: nextKey(),
  title: '',
  description: '',
  priceToman: '0',
  capacity: '',
  benefits: '',
  availability: 'available',
  externalId: '',
});

export function emptyState(): EditorState {
  return {
    title: '',
    slug: '',
    summary: '',
    description: '',
    type: 'physical',
    categoryIds: [],
    coverId: null,
    coverAlt: '',
    gallery: [],
    visibility: 'public',
    worldIds: [],
    audience: { kind: 'all' },
    startAt: '',
    endAt: '',
    timeZone: APP_TIME_ZONE,
    registrationDeadline: '',
    venueName: '',
    city: '',
    address: '',
    latitude: '',
    longitude: '',
    onlineUrl: null,
    onlineInstructions: '',
    organizerName: '',
    organizerLogoId: null,
    organizerContact: '',
    bookingMode: 'none',
    externalBookingUrl: null,
    partnerRef: '',
    capacity: '',
    tickets: [],
  };
}

/** `datetime-local` holds local wall time without a zone; this is the local reading of an instant. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

const text = (value: number | null) => (value === null ? '' : String(value));

/** Empty is null; anything else is a number, or NaN for the schema to refuse. */
const number = (value: string) => (value.trim() === '' ? null : Number(value));

export function fromDetail(detail: AdminEventDetail): EditorState {
  return {
    ...detail,
    audience: detail.audience ?? { kind: 'all' },
    startAt: toLocalInput(detail.startAt),
    endAt: toLocalInput(detail.endAt),
    registrationDeadline: toLocalInput(detail.registrationDeadline),
    latitude: text(detail.latitude),
    longitude: text(detail.longitude),
    capacity: text(detail.capacity),
    tickets: detail.tickets.map((ticket) => ({
      ...ticket,
      key: nextKey(),
      priceToman: String(ticket.priceToman),
      capacity: text(ticket.capacity),
      benefits: ticket.benefits.join('\n'),
    })),
  };
}

export function toInput(state: EditorState): EventInput {
  return {
    title: state.title,
    slug: state.slug,
    summary: state.summary,
    description: state.description,
    type: state.type,
    categoryIds: state.categoryIds,
    coverId: state.coverId,
    coverAlt: state.coverAlt,
    gallery: state.gallery,
    visibility: state.visibility,
    worldIds: state.worldIds,
    audience: state.visibility === 'restricted' ? state.audience : null,
    startAt: fromLocalInput(state.startAt),
    endAt: fromLocalInput(state.endAt),
    timeZone: state.timeZone,
    registrationDeadline: fromLocalInput(state.registrationDeadline),
    venueName: state.venueName,
    city: state.city,
    address: state.address,
    latitude: number(state.latitude),
    longitude: number(state.longitude),
    onlineUrl: state.onlineUrl,
    onlineInstructions: state.onlineInstructions,
    organizerName: state.organizerName,
    organizerLogoId: state.organizerLogoId,
    organizerContact: state.organizerContact,
    bookingMode: state.bookingMode,
    externalBookingUrl: state.externalBookingUrl,
    partnerRef: state.partnerRef,
    capacity: number(state.capacity),
    tickets: state.tickets.map((ticket) => ({
      ...(ticket.id ? { id: ticket.id } : {}),
      title: ticket.title,
      description: ticket.description,
      priceToman: number(ticket.priceToman) ?? 0,
      capacity: number(ticket.capacity),
      benefits: ticket.benefits.split('\n').map((line) => line.trim()).filter(Boolean),
      availability: ticket.availability,
      externalId: ticket.externalId,
    })),
  };
}

/** Which section a field — an error's path — is in, so a problem opens where it can be fixed. */
const SECTION_OF_FIELD: Record<string, EditorSectionId> = {
  title: 'basics',
  slug: 'basics',
  summary: 'basics',
  description: 'basics',
  type: 'basics',
  categoryIds: 'basics',
  coverId: 'media',
  coverAlt: 'media',
  gallery: 'media',
  visibility: 'audience',
  worldIds: 'audience',
  audience: 'audience',
  startAt: 'schedule',
  endAt: 'schedule',
  timeZone: 'schedule',
  registrationDeadline: 'schedule',
  venueName: 'venue',
  city: 'venue',
  address: 'venue',
  latitude: 'venue',
  longitude: 'venue',
  onlineUrl: 'venue',
  onlineInstructions: 'venue',
  organizerName: 'organizer',
  organizerLogoId: 'organizer',
  organizerContact: 'organizer',
  bookingMode: 'booking',
  externalBookingUrl: 'booking',
  partnerRef: 'booking',
  capacity: 'booking',
  tickets: 'booking',
};

export const sectionOfPath = (path: string | undefined): EditorSectionId =>
  SECTION_OF_FIELD[path?.split('.')[0] ?? ''] ?? 'basics';
