import { APP_TIME_ZONE, EVENT_LIMITS } from '@hamdastan/config';
import type { EventSort, EventStoredStatus, MyEventsTab } from '@hamdastan/types';

import { audienceMatch, query, queryOne, withTransaction, type DbClient } from '../../data';
import { AppError, ValidationError } from '../../shared/errors';
import { createRepositorySlot } from '../../shared/repository';

import type {
  AdminBookingRecord,
  BookingRecord,
  BookingWrite,
  CategoryRecord,
  EventFields,
  EventFilter,
  EventRecord,
  HistoryRecord,
} from './events.types';

/**
 * Data access port for the Events module, and the PostgreSQL adapter that
 * satisfies it (`v2_event*`).
 *
 * Who may see an event is decided here, in SQL, by one rule (`visible`) that
 * every product read goes through — lists, the calendar, counts, related
 * events, «رویدادهای من» and the detail page. Nothing is fetched first and
 * filtered later, so a restricted event cannot leak through a count or a
 * date dot.
 */
export interface EventsRepository {
  // ─── Product ───────────────────────────────────────────────────
  list(filter: EventFilter, userId: string, sort: EventSort, page: number, pageSize: number): Promise<{ items: EventRecord[]; total: number }>;
  /** Tehran days in [from, to] with events matching the filter, multi-day events on every day they cover. */
  calendar(filter: EventFilter, userId: string, from: string, to: string): Promise<{ date: string; count: number }[]>;
  /** By slug, if the person may see it — from any surface. */
  findVisible(slugOrId: { slug: string } | { id: string }, userId: string): Promise<EventRecord | null>;
  related(event: EventRecord, userId: string): Promise<EventRecord[]>;
  listMine(userId: string, tab: MyEventsTab): Promise<EventRecord[]>;
  findInterest(eventId: string, userId: string): Promise<{ remindInApp: boolean } | null>;
  findLatestBooking(eventId: string, userId: string): Promise<BookingRecord | null>;
  setInterest(eventId: string, userId: string, remindInApp: boolean): Promise<void>;
  removeInterest(eventId: string, userId: string): Promise<void>;
  /** A confirmed registration, inside the room left; the one they already hold if any. */
  register(write: BookingWrite): Promise<{ status: 'registered' | 'sold_out'; booking?: BookingRecord }>;
  cancelRegistration(eventId: string, userId: string): Promise<boolean>;
  /** The person's one open handoff to the partner, created or refreshed. Always `pending`. */
  openHandoff(write: BookingWrite): Promise<BookingRecord>;

  // ─── Admin ─────────────────────────────────────────────────────
  adminList(query: {
    search?: string;
    status?: string;
    visibility?: string;
    world?: string;
    category?: string;
    sort: 'updated' | 'start';
    page: number;
    pageSize: number;
  }): Promise<{ items: EventRecord[]; total: number }>;
  findById(id: string): Promise<EventRecord | null>;
  create(fields: EventFields, adminId: string): Promise<string>;
  update(id: string, fields: EventFields, adminId: string): Promise<boolean>;
  /** Moves the status only from one of `from`; false when it was in none of them. */
  setStatus(id: string, to: EventStoredStatus, from: EventStoredStatus[], publishAt: Date | null, adminId: string, action: string): Promise<boolean>;
  duplicate(id: string, slug: string, adminId: string): Promise<string>;
  history(id: string): Promise<HistoryRecord[]>;
  listBookings(eventId: string, page: number, pageSize: number): Promise<{ items: AdminBookingRecord[]; total: number }>;
  /** Records the partner's answer on a pending booking, or cancels a confirmed one. */
  reviewBooking(bookingId: string, status: 'confirmed' | 'failed' | 'cancelled', externalRef: string, adminId: string): Promise<boolean>;

  // ─── Categories ────────────────────────────────────────────────
  listCategories(activeOnly: boolean): Promise<CategoryRecord[]>;
  findCategory(id: string): Promise<CategoryRecord | null>;
  createCategory(fields: CategoryFields, adminId: string): Promise<string>;
  updateCategory(id: string, fields: CategoryFields, adminId: string): Promise<boolean>;
  reorderCategories(ids: string[]): Promise<void>;
  removeCategory(id: string, adminId: string): Promise<'deleted' | 'in_use' | 'not_found'>;
}

type CategoryFields = Omit<CategoryRecord, 'id' | 'position' | 'eventCount'>;

const slot = createRepositorySlot<EventsRepository>('events');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const eventsRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setEventsRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

/** `%` and `_` in a search are literal characters, not wildcards. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Collects bound parameters, answering each one's placeholder. */
function params() {
  const values: unknown[] = [];
  const add = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  return { values, add };
}

/** Midnight in Tehran at the start of a `YYYY-MM-DD` day, plus `days`. */
const dayStart = (param: string, days = 0) => `((${param}::date + ${days})::timestamp AT TIME ZONE '${APP_TIME_ZONE}')`;

/** Something the product can see at all: published (or cancelled after it) and its time has come. */
const LIVE = `e.status IN ('published', 'cancelled') AND e.publish_at <= now()`;

/** The person may see it: anything but a restricted event, or one whose audience holds them. */
const eligible = (user: string) => `(e.visibility <> 'restricted' OR EXISTS (
  SELECT 1 FROM v2_users u WHERE u.id = ${user} AND u.status = 'ACTIVE' AND ${audienceMatch('e.audience')}))`;

