import { randomUUID } from 'node:crypto';

import {
  EVENT_ERROR_CODES as CODES,
  type ActivityAudience,
  type AdminEventBooking,
  type AdminEventCategory,
  type AdminEventDetail,
  type AdminEventHistoryEntry,
  type AdminEventSummary,
  type ContentStatus,
  type EventBookingInput,
  type EventCalendarDay,
  type EventCard,
  type EventCategory,
  type EventCta,
  type EventDetail,
  type EventHandoff,
  type EventPhase,
  type EventSort,
  type EventStatus,
  type EventStatusAction,
  type EventStoredStatus,
  type MyEventBooking,
  type MyEventsTab,
  type Paginated,
  type WorldHomeCandidate,
} from '@hamdastan/types';
import {
  eventPublishProblems,
  type AdminEventListQueryOutput,
  type EventCalendarQueryOutput,
  type EventCategoryInputOutput,
  type EventListQueryOutput,
} from '@hamdastan/validation';

import { AppError, NotFoundError, ValidationError } from '../../shared/errors';
import type { AdminRecord } from '../admin';
import { engagementService } from '../engagement';
import { mediaService } from '../media';
import { notificationsService } from '../notifications';
import type { UserRecord } from '../users';

import { eventsRepository } from './events.repository';
import type { BookingRecord, CategoryRecord, EventFields, EventFilter, EventRecord } from './events.types';

/**
 * Business logic for events — رویدادها.
 *
 * Everything that decides is here or in the repository's visibility rule:
 * where an event may be published, whether it is complete enough to be,
 * which one action the detail page offers, and whether a registration or a
 * handoff to the partner may happen. The product sends a choice; the answer
 * comes back from here.
 *
 * A handoff to Fidibo Art is recorded as `pending` and stays so until an
 * operator records what the partner reported — returning to the app is not
 * proof of a booking.
 */

const notFound = () => new NotFoundError('رویداد پیدا نشد');

const iso = (date: Date | null) => date?.toISOString() ?? null;

/** Read off the clock: a published event whose time has not come is «scheduled». */
function effectiveStatus(record: EventRecord, now: Date): EventStatus {
  if (record.status === 'published' && record.publishAt && record.publishAt > now) return 'scheduled';
  return record.status;
}

function phaseOf(record: EventRecord, now: Date): EventPhase {
  if (record.status === 'cancelled') return 'cancelled';
  if (record.endAt && record.endAt <= now) return 'ended';
  if (record.startAt && record.startAt <= now) return 'ongoing';
  return 'upcoming';
}

const registrationOpen = (record: EventRecord, now: Date) =>
  !record.registrationDeadline || record.registrationDeadline > now;

/** The one action the detail page offers. */
function ctaFor(record: EventRecord, booking: BookingRecord | null, now: Date): EventCta {
  const phase = phaseOf(record, now);
  if (phase === 'cancelled') return { kind: 'cancelled' };
  if (phase === 'ended') return { kind: 'ended' };
  if (record.bookingMode === 'none') return { kind: 'none' };
  if (record.bookingMode === 'free_registration' && booking?.source === 'internal' && booking.status === 'confirmed') {
    return { kind: 'registered' };
  }
  if (!registrationOpen(record, now)) return { kind: 'registration_closed' };
  if (record.availability === 'sold_out') return { kind: 'sold_out' };
  return record.bookingMode === 'free_registration' ? { kind: 'register' } : { kind: 'external', free: record.isFree };
}

function toCard(record: EventRecord, now: Date): EventCard {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    coverId: record.coverId,
    coverAlt: record.coverAlt,
    type: record.type,
    // A live event is complete — publishing checks it — so it has both times.
    startAt: iso(record.startAt) ?? '',
    endAt: iso(record.endAt) ?? '',
    city: record.city,
    venueName: record.venueName,
    categories: record.categories.map(({ slug, name, icon }) => ({ slug, name, icon })),
    worlds: record.worlds.filter((world) => world.isActive).map(({ slug, name }) => ({ slug, name })),
    startingPriceToman: record.startingPriceToman,
    isFree: record.isFree,
    phase: phaseOf(record, now),
    availability: record.availability,
    interested: record.interested,
    bookingStatus: record.bookingStatus,
  };
}

