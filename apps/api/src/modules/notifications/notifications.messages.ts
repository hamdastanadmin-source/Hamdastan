import { APP_TIME_ZONE } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { NotificationDestination } from '@hamdastan/types';

import type { EventSummary, NotificationContent } from './notifications.types';

/**
 * What each system notification says — pure functions, no storage, no HTTP.
 * The service decides *whether* to send; this decides the words, the
 * category, whether it may reach a phone, its name (the dedupe key) and
 * when it stops being relevant.
 */

/** Long titles are cut at a word, so a notification never overflows its column. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * «۲۰ XP» inside a Persian sentence. Without help the digits join the Latin
 * «XP» into one left-to-right run and read «XP ۲۰»; a RIGHT-TO-LEFT MARK
 * after the number keeps the reading order number → XP → verb. A character,
 * not markup, so it survives into a push.
 */
const xpAmount = (xp: number) => `${toPersianDigits(xp)}\u200F XP`;

const quoted = (title: string) => `«${clip(title, 60)}»`;

/** «شنبه ۲۵ مهر، ساعت ۱۸:۰۰» in Tehran's calendar and clock. */
export function formatWhen(date: Date): string {
  const day = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: APP_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  const time = new Intl.DateTimeFormat('fa-IR', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${day}، ساعت ${time}`;
}

type Base = Omit<NotificationContent, 'campaignId' | 'imageId'>;

const system = (content: Base): NotificationContent => ({ ...content, campaignId: null, imageId: null });

const toEvent = (event: EventSummary): NotificationDestination => ({ kind: 'event', eventId: event.id });

// ─── Progress ────────────────────────────────────────────────────────────────

/** XP after the person's own action: in the app only — they were there when it happened. */
export const xpEarned = (input: { xp: number; reason: string; dedupeKey: string; destination: NotificationDestination }) =>
  system({
    category: 'activity',
    type: 'xp_earned',
    title: `${xpAmount(input.xp)} گرفتی`,
    body: clip(input.reason, 200),
    destination: input.destination,
    dedupeKey: input.dedupeKey,
    expiresAt: null,
    push: false,
  });

export const levelUp = (level: number) =>
  system({
    category: 'achievements',
    type: 'level_up',
    title: `رسیدی به سطح ${toPersianDigits(level)}`,
    body: 'با هر فعالیت یه قدم جلوتر می‌ری.',
    destination: { kind: 'profile' },
    dedupeKey: `level:${level}`,
    expiresAt: null,
    push: true,
  });

export const badgeEarned = (badge: { id: string; title: string }) =>
  system({
    category: 'achievements',
    type: 'badge_earned',
    title: `نشان «${badge.title}» رو گرفتی`,
    body: 'توی پروفایلت، بخش «نشان‌های من»، می‌بینیش.',
    destination: { kind: 'profile' },
    dedupeKey: `badge:${badge.id}`,
    expiresAt: null,
    push: true,
  });

export const submissionReviewed = (input: {
  responseId: string;
  activityId: string;
  activityTitle: string;
  approved: boolean;
  xp: number;
}) =>
  system({
    category: 'activity',
    type: input.approved ? 'mission_approved' : 'mission_rejected',
    title: input.approved ? `مأموریت ${quoted(input.activityTitle)} تأیید شد` : `مأموریت ${quoted(input.activityTitle)} تأیید نشد`,
    body: input.approved
      ? input.xp > 0
        ? `${xpAmount(input.xp)} به امتیازت اضافه شد.`
        : 'پاسخت بررسی و تأیید شد.'
      : 'پاسخت بررسی شد؛ می‌تونی جزئیات رو توی خود فعالیت ببینی.',
    destination: { kind: 'activity', activityId: input.activityId },
    dedupeKey: `review:${input.responseId}`,
    expiresAt: null,
    push: true,
  });

// ─── Events ──────────────────────────────────────────────────────────────────

export const eventCancelled = (event: EventSummary) =>
  system({
    category: 'events',
    type: 'event_cancelled',
    title: `${quoted(event.title)} لغو شد`,
    body: 'این رویداد برگزار نمی‌شه.',
    destination: toEvent(event),
    dedupeKey: `event-cancelled:${event.id}`,
    expiresAt: event.endAt,
    push: true,
  });

/**
 * The time or the place moved. Named by what it moved to, so a second
 * change notifies again and the same save twice does not.
 */
export const eventChanged = (event: EventSummary, change: { time: boolean; venue: boolean; signature: string }) =>
  system({
    category: 'events',
    type: 'event_changed',
    title: `تغییر در ${quoted(event.title)}`,
    body: [
      change.time && event.startAt ? `زمان جدید: ${formatWhen(event.startAt)}.` : null,
      change.venue ? 'محل برگزاری تغییر کرده.' : null,
    ]
      .filter(Boolean)
      .join(' '),
    destination: toEvent(event),
    dedupeKey: `event-changed:${event.id}:${change.signature}`,
    expiresAt: event.endAt,
    push: true,
  });

export const eventReminder = (event: EventSummary & { startAt: Date }) =>
  system({
    category: 'events',
    type: 'event_reminder',
    title: `${quoted(event.title)} به‌زودی شروع می‌شه`,
    body: formatWhen(event.startAt),
    destination: toEvent(event),
    dedupeKey: `event-reminder:${event.id}`,
    // A reminder for something already under way is noise.
    expiresAt: event.startAt,
    push: true,
  });

const BOOKING_TEXT = {
  confirmed: { title: 'خریدت تأیید شد', body: (t: string) => `بلیتت برای ${t} قطعی شد.` },
  failed: { title: 'خریدت ناموفق بود', body: (t: string) => `خرید بلیت ${t} تأیید نشد.` },
  cancelled: { title: 'رزروت لغو شد', body: (t: string) => `رزروت برای ${t} لغو شد.` },
} as const;

/** What an operator recorded about a booking — the one place a booking's outcome is verified. */
export const bookingReviewed = (event: EventSummary, bookingId: string, status: keyof typeof BOOKING_TEXT) =>
  system({
    category: 'events',
    type: `booking_${status}`,
    title: BOOKING_TEXT[status].title,
    body: BOOKING_TEXT[status].body(quoted(event.title)),
    destination: toEvent(event),
    dedupeKey: `booking:${bookingId}:${status}`,
    expiresAt: event.endAt,
    push: true,
  });

// ─── Deep links ──────────────────────────────────────────────────────────────

/** The product path for a destination that needs no access check. */
export const STATIC_PATHS: Partial<Record<NotificationDestination['kind'], string>> = {
  home: '/',
  events: '/events',
  my_events: '/events/mine',
  activities: '/activities',
  profile: '/profile',
};