const visible = (user: string) => `${LIVE} AND ${eligible(user)}`;

const CONFIRMED_QUANTITY = `(SELECT coalesce(sum(b.quantity), 0) FROM v2_event_bookings b
  WHERE b.event_id = e.id AND b.status = 'confirmed')`;

/** Whether there is room. One definition: shown on the card and used by the «available» filter. */
const AVAILABILITY = `(CASE
  WHEN e.booking_mode = 'none' THEN 'none'
  WHEN e.capacity IS NOT NULL AND ${CONFIRMED_QUANTITY} >= e.capacity THEN 'sold_out'
  WHEN EXISTS (SELECT 1 FROM v2_event_ticket_options t WHERE t.event_id = e.id)
   AND NOT EXISTS (SELECT 1 FROM v2_event_ticket_options t WHERE t.event_id = e.id AND t.availability <> 'sold_out')
    THEN 'sold_out'
  WHEN EXISTS (SELECT 1 FROM v2_event_ticket_options t WHERE t.event_id = e.id AND t.availability = 'limited') THEN 'limited'
  ELSE 'available' END)`;

const STARTING_PRICE = `(SELECT min(t.price_toman) FROM v2_event_ticket_options t WHERE t.event_id = e.id AND t.price_toman > 0)`;

/** No ticket costs anything — and a partner booking with no tickets listed is not assumed free. */
const IS_FREE = `(NOT EXISTS (SELECT 1 FROM v2_event_ticket_options t WHERE t.event_id = e.id AND t.price_toman > 0)
  AND (e.booking_mode <> 'external' OR EXISTS (SELECT 1 FROM v2_event_ticket_options t WHERE t.event_id = e.id)))`;

/** The person can still take part: live, not over, room left, registration open. */
const OPEN = `(e.status = 'published' AND e.end_at > now()
  AND (e.registration_deadline IS NULL OR e.registration_deadline > now())
  AND ${AVAILABILITY} <> 'sold_out')`;

/** Every column an `EventRecord` needs, related rows as JSON, in one statement. */
const columns = (user: string) => `
  e.id, e.slug, e.title, e.summary, e.description, e.event_type, e.cover_media_id, e.cover_alt,
  e.start_at, e.end_at, e.time_zone, e.registration_deadline, e.venue_name, e.city, e.address,
  e.latitude::float8 AS latitude, e.longitude::float8 AS longitude, e.online_url, e.online_instructions,
  e.organizer_name, e.organizer_logo_media_id, e.organizer_contact, e.booking_mode, e.external_booking_url,
  e.partner_ref, e.capacity, e.status, e.publish_at, e.visibility, e.audience, e.created_at, e.updated_at,
  (SELECT coalesce(json_agg(json_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'icon', c.icon)
            ORDER BY c.position, c.name), '[]')
     FROM v2_event_category_links cl JOIN v2_event_categories c ON c.id = cl.category_id
    WHERE cl.event_id = e.id) AS categories,
  (SELECT coalesce(json_agg(json_build_object('id', w.id, 'slug', w.slug, 'name', w.name, 'isActive', w.is_active)
            ORDER BY w.position, w.name), '[]')
     FROM v2_event_world_links wl JOIN v2_worlds w ON w.id = wl.world_id
    WHERE wl.event_id = e.id) AS worlds,
  (SELECT coalesce(json_agg(json_build_object('mediaId', g.media_id, 'alt', g.alt) ORDER BY g.position), '[]')
     FROM v2_event_media g WHERE g.event_id = e.id) AS gallery,
  (SELECT coalesce(json_agg(json_build_object(
            'id', t.id, 'title', t.title, 'description', t.description, 'priceToman', t.price_toman,
            'capacity', t.capacity, 'benefits', t.benefits, 'availability', t.availability,
            'externalId', t.external_id) ORDER BY t.position), '[]')
     FROM v2_event_ticket_options t WHERE t.event_id = e.id) AS tickets,
  (SELECT count(*) FROM v2_event_interests i WHERE i.event_id = e.id)::int AS interest_count,
  (SELECT count(*) FROM v2_event_bookings b WHERE b.event_id = e.id AND b.status <> 'cancelled')::int AS booking_count,
  ${AVAILABILITY} AS availability,
  ${STARTING_PRICE} AS starting_price,
  ${IS_FREE} AS is_free,
  EXISTS (SELECT 1 FROM v2_event_interests i WHERE i.event_id = e.id AND i.user_id = ${user}) AS interested,
  (SELECT b.status FROM v2_event_bookings b
    WHERE b.event_id = e.id AND b.user_id = ${user} AND b.status <> 'cancelled'
    ORDER BY b.created_at DESC LIMIT 1) AS booking_status`;

/** No person: the panel's reads. */
const NOBODY = 'NULL::uuid';

