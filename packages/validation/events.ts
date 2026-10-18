/**
 * Events' rules, written once: the admin editor and the `events` module both
 * parse an event with `eventInputSchema`, and both ask `eventPublishProblems`
 * whether it may be published — so the checklist the editor shows is the
 * one the API enforces.
 */

import {
  APP_TIME_ZONE,
  EVENT_BOOKING_MODES,
  EVENT_CATEGORY_ICONS,
  EVENT_LIMITS as L,
  EVENT_RESERVED_SLUGS,
  EVENT_SORTS,
  EVENT_TYPES,
  EVENT_VISIBILITIES,
  EVENTS_PAGE_SIZE,
  TICKET_AVAILABILITIES,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { isTimeZone } from '@hamdastan/shared/time-zone';
import type { EventInput } from '@hamdastan/types';

import { z } from 'zod';

import { cleanText, line, paragraph } from './common';
import { activityAudienceSchema } from './engagement';
import { mediaIdSchema } from './media';

const fa = (n: number) => toPersianDigits(n);

const uuid = z.uuid({ error: 'شناسه معتبر نیست' });

const uniqueIds = (max: number, label: string) =>
  z
    .array(uuid)
    .max(max, { error: `حداکثر ${fa(max)} ${label}` })
    .transform((ids) => [...new Set(ids)]);

/** Lower-case Latin letters, digits and single hyphens: it is part of a URL. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const slug = (max: number) =>
  z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .refine((value) => value === '' || SLUG_PATTERN.test(value), {
      error: 'فقط حروف کوچک انگلیسی، عدد و خط تیره',
    })
    .refine((value) => value.length <= max, { error: `حداکثر ${fa(max)} کاراکتر` })
    .refine((value) => !(EVENT_RESERVED_SLUGS as readonly string[]).includes(value), {
      error: 'این نامک رزرو شده است؛ نامک دیگری انتخاب کنید',
    });

/** An address a browser may open: http or https, nothing that runs. */
const webUrl = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `حداکثر ${fa(max)} کاراکتر` })
    .refine((value) => /^https?:\/\/[^\s]+$/i.test(value) && URL.canParse(value), { error: 'نشانی معتبر نیست' });

const nullableUrl = (max: number) =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? null : value), webUrl(max).nullable());

const dateTime = z.iso.datetime({ offset: true, error: 'تاریخ معتبر نیست' }).nullable();

const count = (max: number) => z.number().int().min(1, { error: 'باید بیشتر از صفر باشد' }).max(max).nullable();

// ─── Event ───────────────────────────────────────────────────────────────────

const ticketSchema = z.object({
  id: uuid.optional(),
  title: line(L.TICKET_TITLE_MAX, 'عنوان بلیت را وارد کنید'),
  description: line(L.TICKET_DESCRIPTION_MAX, null),
  priceToman: z.number().int().min(0, { error: 'قیمت نمی‌تواند منفی باشد' }).max(L.PRICE_MAX),
  capacity: count(L.CAPACITY_MAX),
  benefits: z
    .array(line(L.BENEFIT_MAX, null))
    .max(L.BENEFITS_MAX, { error: `حداکثر ${fa(L.BENEFITS_MAX)} مزیت` })
    .transform((items) => items.filter(Boolean)),
  availability: z.enum(TICKET_AVAILABILITIES),
  externalId: line(L.PARTNER_REF_MAX, null),
});

