/**
 * Events (رویدادها) and the world list they are filed under: the fixed
 * vocabularies and limits both apps and the API agree on. Categories and
 * worlds themselves are rows an admin keeps, not lists here.
 */

export const EVENT_TYPES = ['physical', 'online', 'hybrid'] as const;
export type EventTypeId = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventTypeId, string> = {
  physical: 'حضوری',
  online: 'آنلاین',
  hybrid: 'حضوری و آنلاین',
};

/** Where a published event may appear. Independent of which worlds it belongs to. */
export const EVENT_VISIBILITIES = ['public', 'world', 'restricted'] as const;
export type EventVisibilityId = (typeof EVENT_VISIBILITIES)[number];

export const EVENT_VISIBILITY_LABELS: Record<EventVisibilityId, string> = {
  public: 'عمومی',
  world: 'فقط در دنیاها',
  restricted: 'محدود به مخاطب خاص',
};

export const EVENT_BOOKING_MODES = ['none', 'free_registration', 'external'] as const;
export type EventBookingModeId = (typeof EVENT_BOOKING_MODES)[number];

export const EVENT_BOOKING_MODE_LABELS: Record<EventBookingModeId, string> = {
  none: 'اطلاع‌رسانی (بدون ثبت‌نام)',
  free_registration: 'ثبت‌نام رایگان در هم‌داستان',
  external: 'خرید بلیت در فیدیبو آرت',
};

export const TICKET_AVAILABILITIES = ['available', 'limited', 'sold_out'] as const;
export type TicketAvailabilityId = (typeof TICKET_AVAILABILITIES)[number];

export const TICKET_AVAILABILITY_LABELS: Record<TicketAvailabilityId, string> = {
  available: 'موجود',
  limited: 'ظرفیت محدود',
  sold_out: 'تکمیل ظرفیت',
};

/**
 * Discovery's orders. «popular» is the number of people interested — a rule
 * anyone can check — so it is labelled «محبوب», never «پیشنهادی».
 * «relevance» only means something with a search.
 */
export const EVENT_SORTS = ['soonest', 'newest', 'popular', 'price', 'relevance'] as const;
export type EventSortId = (typeof EVENT_SORTS)[number];

export const EVENT_SORT_LABELS: Record<EventSortId, string> = {
  soonest: 'نزدیک‌ترین',
  newest: 'جدیدترین',
  popular: 'محبوب‌ترین',
  price: 'ارزان‌ترین',
  relevance: 'مرتبط‌ترین',
};

/**
 * Icons a category may carry, by lucide name. A category may also have its
 * own image from the media library; the icon is what shows without one.
 */
export const EVENT_CATEGORY_ICONS = [
  'sparkles',
  'hammer',
  'drama',
  'image',
  'music',
  'book-open',
  'gamepad-2',
  'dumbbell',
  'flask-conical',
  'users',
  'shopping-bag',
  'megaphone',
  'film',
  'mic',
  'ticket',
  'palette',
  'trophy',
  'map-pin',
] as const;
export type EventCategoryIconId = (typeof EVENT_CATEGORY_ICONS)[number];

/**
 * Words a slug may not be, because they are paths beside `/events/:slug`
 * and `/worlds/:slug`.
 */
export const EVENT_RESERVED_SLUGS = ['mine', 'calendar', 'categories', 'new'] as const;

export const EVENT_LIMITS = {
  TITLE_MAX: 120,
  SLUG_MAX: 80,
  SUMMARY_MAX: 200,
  DESCRIPTION_MAX: 10_000,
  ALT_MAX: 200,
  VENUE_MAX: 120,
  CITY_MAX: 60,
  ADDRESS_MAX: 300,
  URL_MAX: 500,
  ONLINE_INSTRUCTIONS_MAX: 1000,
  ORGANIZER_MAX: 120,
  CONTACT_MAX: 200,
  PARTNER_REF_MAX: 120,
  CATEGORIES_MAX: 5,
  WORLDS_MAX: 10,
  GALLERY_MAX: 12,
  TICKETS_MAX: 10,
  TICKET_TITLE_MAX: 80,
  TICKET_DESCRIPTION_MAX: 300,
  BENEFITS_MAX: 8,
  BENEFIT_MAX: 80,
  PRICE_MAX: 1_000_000_000,
  CAPACITY_MAX: 1_000_000,
  /** Tickets in one booking. */
  QUANTITY_MAX: 10,
  CATEGORY_NAME_MAX: 60,
  CATEGORY_DESCRIPTION_MAX: 300,
  WORLD_NAME_MAX: 80,
  WORLD_SUMMARY_MAX: 300,
  /** The calendar asks for at most this many days at once. */
  CALENDAR_DAYS_MAX: 62,
  RELATED_MAX: 6,
  /** «به‌زودی»: an interested event starting within this many hours. */
  SOON_HOURS: 24,
} as const;

export const EVENTS_PAGE_SIZE = 20;

/**
 * The shape the product draws each event and world image at — the product's
 * boxes are these ratios, filled and cropped to them. The panel says the
 * size when a file is chosen, previews the crop, and warns when a file's
 * proportions or width do not fit. All are within the library's 250 KB.
 */
export const IMAGE_FRAMES = {
  /** An event's cover and gallery: the card and the top of its page, 16:9. */
  eventCover: { width: 1280, height: 720 },
  /** An organizer's logo, shown small and square. */
  logo: { width: 256, height: 256 },
  /** A world's cover: the banner across the top of its page, 3:1. */
  worldCover: { width: 1290, height: 430 },
} as const;

export type ImageFrame = { width: number; height: number };