type Row = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  event_type: EventRecord['type'];
  cover_media_id: string | null;
  cover_alt: string;
  start_at: Date | null;
  end_at: Date | null;
  time_zone: string;
  registration_deadline: Date | null;
  venue_name: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  online_url: string | null;
  online_instructions: string;
  organizer_name: string;
  organizer_logo_media_id: string | null;
  organizer_contact: string;
  booking_mode: EventRecord['bookingMode'];
  external_booking_url: string | null;
  partner_ref: string;
  capacity: number | null;
  status: EventStoredStatus;
  publish_at: Date | null;
  visibility: EventRecord['visibility'];
  audience: EventRecord['audience'];
  created_at: Date;
  updated_at: Date;
  categories: EventRecord['categories'];
  worlds: EventRecord['worlds'];
  gallery: EventRecord['gallery'];
  tickets: EventRecord['tickets'];
  interest_count: number;
  booking_count: number;
  availability: EventRecord['availability'];
  starting_price: number | null;
  is_free: boolean;
  interested: boolean;
  booking_status: EventRecord['bookingStatus'];
};

const toRecord = (row: Row): EventRecord => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  description: row.description,
  type: row.event_type,
  coverId: row.cover_media_id,
  coverAlt: row.cover_alt,
  startAt: row.start_at,
  endAt: row.end_at,
  timeZone: row.time_zone,
  registrationDeadline: row.registration_deadline,
  venueName: row.venue_name,
  city: row.city,
  address: row.address,
  latitude: row.latitude,
  longitude: row.longitude,
  onlineUrl: row.online_url,
  onlineInstructions: row.online_instructions,
  organizerName: row.organizer_name,
  organizerLogoId: row.organizer_logo_media_id,
  organizerContact: row.organizer_contact,
  bookingMode: row.booking_mode,
  externalBookingUrl: row.external_booking_url,
  partnerRef: row.partner_ref,
  capacity: row.capacity,
  status: row.status,
  publishAt: row.publish_at,
  visibility: row.visibility,
  audience: row.audience,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  categories: row.categories,
  worlds: row.worlds,
  gallery: row.gallery,
  tickets: row.tickets,
  interestCount: row.interest_count,
  bookingCount: row.booking_count,
  availability: row.availability,
  startingPriceToman: row.starting_price,
  isFree: row.is_free,
  interested: row.interested,
  bookingStatus: row.booking_status,
});

type BookingRow = {
  id: string;
  status: BookingRecord['status'];
  source: BookingRecord['source'];
  quantity: number;
  ticket_title: string | null;
  total_toman: number;
  created_at: Date;
};

const BOOKING_COLUMNS = `b.id, b.status, b.source, b.quantity, t.title AS ticket_title, b.total_toman, b.created_at`;
const BOOKING_FROM = `FROM v2_event_bookings b LEFT JOIN v2_event_ticket_options t ON t.id = b.ticket_option_id`;

const toBooking = (row: BookingRow): BookingRecord => ({
  id: row.id,
  status: row.status,
  source: row.source,
  quantity: row.quantity,
  ticketTitle: row.ticket_title,
  totalToman: row.total_toman,
  createdAt: row.created_at,
});

/**
 * The filters, as SQL over `e`. `world` narrows to that world and lets its
 * world-only events in; without it, world-only events stay out — they are
 * never part of global discovery.
 */
function filterClauses(filter: EventFilter, user: string, add: (value: unknown) => string): string[] {
  const clauses = [visible(user)];

  if (filter.world) {
    clauses.push(`EXISTS (SELECT 1 FROM v2_event_world_links wl JOIN v2_worlds w ON w.id = wl.world_id
      WHERE wl.event_id = e.id AND w.slug = ${add(filter.world)} AND w.is_active)`);
  } else {
    clauses.push(`e.visibility <> 'world'`);
  }
  if (filter.q) {
    const like = add(`%${escapeLike(filter.q)}%`);
    clauses.push(`(e.title ILIKE ${like} OR e.summary ILIKE ${like} OR e.venue_name ILIKE ${like}
      OR e.city ILIKE ${like} OR e.organizer_name ILIKE ${like})`);
  }
  if (filter.category?.length) {
    clauses.push(`EXISTS (SELECT 1 FROM v2_event_category_links cl JOIN v2_event_categories c ON c.id = cl.category_id
      WHERE cl.event_id = e.id AND c.slug = ANY(${add(filter.category)}::text[]))`);
  }
  if (filter.type?.length) clauses.push(`e.event_type = ANY(${add(filter.type)}::v2_event_type[])`);
  if (filter.city) clauses.push(`lower(e.city) = lower(${add(filter.city)})`);
  if (filter.price === 'free') clauses.push(IS_FREE);
  if (filter.price === 'paid') {
    clauses.push(`EXISTS (SELECT 1 FROM v2_event_ticket_options t WHERE t.event_id = e.id AND t.price_toman > 0)`);
  }
  if (filter.available) clauses.push(OPEN);
  if (filter.interested) {
    clauses.push(`EXISTS (SELECT 1 FROM v2_event_interests i WHERE i.event_id = e.id AND i.user_id = ${user})`);
  }
  // A date range shows what overlaps it, ended or not; without one, what is not over yet.
  if (filter.from || filter.to) {
    if (filter.from) clauses.push(`e.end_at > ${dayStart(add(filter.from))}`);
    if (filter.to) clauses.push(`e.start_at < ${dayStart(add(filter.to), 1)}`);
  } else {
    clauses.push(`e.end_at > now()`);
  }
  return clauses;
}

