import {
  adminEventListQuerySchema,
  audiencePreviewSchema,
  eventBookingReviewSchema,
  eventBookingSchema,
  eventCalendarQuerySchema,
  eventCategoryInputSchema,
  eventInputSchema,
  eventInterestSchema,
  eventListQuerySchema,
  eventStatusSchema,
  myEventsQuerySchema,
  paginationQuerySchema,
  reorderSchema,
  z,
} from '@hamdastan/validation';

/**
 * Request validation for the Events module. The bodies and queries are the
 * schemas `apps/admin` and `apps/web` build them with; only the path
 * parameters are local.
 */

// A malformed id would otherwise reach a `uuid` column and fail as a 500.
const idParams = z.object({ id: z.uuid({ error: 'شناسه معتبر نیست' }) });
// Anything that is not a slug cannot be one, and is the same 404 as a slug nobody has.
const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: 'رویداد پیدا نشد' }) });

export const eventsSchemas = {
  byId: { params: idParams },
  bySlug: { params: slugParams },
  list: { query: eventListQuerySchema },
  calendar: { query: eventCalendarQuerySchema },
  mine: { query: myEventsQuerySchema },
  interest: { body: eventInterestSchema },
  booking: { body: eventBookingSchema },
  adminList: { query: adminEventListQuerySchema },
  write: { body: eventInputSchema },
  status: { body: eventStatusSchema },
  audience: { body: audiencePreviewSchema },
  bookings: { query: paginationQuerySchema },
  review: { body: eventBookingReviewSchema },
  category: { body: eventCategoryInputSchema },
  reorder: { body: reorderSchema },
} satisfies Record<string, unknown>;
