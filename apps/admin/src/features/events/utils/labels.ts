import type { EventBookingSource, EventBookingStatus, EventStatus, EventStatusAction } from '@hamdastan/types';

/** Everything the events section prints about a status or a booking. */

export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'پیش‌نویس',
  scheduled: 'زمان‌بندی‌شده',
  published: 'منتشرشده',
  unpublished: 'لغو انتشار',
  cancelled: 'لغوشده',
  archived: 'بایگانی',
};

/** Neutral or semantic — never the brand colour. */
export const STATUS_BADGE: Record<EventStatus, 'success' | 'info' | 'warning' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  scheduled: 'info',
  published: 'success',
  unpublished: 'warning',
  cancelled: 'destructive',
  archived: 'secondary',
};

export const ACTION_LABELS: Record<EventStatusAction, string> = {
  publish: 'انتشار',
  unpublish: 'لغو انتشار',
  cancel: 'لغو رویداد',
  archive: 'بایگانی',
};

/** Which status actions each status allows — the API holds the same table. */
export const ACTIONS_FOR: Record<EventStatus, EventStatusAction[]> = {
  draft: ['publish', 'archive'],
  // Publishing again changes the scheduled time.
  scheduled: ['publish', 'unpublish', 'archive'],
  published: ['unpublish', 'cancel', 'archive'],
  unpublished: ['publish', 'archive'],
  cancelled: ['archive'],
  archived: [],
};

/** The actions that take an event away from people, and so ask first. */
export const CONFIRM_COPY: Partial<Record<EventStatusAction, string>> = {
  unpublish: 'رویداد از همه‌جای محصول برداشته می‌شه تا دوباره منتشرش کنی. علاقه‌مندی‌ها و رزروها می‌مونن.',
  cancel: 'رویداد با برچسب «لغو شد» دیده می‌شه و دیگه ثبت‌نام یا خرید نداره. این کار برگشت‌پذیر نیست.',
  archive: 'رویداد از محصول و ویرایش خارج می‌شه. سابقه و رزروها می‌مونن.',
};

export const BOOKING_STATUS_LABELS: Record<EventBookingStatus, string> = {
  pending: 'در انتظار تأیید',
  confirmed: 'تأییدشده',
  failed: 'ناموفق',
  cancelled: 'لغوشده',
};

export const BOOKING_STATUS_BADGE: Record<EventBookingStatus, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  pending: 'warning',
  confirmed: 'success',
  failed: 'destructive',
  cancelled: 'secondary',
};

export const BOOKING_SOURCE_LABELS: Record<EventBookingSource, string> = {
  internal: 'ثبت‌نام در هم‌داستان',
  external: 'فیدیبو آرت',
};

/** The history's actions, as an admin reads them. */
export const HISTORY_LABELS: Record<string, string> = {
  create: 'ساخته شد',
  update: 'ویرایش شد',
  publish: 'منتشر شد',
  schedule: 'انتشارش زمان‌بندی شد',
  unpublish: 'انتشارش لغو شد',
  cancel: 'لغو شد',
  archive: 'بایگانی شد',
  duplicate: 'از رویداد دیگری تکثیر شد',
};