function orderBy(sort: EventSort, q: string | undefined, add: (value: unknown) => string): string {
  switch (sort) {
    case 'newest':
      return 'x.publish_at DESC, x.id';
    case 'popular':
      return 'x.interest_count DESC, x.start_at, x.id';
    case 'price':
      return 'x.starting_price ASC NULLS LAST, x.start_at, x.id';
    case 'relevance':
      if (q) {
        const prefix = add(`${escapeLike(q)}%`);
        const anywhere = add(`%${escapeLike(q)}%`);
        return `CASE WHEN x.title ILIKE ${prefix} THEN 0 WHEN x.title ILIKE ${anywhere} THEN 1 ELSE 2 END, x.start_at, x.id`;
      }
      return 'x.start_at, x.id';
    default:
      return 'x.start_at, x.id';
  }
}

const rethrowWrite = (error: unknown): never => {
  const code = (error as { code?: string }).code;
  if (code === UNIQUE_VIOLATION) throw new AppError(409, 'EVENT_SLUG_TAKEN', 'این نامک برای رویداد دیگه‌ای ثبت شده');
  if (code === FOREIGN_KEY_VIOLATION) throw new ValidationError('دسته یا دنیای انتخاب‌شده دیگه وجود نداره؛ دوباره انتخاب کن');
  throw error;
};

async function audit(
  client: DbClient | null,
  entity: 'event' | 'category' | 'booking',
  entityId: string,
  adminId: string,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  const sql = `INSERT INTO v2_event_audit_log (entity, entity_id, admin_id, action, details) VALUES ($1, $2, $3, $4, $5)`;
  const values = [entity, entityId, adminId, action, details];
  if (client) await client.query(sql, values);
  else await query(sql, values);
}

/** The event's columns, in the order `writeEvent` binds them. */
const EVENT_FIELDS = [
  'slug', 'title', 'summary', 'description', 'event_type', 'cover_media_id', 'cover_alt', 'start_at', 'end_at',
  'time_zone', 'registration_deadline', 'venue_name', 'city', 'address', 'latitude', 'longitude', 'online_url',
  'online_instructions', 'organizer_name', 'organizer_logo_media_id', 'organizer_contact', 'booking_mode',
  'external_booking_url', 'partner_ref', 'capacity', 'visibility', 'audience',
] as const;

const eventValues = (f: EventFields) => [
  f.slug, f.title, f.summary, f.description, f.type, f.coverId, f.coverAlt, f.startAt, f.endAt,
  f.timeZone, f.registrationDeadline, f.venueName, f.city, f.address, f.latitude, f.longitude, f.onlineUrl,
  f.onlineInstructions, f.organizerName, f.organizerLogoId, f.organizerContact, f.bookingMode,
  f.externalBookingUrl, f.partnerRef, f.capacity, f.visibility, f.audience,
];

