import { APP_LOCALE, APP_TIME_ZONE } from '@hamdastan/config';
import type { AdminUser } from '@hamdastan/types';

/** Jalali date and time in Persian digits — `fa-IR` uses the Persian calendar. */
const dateTime = new Intl.DateTimeFormat(APP_LOCALE, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: APP_TIME_ZONE,
});

export function formatDateTime(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : '—';
}

export function fullName(user: Pick<AdminUser, 'firstName' | 'lastName'>): string {
  return `${user.firstName} ${user.lastName}`;
}