const toBooking = (booking: BookingRecord): MyEventBooking => ({ ...booking, createdAt: booking.createdAt.toISOString() });

function toDetail(
  record: EventRecord,
  state: { interest: { remindInApp: boolean } | null; booking: BookingRecord | null },
  now: Date
): EventDetail {
  const confirmed = state.booking?.status === 'confirmed';
  const hasVenue = record.type !== 'online';
  const hasOnline = record.type !== 'physical';
  return {
    ...toCard(record, now),
    description: record.description,
    gallery: record.gallery,
    timeZone: record.timeZone,
    registrationDeadline: iso(record.registrationDeadline),
    venue: hasVenue
      ? { name: record.venueName, city: record.city, address: record.address, latitude: record.latitude, longitude: record.longitude }
      : null,
    // The link to join is for those who may join: an open event, or a confirmed booking.
    online: hasOnline
      ? { instructions: record.onlineInstructions, url: record.bookingMode === 'none' || confirmed ? record.onlineUrl : null }
      : null,
    organizer: record.organizerName
      ? { name: record.organizerName, logoId: record.organizerLogoId, contact: record.organizerContact }
      : null,
    bookingMode: record.bookingMode,
    tickets: record.tickets.map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      priceToman: ticket.priceToman,
      capacity: ticket.capacity,
      benefits: ticket.benefits,
      availability: ticket.availability,
    })),
    interest: state.interest,
    booking: state.booking ? toBooking(state.booking) : null,
    cta: ctaFor(record, state.booking, now),
  };
}