/** Links, gallery and tickets: replaced as a whole, except tickets keep their ids so bookings keep pointing at them. */
async function writeRelations(client: DbClient, eventId: string, f: EventFields): Promise<void> {
  await client.query(`DELETE FROM v2_event_category_links WHERE event_id = $1`, [eventId]);
  await client.query(
    `INSERT INTO v2_event_category_links (event_id, category_id) SELECT $1, unnest($2::uuid[])`,
    [eventId, f.categoryIds]
  );
  await client.query(`DELETE FROM v2_event_world_links WHERE event_id = $1`, [eventId]);
  await client.query(`INSERT INTO v2_event_world_links (event_id, world_id) SELECT $1, unnest($2::uuid[])`, [eventId, f.worldIds]);
  await client.query(`DELETE FROM v2_event_media WHERE event_id = $1`, [eventId]);
  await client.query(
    `INSERT INTO v2_event_media (event_id, media_id, alt, position)
     SELECT $1, g.media_id, g.alt, g.ordinality FROM unnest($2::uuid[], $3::text[]) WITH ORDINALITY AS g(media_id, alt, ordinality)`,
    [eventId, f.gallery.map((item) => item.mediaId), f.gallery.map((item) => item.alt)]
  );

  const kept = f.tickets.map((ticket) => ticket.id).filter((id): id is string => Boolean(id));
  await client.query(`DELETE FROM v2_event_ticket_options WHERE event_id = $1 AND NOT (id = ANY($2::uuid[]))`, [eventId, kept]);
  for (const [position, ticket] of f.tickets.entries()) {
    const values = [
      eventId, ticket.title, ticket.description, ticket.priceToman, ticket.capacity, ticket.benefits,
      ticket.availability, ticket.externalId, position,
    ];
    const updated = ticket.id
      ? await client.query(
          `UPDATE v2_event_ticket_options
              SET title = $2, description = $3, price_toman = $4, capacity = $5, benefits = $6,
                  availability = $7, external_id = $8, position = $9
            WHERE event_id = $1 AND id = $10`,
          [...values, ticket.id]
        )
      : null;
    if (!updated?.rowCount) {
      await client.query(
        `INSERT INTO v2_event_ticket_options
           (event_id, title, description, price_toman, capacity, benefits, availability, external_id, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        values
      );
    }
  }
}

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: CategoryRecord['icon'];
  image_media_id: string | null;
  position: number;
  is_active: boolean;
  event_count: number;
};

const CATEGORY_COLUMNS = `c.id, c.slug, c.name, c.description, c.icon, c.image_media_id, c.position, c.is_active,
  (SELECT count(*) FROM v2_event_category_links l WHERE l.category_id = c.id)::int AS event_count`;

const toCategory = (row: CategoryRow): CategoryRecord => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  icon: row.icon,
  imageId: row.image_media_id,
  position: row.position,
  isActive: row.is_active,
  eventCount: row.event_count,
});

const rethrowCategorySlug = (error: unknown): never => {
  if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
    throw new AppError(409, 'EVENT_CATEGORY_SLUG_TAKEN', 'این نامک برای دسته‌ی دیگه‌ای ثبت شده');
  }
  throw error;
};

/** The admin list's statuses: «scheduled» and «published» are one stored status split by the clock. */
const STATUS_FILTER: Record<string, string> = {
  draft: `e.status = 'draft'`,
  scheduled: `e.status = 'published' AND e.publish_at > now()`,
  published: `e.status = 'published' AND e.publish_at <= now()`,
  unpublished: `e.status = 'unpublished'`,
  cancelled: `e.status = 'cancelled'`,
  archived: `e.status = 'archived'`,
};

export const sqlEventsRepository: EventsRepository = {
  // ─── Product ───────────────────────────────────────────────────
  async list(filter, userId, sort, page, pageSize) {
    const { values, add } = params();
    const user = add(userId);
    const where = filterClauses(filter, user, add).join(' AND ');
    const order = orderBy(sort, filter.q, add);
    const rows = await query<Row & { total: number }>(
      `SELECT x.*, count(*) OVER ()::int AS total
         FROM (SELECT ${columns(user)} FROM v2_events e WHERE ${where}) x
        ORDER BY ${order}
        LIMIT ${add(pageSize)} OFFSET ${add((page - 1) * pageSize)}`,
      values
    );
    return { items: rows.map(toRecord), total: rows[0]?.total ?? 0 };
  },

  async calendar(filter, userId, from, to) {
    const { values, add } = params();
    const user = add(userId);
    const where = filterClauses({ ...filter, from, to }, user, add).join(' AND ');
    const first = add(from);
    const last = add(to);
    // The last day an event covers is the day of its last instant: one ending at midnight does not reach the next day.
    const rows = await query<{ date: string; count: number }>(
      `SELECT to_char(d, 'YYYY-MM-DD') AS date, count(*)::int AS count
         FROM v2_events e,
              generate_series(
                greatest((e.start_at AT TIME ZONE '${APP_TIME_ZONE}')::date, ${first}::date),
                least(((e.end_at - interval '1 second') AT TIME ZONE '${APP_TIME_ZONE}')::date, ${last}::date),
                interval '1 day') AS d
        WHERE ${where}
        GROUP BY d ORDER BY d`,
      values
    );
    return rows;
  },

  async findVisible(key, userId) {
    const { values, add } = params();
    const user = add(userId);
    const match = 'slug' in key ? `e.slug = ${add(key.slug)}` : `e.id = ${add(key.id)}`;
    const row = await queryOne<Row>(`SELECT ${columns(user)} FROM v2_events e WHERE ${match} AND ${visible(user)}`, values);
    return row ? toRecord(row) : null;
  },

  async related(event, userId) {
    const { values, add } = params();
    const user = add(userId);
    const id = add(event.id);
    const worldIds = add(event.worlds.map((world) => world.id));
    const categoryIds = add(event.categories.map((category) => category.id));
    // Not cancelled, not over. Shared worlds weigh more than shared categories; then the soonest, so an event
    // with nothing in common still gets the next ones. World-only events come in only
    // through a world they share with this one.
    const rows = await query<Row>(
      `SELECT x.* FROM (
         SELECT ${columns(user)},
                2 * (SELECT count(*) FROM v2_event_world_links wl WHERE wl.event_id = e.id AND wl.world_id = ANY(${worldIds}::uuid[]))
                  + (SELECT count(*) FROM v2_event_category_links cl WHERE cl.event_id = e.id AND cl.category_id = ANY(${categoryIds}::uuid[]))
                  AS score
           FROM v2_events e
          WHERE e.id <> ${id} AND ${visible(user)} AND e.status = 'published' AND e.end_at > now()
            AND (e.visibility <> 'world' OR EXISTS (
                  SELECT 1 FROM v2_event_world_links wl WHERE wl.event_id = e.id AND wl.world_id = ANY(${worldIds}::uuid[])))
       ) x
       ORDER BY x.score DESC, x.start_at, x.id
       LIMIT ${add(EVENT_LIMITS.RELATED_MAX)}`,
      values
    );
    return rows.map(toRecord);
  },

  async listMine(userId, tab) {
    const { values, add } = params();
    const user = add(userId);
    const interested = `EXISTS (SELECT 1 FROM v2_event_interests i WHERE i.event_id = e.id AND i.user_id = ${user})`;
    const booked = (statuses: string) =>
      `EXISTS (SELECT 1 FROM v2_event_bookings b WHERE b.event_id = e.id AND b.user_id = ${user} AND b.status IN (${statuses}))`;
    const where: Record<MyEventsTab, string> = {
      interested: `${interested} AND e.end_at > now()`,
      booked: `${booked(`'pending', 'confirmed'`)} AND e.end_at > now()`,
      past: `(${interested} OR ${booked(`'pending', 'confirmed'`)}) AND e.end_at <= now()`,
      soon: `e.status = 'published' AND e.start_at > now() AND e.start_at <= now() + interval '${EVENT_LIMITS.SOON_HOURS} hours'
        AND (EXISTS (SELECT 1 FROM v2_event_interests i WHERE i.event_id = e.id AND i.user_id = ${user} AND i.remind_in_app)
             OR ${booked(`'confirmed'`)})`,
    };
    const order = tab === 'past' ? 'e.start_at DESC' : 'e.start_at';
    const rows = await query<Row>(
      `SELECT ${columns(user)} FROM v2_events e WHERE ${visible(user)} AND ${where[tab]} ORDER BY ${order}, e.id LIMIT 50`,
      values
    );
    return rows.map(toRecord);
  },

  async findInterest(eventId, userId) {
    const row = await queryOne<{ remind_in_app: boolean }>(
      `SELECT remind_in_app FROM v2_event_interests WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );
    return row ? { remindInApp: row.remind_in_app } : null;
  },

  async findLatestBooking(eventId, userId) {
    const row = await queryOne<BookingRow>(
      `SELECT ${BOOKING_COLUMNS} ${BOOKING_FROM}
        WHERE b.event_id = $1 AND b.user_id = $2 AND b.status <> 'cancelled'
        ORDER BY b.created_at DESC LIMIT 1`,
      [eventId, userId]
    );
    return row ? toBooking(row) : null;
  },

  async setInterest(eventId, userId, remindInApp) {
    await query(
      `INSERT INTO v2_event_interests (user_id, event_id, remind_in_app) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, event_id) DO UPDATE SET remind_in_app = EXCLUDED.remind_in_app`,
      [userId, eventId, remindInApp]
    );
  },

  async removeInterest(eventId, userId) {
    await query(`DELETE FROM v2_event_interests WHERE event_id = $1 AND user_id = $2`, [eventId, userId]);
  },

  async register(write) {
    return withTransaction(async (client) => {
      // The event row is the lock: two registrations for the last place cannot both see it free.
      const event = await client.query<{ capacity: number | null }>(`SELECT capacity FROM v2_events WHERE id = $1 FOR UPDATE`, [
        write.eventId,
      ]);
      const existing = await client.query<BookingRow>(
        `SELECT ${BOOKING_COLUMNS} ${BOOKING_FROM}
          WHERE b.event_id = $1 AND b.user_id = $2 AND b.source = 'internal' AND b.status = 'confirmed'`,
        [write.eventId, write.userId]
      );
      if (existing.rows[0]) return { status: 'registered' as const, booking: toBooking(existing.rows[0]) };

      const taken = await client.query<{ event_total: number; ticket_total: number; ticket_capacity: number | null }>(
        `SELECT
           (SELECT coalesce(sum(quantity), 0) FROM v2_event_bookings WHERE event_id = $1 AND status = 'confirmed')::int AS event_total,
           (SELECT coalesce(sum(quantity), 0) FROM v2_event_bookings WHERE ticket_option_id = $2 AND status = 'confirmed')::int AS ticket_total,
           (SELECT capacity FROM v2_event_ticket_options WHERE id = $2) AS ticket_capacity`,
        [write.eventId, write.ticketOptionId]
      );
      const { event_total, ticket_total, ticket_capacity } = taken.rows[0];
      const capacity = event.rows[0]?.capacity ?? null;
      if (
        (capacity !== null && event_total + write.quantity > capacity) ||
        (ticket_capacity !== null && ticket_total + write.quantity > ticket_capacity)
      ) {
        return { status: 'sold_out' as const };
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO v2_event_bookings (user_id, event_id, ticket_option_id, quantity, total_toman, source, status)
         VALUES ($1, $2, $3, $4, $5, 'internal', 'confirmed') RETURNING id`,
        [write.userId, write.eventId, write.ticketOptionId, write.quantity, write.totalToman]
      );
      const row = await client.query<BookingRow>(`SELECT ${BOOKING_COLUMNS} ${BOOKING_FROM} WHERE b.id = $1`, [inserted.rows[0].id]);
      return { status: 'registered' as const, booking: toBooking(row.rows[0]) };
    });
  },

  async cancelRegistration(eventId, userId) {
    const rows = await query(
      `UPDATE v2_event_bookings SET status = 'cancelled', updated_at = now()
        WHERE event_id = $1 AND user_id = $2 AND source = 'internal' AND status = 'confirmed' RETURNING id`,
      [eventId, userId]
    );
    return rows.length > 0;
  },

  async openHandoff(write) {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO v2_event_bookings (user_id, event_id, ticket_option_id, quantity, total_toman, source, status)
       VALUES ($1, $2, $3, $4, $5, 'external', 'pending')
       ON CONFLICT (user_id, event_id) WHERE source = 'external' AND status = 'pending'
       DO UPDATE SET ticket_option_id = EXCLUDED.ticket_option_id, quantity = EXCLUDED.quantity,
                     total_toman = EXCLUDED.total_toman, updated_at = now()
       RETURNING id`,
      [write.userId, write.eventId, write.ticketOptionId, write.quantity, write.totalToman]
    );
    const booking = await queryOne<BookingRow>(`SELECT ${BOOKING_COLUMNS} ${BOOKING_FROM} WHERE b.id = $1`, [row!.id]);
    return toBooking(booking!);
  },

  // ─── Admin ─────────────────────────────────────────────────────
  async adminList({ search, status, visibility, world, category, sort, page, pageSize }) {
    const { values, add } = params();
    const clauses: string[] = [];
    if (search) {
      const like = add(`%${escapeLike(search)}%`);
      clauses.push(`(e.title ILIKE ${like} OR e.slug ILIKE ${like} OR e.organizer_name ILIKE ${like})`);
    }
    if (status) clauses.push(STATUS_FILTER[status]);
    if (visibility) clauses.push(`e.visibility = ${add(visibility)}::v2_event_visibility`);
    if (world) clauses.push(`EXISTS (SELECT 1 FROM v2_event_world_links wl WHERE wl.event_id = e.id AND wl.world_id = ${add(world)})`);
    if (category) {
      clauses.push(`EXISTS (SELECT 1 FROM v2_event_category_links cl WHERE cl.event_id = e.id AND cl.category_id = ${add(category)})`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const order = sort === 'start' ? 'e.start_at ASC NULLS LAST, e.id' : 'e.updated_at DESC, e.id';
    const rows = await query<Row & { total: number }>(
      `SELECT ${columns(NOBODY)}, count(*) OVER ()::int AS total FROM v2_events e ${where}
        ORDER BY ${order} LIMIT ${add(pageSize)} OFFSET ${add((page - 1) * pageSize)}`,
      values
    );
    return { items: rows.map(toRecord), total: rows[0]?.total ?? 0 };
  },

  async findById(id) {
    const row = await queryOne<Row>(`SELECT ${columns(NOBODY)} FROM v2_events e WHERE e.id = $1`, [id]);
    return row ? toRecord(row) : null;
  },

  async create(fields, adminId) {
    try {
      return await withTransaction(async (client) => {
        const placeholders = EVENT_FIELDS.map((_, index) => `$${index + 1}`).join(', ');
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO v2_events (${EVENT_FIELDS.join(', ')}, created_by, updated_by)
           VALUES (${placeholders}, $${EVENT_FIELDS.length + 1}, $${EVENT_FIELDS.length + 1}) RETURNING id`,
          [...eventValues(fields), adminId]
        );
        const id = inserted.rows[0].id;
        await writeRelations(client, id, fields);
        await audit(client, 'event', id, adminId, 'create', { title: fields.title });
        return id;
      });
    } catch (error) {
      return rethrowWrite(error);
    }
  },

  async update(id, fields, adminId) {
    try {
      return await withTransaction(async (client) => {
        const sets = EVENT_FIELDS.map((column, index) => `${column} = $${index + 2}`).join(', ');
        const updated = await client.query(
          `UPDATE v2_events SET ${sets}, updated_by = $${EVENT_FIELDS.length + 2}, updated_at = now() WHERE id = $1`,
          [id, ...eventValues(fields), adminId]
        );
        if (!updated.rowCount) return false;
        await writeRelations(client, id, fields);
        await audit(client, 'event', id, adminId, 'update', { title: fields.title, visibility: fields.visibility });
        return true;
      });
    } catch (error) {
      return rethrowWrite(error);
    }
  },

  async setStatus(id, to, from, publishAt, adminId, action) {
    return withTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE v2_events
            SET status = $2::v2_event_status,
                publish_at = CASE WHEN $2::v2_event_status = 'published' THEN coalesce($4::timestamptz, now()) ELSE publish_at END,
                updated_by = $5, updated_at = now()
          WHERE id = $1 AND status = ANY($3::v2_event_status[])`,
        [id, to, from, publishAt, adminId]
      );
      if (!updated.rowCount) return false;
      await audit(client, 'event', id, adminId, action, publishAt ? { publishAt: publishAt.toISOString() } : {});
      return true;
    });
  },

  async duplicate(id, slug, adminId) {
    return withTransaction(async (client) => {
      const copied = await client.query<{ id: string }>(
        `INSERT INTO v2_events (${EVENT_FIELDS.join(', ')}, created_by, updated_by)
         SELECT ${EVENT_FIELDS.map((column) =>
           column === 'slug' ? '$2' : column === 'title' ? `left(title || ' (کپی)', 120)` : column
         ).join(', ')}, $3, $3
           FROM v2_events WHERE id = $1 RETURNING id`,
        [id, slug, adminId]
      );
      const copy = copied.rows[0]?.id;
      if (!copy) return '';
      await client.query(`INSERT INTO v2_event_category_links SELECT $2, category_id FROM v2_event_category_links WHERE event_id = $1`, [id, copy]);
      await client.query(`INSERT INTO v2_event_world_links SELECT $2, world_id FROM v2_event_world_links WHERE event_id = $1`, [id, copy]);
      await client.query(
        `INSERT INTO v2_event_media (event_id, media_id, position, alt) SELECT $2, media_id, position, alt FROM v2_event_media WHERE event_id = $1`,
        [id, copy]
      );
      await client.query(
        `INSERT INTO v2_event_ticket_options
           (event_id, title, description, price_toman, capacity, benefits, availability, external_id, position)
         SELECT $2, title, description, price_toman, capacity, benefits, availability, external_id, position
           FROM v2_event_ticket_options WHERE event_id = $1`,
        [id, copy]
      );
      await audit(client, 'event', copy, adminId, 'duplicate', { from: id });
      return copy;
    });
  },

  async history(id) {
    const rows = await query<{ id: string; action: string; admin_name: string | null; details: Record<string, unknown>; created_at: Date }>(
      `SELECT l.id::text, l.action, nullif(trim(a.first_name || ' ' || a.last_name), '') AS admin_name, l.details, l.created_at
         FROM v2_event_audit_log l LEFT JOIN v2_admin_users a ON a.id = l.admin_id
        WHERE l.entity = 'event' AND l.entity_id = $1
        ORDER BY l.created_at DESC, l.id DESC LIMIT 100`,
      [id]
    );
    return rows.map((row) => ({ id: row.id, action: row.action, adminName: row.admin_name, details: row.details, createdAt: row.created_at }));
  },

  async listBookings(eventId, page, pageSize) {
    const rows = await query<
      BookingRow & { first_name: string | null; last_name: string | null; phone: string; external_ref: string; updated_at: Date; total: number }
    >(
      `SELECT ${BOOKING_COLUMNS}, b.external_ref, b.updated_at, u.first_name, u.last_name, u.phone, count(*) OVER ()::int AS total
         ${BOOKING_FROM} JOIN v2_users u ON u.id = b.user_id
        WHERE b.event_id = $1
        ORDER BY b.created_at DESC, b.id LIMIT $2 OFFSET $3`,
      [eventId, pageSize, (page - 1) * pageSize]
    );
    return {
      items: rows.map((row) => ({
        ...toBooking(row),
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
        externalRef: row.external_ref,
        updatedAt: row.updated_at,
      })),
      total: rows[0]?.total ?? 0,
    };
  },

  async reviewBooking(bookingId, status, externalRef, adminId) {
    // A pending booking takes the partner's answer; a confirmed one can only be cancelled.
    const rows = await query<{ id: string }>(
      `UPDATE v2_event_bookings SET status = $2::v2_event_booking_status, external_ref = $3, updated_at = now()
        WHERE id = $1 AND (status = 'pending' OR (status = 'confirmed' AND $2::v2_event_booking_status = 'cancelled'))
        RETURNING id`,
      [bookingId, status, externalRef]
    );
    if (rows.length === 0) return false;
    await audit(null, 'booking', bookingId, adminId, `booking_${status}`, externalRef ? { externalRef } : {});
    return true;
  },

  // ─── Categories ────────────────────────────────────────────────
  async listCategories(activeOnly) {
    const rows = await query<CategoryRow>(
      `SELECT ${CATEGORY_COLUMNS} FROM v2_event_categories c WHERE ($1::boolean = false OR c.is_active) ORDER BY c.position, c.name`,
      [activeOnly]
    );
    return rows.map(toCategory);
  },

  async findCategory(id) {
    const row = await queryOne<CategoryRow>(`SELECT ${CATEGORY_COLUMNS} FROM v2_event_categories c WHERE c.id = $1`, [id]);
    return row ? toCategory(row) : null;
  },

  async createCategory(fields, adminId) {
    try {
      const row = await queryOne<{ id: string }>(
        `INSERT INTO v2_event_categories (slug, name, description, icon, image_media_id, is_active, position)
         VALUES ($1, $2, $3, $4, $5, $6, (SELECT coalesce(max(position), 0) + 1 FROM v2_event_categories))
         RETURNING id`,
        [fields.slug, fields.name, fields.description, fields.icon, fields.imageId, fields.isActive]
      );
      await audit(null, 'category', row!.id, adminId, 'create', { name: fields.name });
      return row!.id;
    } catch (error) {
      return rethrowCategorySlug(error);
    }
  },

  async updateCategory(id, fields, adminId) {
    try {
      const rows = await query(
        `UPDATE v2_event_categories
            SET slug = $2, name = $3, description = $4, icon = $5, image_media_id = $6, is_active = $7, updated_at = now()
          WHERE id = $1 RETURNING id`,
        [id, fields.slug, fields.name, fields.description, fields.icon, fields.imageId, fields.isActive]
      );
      if (rows.length === 0) return false;
      await audit(null, 'category', id, adminId, 'update', { name: fields.name, isActive: fields.isActive });
      return true;
    } catch (error) {
      return rethrowCategorySlug(error);
    }
  },

  async reorderCategories(ids) {
    await query(
      `UPDATE v2_event_categories c SET position = o.ordinality, updated_at = now()
         FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, ordinality)
        WHERE c.id = o.id`,
      [ids]
    );
  },

  async removeCategory(id, adminId) {
    // One statement: the use check and the delete see the same links.
    const rows = await query<{ in_use: boolean }>(
      `WITH target AS (
         SELECT c.id, EXISTS (SELECT 1 FROM v2_event_category_links l WHERE l.category_id = c.id) AS in_use
           FROM v2_event_categories c WHERE c.id = $1),
       gone AS (DELETE FROM v2_event_categories d USING target t WHERE d.id = t.id AND NOT t.in_use RETURNING d.id)
       SELECT t.in_use FROM target t`,
      [id]
    );
    const row = rows[0];
    if (!row) return 'not_found';
    if (row.in_use) return 'in_use';
    await audit(null, 'category', id, adminId, 'delete');
    return 'deleted';
  },
};