/** `POST /admin/events` and `PUT /admin/events/:id`. A draft only needs a title. */
export const eventInputSchema = z
  .object({
    title: line(L.TITLE_MAX, 'عنوان رویداد را وارد کنید'),
    slug: slug(L.SLUG_MAX),
    summary: line(L.SUMMARY_MAX, null),
    description: paragraph(L.DESCRIPTION_MAX),
    type: z.enum(EVENT_TYPES),
    categoryIds: uniqueIds(L.CATEGORIES_MAX, 'دسته'),
    coverId: mediaIdSchema.nullable(),
    coverAlt: line(L.ALT_MAX, null),
    gallery: z
      .array(z.object({ mediaId: mediaIdSchema, alt: line(L.ALT_MAX, null) }))
      .max(L.GALLERY_MAX, { error: `حداکثر ${fa(L.GALLERY_MAX)} تصویر` })
      .transform((items) => items.filter((item, index) => items.findIndex((other) => other.mediaId === item.mediaId) === index)),
    visibility: z.enum(EVENT_VISIBILITIES),
    worldIds: uniqueIds(L.WORLDS_MAX, 'دنیا'),
    audience: activityAudienceSchema.nullable(),
    startAt: dateTime,
    endAt: dateTime,
    timeZone: z.string().refine(isTimeZone, { error: 'منطقه‌ی زمانی معتبر نیست' }).default(APP_TIME_ZONE),
    registrationDeadline: dateTime,
    venueName: line(L.VENUE_MAX, null),
    city: line(L.CITY_MAX, null),
    address: line(L.ADDRESS_MAX, null),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    onlineUrl: nullableUrl(L.URL_MAX),
    onlineInstructions: paragraph(L.ONLINE_INSTRUCTIONS_MAX),
    organizerName: line(L.ORGANIZER_MAX, null),
    organizerLogoId: mediaIdSchema.nullable(),
    organizerContact: line(L.CONTACT_MAX, null),
    bookingMode: z.enum(EVENT_BOOKING_MODES),
    externalBookingUrl: nullableUrl(L.URL_MAX),
    partnerRef: line(L.PARTNER_REF_MAX, null),
    capacity: count(L.CAPACITY_MAX),
    tickets: z.array(ticketSchema).max(L.TICKETS_MAX, { error: `حداکثر ${fa(L.TICKETS_MAX)} نوع بلیت` }),
  })
  .superRefine((input, ctx) => {
    if (input.startAt && input.endAt && Date.parse(input.endAt) <= Date.parse(input.startAt)) {
      ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'زمان پایان باید بعد از زمان شروع باشد' });
    }
    if (input.registrationDeadline && input.endAt && Date.parse(input.registrationDeadline) > Date.parse(input.endAt)) {
      ctx.addIssue({ code: 'custom', path: ['registrationDeadline'], message: 'مهلت ثبت‌نام باید پیش از پایان رویداد باشد' });
    }
    if ((input.latitude === null) !== (input.longitude === null)) {
      ctx.addIssue({ code: 'custom', path: ['longitude'], message: 'عرض و طول جغرافیایی را با هم وارد کنید' });
    }
  })
  // An audience only means something for a restricted event.
  .transform((input) => ({ ...input, audience: input.visibility === 'restricted' ? input.audience : null }));

export type EventInputOutput = z.output<typeof eventInputSchema>;

/**
 * What still stands between an event and publishing, field by field. Empty
 * when it may be published. A draft is saved whatever this says.
 */
export function eventPublishProblems(input: EventInput): { field: string; message: string }[] {
  const problems: { field: string; message: string }[] = [];
  const need = (ok: unknown, field: string, message: string) => {
    if (!ok) problems.push({ field, message });
  };

  need(input.coverId, 'coverId', 'تصویر کاور را انتخاب کنید');
  need(input.description.trim(), 'description', 'توضیحات رویداد را وارد کنید');
  need(input.categoryIds.length > 0, 'categoryIds', 'حداقل یک دسته انتخاب کنید');
  need(input.startAt, 'startAt', 'زمان شروع را مشخص کنید');
  need(input.endAt, 'endAt', 'زمان پایان را مشخص کنید');

  if (input.type !== 'online') {
    need(input.venueName, 'venueName', 'نام محل برگزاری را وارد کنید');
    need(input.city, 'city', 'شهر را وارد کنید');
    need(input.address, 'address', 'نشانی را وارد کنید');
  }
  if (input.type !== 'physical') {
    need(input.onlineUrl || input.onlineInstructions.trim(), 'onlineUrl', 'نشانی یا راهنمای شرکت آنلاین را وارد کنید');
  }
  if (input.bookingMode === 'external') {
    need(input.externalBookingUrl, 'externalBookingUrl', 'نشانی خرید بلیت را وارد کنید');
  }
  if (input.bookingMode === 'free_registration') {
    need(input.tickets.every((ticket) => ticket.priceToman === 0), 'tickets', 'در ثبت‌نام رایگان، بلیت پولی مجاز نیست');
  }
  if (input.visibility === 'world') {
    need(input.worldIds.length > 0, 'worldIds', 'رویدادی که فقط در دنیاها نمایش داده می‌شود باید دست‌کم به یک دنیا متصل باشد');
  }
  if (input.visibility === 'restricted') {
    need(input.audience, 'audience', 'مخاطب رویداد محدود را مشخص کنید');
  }
  return problems;
}

export const eventStatusSchema = z.object({
  action: z.enum(['publish', 'unpublish', 'cancel', 'archive']),
  publishAt: z.iso.datetime({ offset: true, error: 'تاریخ معتبر نیست' }).nullable().optional(),
});