function toAdminSummary(record: EventRecord, now: Date): AdminEventSummary {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    status: effectiveStatus(record, now),
    visibility: record.visibility,
    type: record.type,
    startAt: iso(record.startAt),
    endAt: iso(record.endAt),
    publishAt: iso(record.publishAt),
    organizerName: record.organizerName,
    worlds: record.worlds.map(({ id, name }) => ({ id, name })),
    categories: record.categories.map(({ id, name }) => ({ id, name })),
    interestCount: record.interestCount,
    bookingCount: record.bookingCount,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toAdminDetail(record: EventRecord, now: Date): AdminEventDetail {
  return {
    id: record.id,
    status: effectiveStatus(record, now),
    publishAt: iso(record.publishAt),
    title: record.title,
    slug: record.slug,
    summary: record.summary,
    description: record.description,
    type: record.type,
    categoryIds: record.categories.map((category) => category.id),
    coverId: record.coverId,
    coverAlt: record.coverAlt,
    gallery: record.gallery,
    visibility: record.visibility,
    worldIds: record.worlds.map((world) => world.id),
    audience: record.audience,
    startAt: iso(record.startAt),
    endAt: iso(record.endAt),
    timeZone: record.timeZone,
    registrationDeadline: iso(record.registrationDeadline),
    venueName: record.venueName,
    city: record.city,
    address: record.address,
    latitude: record.latitude,
    longitude: record.longitude,
    onlineUrl: record.onlineUrl,
    onlineInstructions: record.onlineInstructions,
    organizerName: record.organizerName,
    organizerLogoId: record.organizerLogoId,
    organizerContact: record.organizerContact,
    bookingMode: record.bookingMode,
    externalBookingUrl: record.externalBookingUrl,
    partnerRef: record.partnerRef,
    capacity: record.capacity,
    tickets: record.tickets,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

const toCategory = (record: CategoryRecord): EventCategory => ({
  id: record.id,
  slug: record.slug,
  name: record.name,
  description: record.description,
  icon: record.icon,
  imageId: record.imageId,
});

const toAdminCategory = (record: CategoryRecord): AdminEventCategory => ({
  ...toCategory(record),
  position: record.position,
  isActive: record.isActive,
  eventCount: record.eventCount,
});

/** The editor's fields back from a stored event, for the publish check. */
const fieldsOf = (record: EventRecord): EventFields => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, status, publishAt, createdAt, updatedAt, ...fields } = toAdminDetail(record, new Date());
  return fields;
};

function assertPublishable(fields: EventFields): void {
  const problems = eventPublishProblems(fields);
  if (problems.length > 0) {
    throw new AppError(400, CODES.EVENT_INCOMPLETE, problems[0].message, {
      fields: Object.fromEntries(problems.map((problem) => [problem.field, problem.message])),
    });
  }
}

/** An event the product can see must stay complete; a draft may be anything. */
const mustStayComplete = (status: EventStoredStatus) => status === 'published' || status === 'cancelled';

/** Every library file the event points at must be an image. */
async function checkMedia(fields: EventFields): Promise<void> {
  await mediaService.requireImages({
    coverId: fields.coverId,
    organizerLogoId: fields.organizerLogoId,
    ...Object.fromEntries(fields.gallery.map((item, index) => [`gallery.${index}.mediaId`, item.mediaId])),
  });
}

/** What a notification about a changed event compares: its times and where it is. */
const changeView = (record: EventRecord) => ({
  id: record.id,
  title: record.title,
  startAt: record.startAt,
  endAt: record.endAt,
  venue: record.type === 'online' ? '' : [record.venueName, record.address, record.city].join('|'),
});

const newSlug = () => `event-${randomUUID().slice(0, 8)}`;

/** An event's status in the content index's words. */
function indexStatus(record: EventRecord, now: Date): ContentStatus {
  const status = effectiveStatus(record, now);
  if (status === 'cancelled' || (status === 'published' && phaseOf(record, now) === 'ended')) return 'ended';
  return status;
}

/** `records` in the order of `ids`; ids with no record are dropped. */
function inOrder(records: EventRecord[], ids: string[]): EventRecord[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Which stored statuses each action may start from, and where it goes. */
const TRANSITIONS: Record<EventStatusAction, { to: EventStoredStatus; from: EventStoredStatus[] }> = {
  // From `published` too: changing a scheduled time.
  publish: { to: 'published', from: ['draft', 'unpublished', 'published'] },
  unpublish: { to: 'unpublished', from: ['published'] },
  cancel: { to: 'cancelled', from: ['published'] },
  archive: { to: 'archived', from: ['draft', 'published', 'unpublished', 'cancelled'] },
};

const filterOf = (query: EventListQueryOutput | EventCalendarQueryOutput): EventFilter => ({
  q: query.q || undefined,
  category: query.category,
  type: query.type,
  world: query.world,
  city: query.city || undefined,
  price: query.price,
  available: query.available,
  interested: query.interested,
});

export const eventsService = {
  // ─── Product ───────────────────────────────────────────────────────────
  async list(user: UserRecord, query: EventListQueryOutput): Promise<Paginated<EventCard>> {
    const now = new Date();
    // «relevance» without a search has nothing to be relevant to.
    const sort: EventSort = query.sort === 'relevance' && !query.q ? 'soonest' : query.sort;
    const filter = { ...filterOf(query), from: query.from, to: query.to };
    const { items, total } = await eventsRepository().list(filter, user.id, sort, query.page, query.pageSize);
    return { items: items.map((record) => toCard(record, now)), page: query.page, pageSize: query.pageSize, total };
  },

  async calendar(user: UserRecord, query: EventCalendarQueryOutput): Promise<EventCalendarDay[]> {
    return eventsRepository().calendar(filterOf(query), user.id, query.from, query.to);
  },

  async categories(): Promise<EventCategory[]> {
    return (await eventsRepository().listCategories(true)).map(toCategory);
  },

  /** One the person may not see is a 404 — never a hint that it exists. */
  async get(user: UserRecord, slug: string): Promise<EventDetail> {
    const record = await eventsRepository().findVisible({ slug }, user.id);
    if (!record) throw notFound();
    const [interest, booking] = await Promise.all([
      eventsRepository().findInterest(record.id, user.id),
      eventsRepository().findLatestBooking(record.id, user.id),
    ]);
    return toDetail(record, { interest, booking }, new Date());
  },

  async related(user: UserRecord, slug: string): Promise<EventCard[]> {
    const record = await eventsRepository().findVisible({ slug }, user.id);
    if (!record) throw notFound();
    const now = new Date();
    return (await eventsRepository().related(record, user.id)).map((item) => toCard(item, now));
  },

  async listMine(user: UserRecord, tab: MyEventsTab): Promise<EventCard[]> {
    const now = new Date();
    return (await eventsRepository().listMine(user.id, tab)).map((record) => toCard(record, now));
  },

  async setInterest(user: UserRecord, eventId: string, remindInApp: boolean): Promise<{ remindInApp: boolean }> {
    if (!(await eventsRepository().findVisible({ id: eventId }, user.id))) throw notFound();
    await eventsRepository().setInterest(eventId, user.id, remindInApp);
    return { remindInApp };
  },

  async removeInterest(user: UserRecord, eventId: string): Promise<{ removed: true }> {
    await eventsRepository().removeInterest(eventId, user.id);
    return { removed: true };
  },

  /** A free registration in Hamdastan, inside the room left. Asking twice answers with the one already held. */
  async register(user: UserRecord, eventId: string, input: EventBookingInput): Promise<MyEventBooking> {
    const record = await eventsRepository().findVisible({ id: eventId }, user.id);
    if (!record) throw notFound();
    const booking = await eventsRepository().findLatestBooking(eventId, user.id);
    const cta = ctaFor(record, booking, new Date());
    if (cta.kind === 'registered' && booking) return toBooking(booking);
    if (record.bookingMode !== 'free_registration' || cta.kind !== 'register') throw closed(cta);

    const ticket = pickTicket(record, input.ticketOptionId);
    const outcome = await eventsRepository().register({
      eventId,
      userId: user.id,
      ticketOptionId: ticket?.id ?? null,
      quantity: input.quantity,
      totalToman: 0,
    });
    if (outcome.status === 'sold_out' || !outcome.booking) throw soldOut();
    return toBooking(outcome.booking);
  },

  async cancelRegistration(user: UserRecord, eventId: string): Promise<{ cancelled: true }> {
    if (!(await eventsRepository().cancelRegistration(eventId, user.id))) throw new NotFoundError('ثبت‌نامی پیدا نشد');
    return { cancelled: true };
  },

  /**
   * Where to buy: the partner's page, and a `pending` booking that says the
   * person went there. Nothing here — or in coming back — confirms it.
   */
  async handoff(user: UserRecord, eventId: string, input: EventBookingInput): Promise<EventHandoff> {
    const record = await eventsRepository().findVisible({ id: eventId }, user.id);
    if (!record) throw notFound();
    const cta = ctaFor(record, null, new Date());
    if (record.bookingMode !== 'external' || cta.kind !== 'external' || !record.externalBookingUrl) throw closed(cta);

    const ticket = pickTicket(record, input.ticketOptionId);
    if (ticket?.availability === 'sold_out') throw soldOut();
    const booking = await eventsRepository().openHandoff({
      eventId,
      userId: user.id,
      ticketOptionId: ticket?.id ?? null,
      quantity: input.quantity,
      totalToman: (ticket?.priceToman ?? 0) * input.quantity,
    });
    return { booking: toBooking(booking), url: record.externalBookingUrl };
  },

  // ─── For a world's home ────────────────────────────────────────────────
  /**
   * Events filed under the world that the person may see and can still
   * attend: the featured ones in their order, else the soonest. With no
   * person (an admin's preview), what anyone may see.
   */
  async worldCards(userId: string | null, worldId: string, options: { ids?: string[]; limit: number }): Promise<EventCard[]> {
    const now = new Date();
    const records = await eventsRepository().forWorld(worldId, { ids: options.ids, live: true, userId, limit: options.ids?.length ?? options.limit });
    const ordered = options.ids ? inOrder(records, options.ids) : records;
    return ordered.slice(0, options.limit).map((record) => toCard(record, now));
  },

  /** What the panel may feature: events filed under the world, in any status. */
  async worldItems(worldId: string, options: { ids?: string[]; q?: string }): Promise<WorldHomeCandidate[]> {
    const now = new Date();
    const records = await eventsRepository().forWorld(worldId, { ...options, live: false, userId: null, limit: options.ids?.length ?? 30 });
    return (options.ids ? inOrder(records, options.ids) : records).map((record) => {
      const status = indexStatus(record, now);
      // Live as the home reads it: published, its time come, not over — a restricted one reaches only its audience.
      return { id: record.id, title: record.title, status, live: status === 'published' };
    });
  },

  // ─── Admin ─────────────────────────────────────────────────────────────
  async adminList(query: AdminEventListQueryOutput): Promise<Paginated<AdminEventSummary>> {
    const now = new Date();
    const { items, total } = await eventsRepository().adminList(query);
    return { items: items.map((record) => toAdminSummary(record, now)), page: query.page, pageSize: query.pageSize, total };
  },

  async adminGet(id: string): Promise<AdminEventDetail> {
    const record = await eventsRepository().findById(id);
    if (!record) throw notFound();
    return toAdminDetail(record, new Date());
  },

  async create(actor: AdminRecord, fields: EventFields): Promise<AdminEventDetail> {
    await checkMedia(fields);
    const id = await eventsRepository().create({ ...fields, slug: fields.slug || newSlug() }, actor.id);
    return this.adminGet(id);
  },

  async update(actor: AdminRecord, id: string, fields: EventFields): Promise<AdminEventDetail> {
    const current = await eventsRepository().findById(id);
    if (!current) throw notFound();
    if (mustStayComplete(current.status)) assertPublishable(fields);
    await checkMedia(fields);
    await eventsRepository().update(id, { ...fields, slug: fields.slug || current.slug }, actor.id);
    // People who planned around a live, upcoming event hear when its time or place moves.
    const updated = await eventsRepository().findById(id);
    if (updated && current.status === 'published' && phaseOf(current, new Date()) === 'upcoming') {
      await notificationsService.eventChanged(changeView(current), changeView(updated));
    }
    return this.adminGet(id);
  },

  async changeStatus(actor: AdminRecord, id: string, action: EventStatusAction, publishAt: string | null | undefined): Promise<AdminEventDetail> {
    const current = await eventsRepository().findById(id);
    if (!current) throw notFound();
    if (action === 'publish') assertPublishable(fieldsOf(current));

    const now = new Date();
    // A time already past is «now».
    const when = action === 'publish' && publishAt && new Date(publishAt) > now ? new Date(publishAt) : null;
    const auditAction = action === 'publish' && when ? 'schedule' : action;
    const { to, from } = TRANSITIONS[action];
    if (!(await eventsRepository().setStatus(id, to, from, when, actor.id, auditAction))) {
      throw new AppError(409, CODES.EVENT_INVALID_TRANSITION, 'این تغییر وضعیت برای این رویداد ممکن نیست');
    }
    if (action === 'cancel') await notificationsService.eventCancelled(id);
    return this.adminGet(id);
  },

  async duplicate(actor: AdminRecord, id: string): Promise<AdminEventDetail> {
    const copy = await eventsRepository().duplicate(id, newSlug(), actor.id);
    if (!copy) throw notFound();
    return this.adminGet(copy);
  },

  /** The detail page as a person would see it, whatever the status — nothing is recorded. */
  async preview(id: string): Promise<EventDetail> {
    const record = await eventsRepository().findById(id);
    if (!record) throw notFound();
    const now = new Date();
    return {
      ...toDetail(record, { interest: null, booking: null }, now),
      preview: { status: effectiveStatus(record, now), visibility: record.visibility },
    };
  },

  async history(id: string): Promise<AdminEventHistoryEntry[]> {
    return (await eventsRepository().history(id)).map((row) => ({
      id: row.id,
      action: row.action,
      admin: row.adminName,
      details: row.details,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  async previewAudience(audience: ActivityAudience): Promise<{ eligible: number }> {
    return engagementService.previewAudience(audience);
  },

  async listBookings(eventId: string, page: number, pageSize: number): Promise<Paginated<AdminEventBooking>> {
    const { items, total } = await eventsRepository().listBookings(eventId, page, pageSize);
    return {
      items: items.map((row) => ({
        id: row.id,
        person: { name: [row.firstName, row.lastName].filter(Boolean).join(' '), phone: row.phone },
        status: row.status,
        source: row.source,
        quantity: row.quantity,
        ticketTitle: row.ticketTitle,
        totalToman: row.totalToman,
        externalRef: row.externalRef,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      page,
      pageSize,
      total,
    };
  },

  async reviewBooking(
    actor: AdminRecord,
    bookingId: string,
    input: { status: 'confirmed' | 'failed' | 'cancelled'; externalRef: string }
  ): Promise<{ updated: true }> {
    if (!(await eventsRepository().reviewBooking(bookingId, input.status, input.externalRef, actor.id))) {
      throw new AppError(409, CODES.EVENT_INVALID_TRANSITION, 'وضعیت فعلی این رزرو قابل تغییر نیست');
    }
    // The partner's answer, recorded by an operator, is the verified outcome — the person hears it.
    await notificationsService.bookingReviewed(bookingId, input.status);
    return { updated: true };
  },

  // ─── Categories ────────────────────────────────────────────────────────
  async adminCategories(): Promise<AdminEventCategory[]> {
    return (await eventsRepository().listCategories(false)).map(toAdminCategory);
  },

  async createCategory(actor: AdminRecord, fields: EventCategoryInputOutput): Promise<AdminEventCategory> {
    await mediaService.requireImages({ imageId: fields.imageId });
    const id = await eventsRepository().createCategory(fields, actor.id);
    return toAdminCategory((await eventsRepository().findCategory(id))!);
  },

  async updateCategory(actor: AdminRecord, id: string, fields: EventCategoryInputOutput): Promise<AdminEventCategory> {
    await mediaService.requireImages({ imageId: fields.imageId });
    if (!(await eventsRepository().updateCategory(id, fields, actor.id))) throw new NotFoundError('دسته یافت نشد');
    return toAdminCategory((await eventsRepository().findCategory(id))!);
  },

  async reorderCategories(ids: string[]): Promise<AdminEventCategory[]> {
    await eventsRepository().reorderCategories(ids);
    return this.adminCategories();
  },

  /** Only a category no event is filed under; otherwise switch it off. */
  async removeCategory(actor: AdminRecord, id: string): Promise<{ deleted: true }> {
    const outcome = await eventsRepository().removeCategory(id, actor.id);
    if (outcome === 'not_found') throw new NotFoundError('دسته یافت نشد');
    if (outcome === 'in_use') {
      throw new AppError(409, CODES.EVENT_CATEGORY_IN_USE, 'این دسته رویداد دارد؛ به‌جای حذف، آن را غیرفعال کنید');
    }
    return { deleted: true };
  },
};

/** The ticket chosen, which must be the event's own; required when the event lists any. */
function pickTicket(record: EventRecord, ticketOptionId: string | null) {
  if (!ticketOptionId) {
    if (record.tickets.length > 0) throw new ValidationError('نوع بلیت رو انتخاب کن', { fields: { ticketOptionId: 'نوع بلیت رو انتخاب کن' } });
    return null;
  }
  const ticket = record.tickets.find((item) => item.id === ticketOptionId);
  if (!ticket) throw new ValidationError('این بلیت برای این رویداد نیست', { fields: { ticketOptionId: 'این بلیت برای این رویداد نیست' } });
  return ticket;
}

const soldOut = () => new AppError(409, CODES.EVENT_SOLD_OUT, 'ظرفیت این رویداد تکمیل شده');

function closed(cta: EventCta): AppError {
  if (cta.kind === 'sold_out') return soldOut();
  return new AppError(409, CODES.EVENT_BOOKING_CLOSED, 'ثبت‌نام این رویداد باز نیست');
}
