import { APP_LOCALE, APP_TIME_ZONE } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

/**
 * How the panel writes dates, counts and shares — Jalali, Persian digits.
 * Shared by the features, so a date reads the same on every screen.
 */

/** `fa-IR` formats in the Persian calendar. */
const dateTime = new Intl.DateTimeFormat(APP_LOCALE, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: APP_TIME_ZONE,
});

const dateOnly = new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: 'medium', timeZone: APP_TIME_ZONE });

export function formatDateTime(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : '—';
}

export function formatDate(iso: string | null): string {
  return iso ? dateOnly.format(new Date(iso)) : '—';
}

/** A count in Persian digits, with thousands grouped. */
export function formatCount(value: number): string {
  return toPersianDigits(value.toLocaleString('en-US')).replace(/,/g, '٬');
}

/** A 0–1 share as «۴۲٪». */
export function formatPercent(share: number): string {
  return `${toPersianDigits(Math.round(share * 100))}٪`;
}
