import { APP_LOCALE, APP_TIME_ZONE } from '@hamdastan/config';

/**
 * When a notification arrived, as the Center groups and labels it — in
 * Tehran's calendar, whatever the device's own time zone.
 */

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const time = new Intl.DateTimeFormat(APP_LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE });
const dayMonth = new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'long', timeZone: APP_TIME_ZONE });

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole Tehran days between two instants. */
function daysBetween(earlier: Date, later: Date): number {
  const start = new Date(`${dayKey.format(earlier)}T00:00:00Z`).getTime();
  const end = new Date(`${dayKey.format(later)}T00:00:00Z`).getTime();
  return Math.round((end - start) / DAY_MS);
}

export type DateGroup = 'today' | 'yesterday' | 'week' | 'earlier';

export const GROUP_LABELS: Record<DateGroup, string> = {
  today: 'امروز',
  yesterday: 'دیروز',
  week: 'هفته‌ی گذشته',
  earlier: 'قبل‌تر',
};

export function groupOf(iso: string, now = new Date()): DateGroup {
  const days = daysBetween(new Date(iso), now);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'week';
  return 'earlier';
}

/** «۱۸:۲۰» today, «۲۵ مهر» before. */
export function stampOf(iso: string, now = new Date()): string {
  const date = new Date(iso);
  return daysBetween(date, now) <= 0 ? time.format(date) : dayMonth.format(date);
}