export const adminEventListQuerySchema = z.object({
  search: z.string().max(50).transform((value) => cleanText(value, false)).optional(),
  status: z.enum(['draft', 'scheduled', 'published', 'unpublished', 'cancelled', 'archived']).optional(),
  visibility: z.enum(EVENT_VISIBILITIES).optional(),
  world: uuid.optional(),
  category: uuid.optional(),
  sort: z.enum(['updated', 'start']).default('updated'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(EVENTS_PAGE_SIZE),
});

export const eventBookingReviewSchema = z.object({
  status: z.enum(['confirmed', 'failed', 'cancelled']),
  externalRef: line(L.PARTNER_REF_MAX, null),
});

// ─── Categories and worlds ───────────────────────────────────────────────────

export const eventCategoryInputSchema = z.object({
  slug: slug(60).refine((value) => value !== '', { error: 'نامک را وارد کنید' }),
  name: line(L.CATEGORY_NAME_MAX, 'نام دسته را وارد کنید'),
  description: line(L.CATEGORY_DESCRIPTION_MAX, null),
  icon: z.enum(EVENT_CATEGORY_ICONS),
  imageId: mediaIdSchema.nullable(),
  isActive: z.boolean(),
});

export const worldInputSchema = z.object({
  slug: slug(60).refine((value) => value !== '', { error: 'نامک را وارد کنید' }),
  name: line(L.WORLD_NAME_MAX, 'نام دنیا را وارد کنید'),
  summary: line(L.WORLD_SUMMARY_MAX, null),
  coverId: mediaIdSchema.nullable(),
  isActive: z.boolean(),
});

/** The whole list in its new order. */
export const reorderSchema = z.object({ ids: z.array(uuid).min(1).max(200) });

// ─── Product ─────────────────────────────────────────────────────────────────

/** A Tehran calendar day, `YYYY-MM-DD`. */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'تاریخ معتبر نیست' }).refine((value) => !Number.isNaN(Date.parse(value)), {
  error: 'تاریخ معتبر نیست',
});

/** `a,b` or `a&a` in a query string: either way, a list. */
const list = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (value) => (value === undefined ? undefined : [value].flat().flatMap((part) => String(part).split(',')).filter(Boolean)),
    z.array(item).max(20).optional()
  );

const flag = z.preprocess((value) => (value === undefined ? undefined : value === 'true' || value === true), z.boolean().optional());

const eventFilters = {
  q: z.string().max(60).transform((value) => cleanText(value, false)).optional(),
  category: list(z.string().regex(SLUG_PATTERN)),
  type: list(z.enum(EVENT_TYPES)),
  world: z.string().regex(SLUG_PATTERN).optional(),
  city: z.string().max(L.CITY_MAX).transform((value) => cleanText(value, false)).optional(),
  price: z.enum(['free', 'paid']).optional(),
  available: flag,
  interested: flag,
};

const ordered = (input: { from?: string; to?: string }) => !input.from || !input.to || input.from <= input.to;

/** `GET /events`. */
export const eventListQuerySchema = z
  .object({
    ...eventFilters,
    from: day.optional(),
    to: day.optional(),
    sort: z.enum(EVENT_SORTS).default('soonest'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(EVENTS_PAGE_SIZE),
  })
  .refine(ordered, { path: ['to'], error: 'بازه‌ی تاریخ درست نیست' });

/** `GET /events/calendar`. */
export const eventCalendarQuerySchema = z
  .object({ ...eventFilters, from: day, to: day })
  .refine(ordered, { path: ['to'], error: 'بازه‌ی تاریخ درست نیست' })
  .refine((input) => (Date.parse(input.to) - Date.parse(input.from)) / 86_400_000 < L.CALENDAR_DAYS_MAX, {
    path: ['to'],
    error: `حداکثر ${fa(L.CALENDAR_DAYS_MAX)} روز`,
  });

export const myEventsQuerySchema = z.object({ tab: z.enum(['interested', 'booked', 'past', 'soon']).default('interested') });

export const eventInterestSchema = z.object({ remindInApp: z.boolean() });

export const eventBookingSchema = z.object({
  ticketOptionId: uuid.nullable(),
  quantity: z.number().int().min(1).max(L.QUANTITY_MAX, { error: `حداکثر ${fa(L.QUANTITY_MAX)} بلیت` }),
});

export type EventListQueryOutput = z.output<typeof eventListQuerySchema>;
export type EventCalendarQueryOutput = z.output<typeof eventCalendarQuerySchema>;
export type AdminEventListQueryOutput = z.output<typeof adminEventListQuerySchema>;
export type EventCategoryInputOutput = z.output<typeof eventCategoryInputSchema>;
export type WorldInputOutput = z.output<typeof worldInputSchema>;
