import { APP_LOCALE, APP_TIME_ZONE } from '@hamdastan/config';

/**
 * Days and times as the events screens use them. A day is a Tehran calendar
 * day written `YYYY-MM-DD` (Gregorian) — the API's key for the calendar and
 * date filter; everything a person reads is Jalali.
 */

const pad = (n: number) => String(n).padStart(2, '0');

const tehranKey = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** The Tehran day an instant falls on. */
export const dayKeyOf = (instant: Date): string => tehranKey.format(instant);

/** A local date's own fields, as a day key. */
const dayKeyOfLocal = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The local midnight of a day key. */
function localDateOf(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(key: string, days: number): string {
  const date = localDateOf(key);
  date.setDate(date.getDate() + days);
  return dayKeyOfLocal(date);
}

const weekday = new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'short', timeZone: APP_TIME_ZONE });
const dayNumber = new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', timeZone: APP_TIME_ZONE });
const dayMonth = new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'long', timeZone: APP_TIME_ZONE });
const fullDay = new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: APP_TIME_ZONE });
const time = new Intl.DateTimeFormat(APP_LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE });

/** Noon of a day key, so formatting it in Tehran cannot slip to the day before. */
const noonOf = (key: string) => new Date(`${key}T12:00:00+03:30`);

/** «ش» and «۲۵» for the date strip. */
export const stripLabels = (key: string) => ({ weekday: weekday.format(noonOf(key)), day: dayNumber.format(noonOf(key)) });

/** «جمعه ۲۵ مهر» for a day key. */
export const dayTitle = (key: string) => fullDay.format(noonOf(key));

/**
 * When an event is, in one line: «جمعه ۲۵ مهر، ساعت ۱۸:۰۰», or, over
 * several days, «۲۵ مهر تا ۲۷ مهر». No «·» next to digits: beside Persian
 * numerals it reads as a zero.
 */
export function eventWhen(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  // The last day is the day of its last instant: an end at midnight belongs to the day before.
  if (dayKeyOf(start) === dayKeyOf(new Date(end.getTime() - 1000))) return `${fullDay.format(start)}، ساعت ${time.format(start)}`;
  return `${dayMonth.format(start)} تا ${dayMonth.format(end)}`;
}

/** «۱۸:۰۰ تا ۲۱:۰۰», or with days when it spans several. */
export function eventTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (dayKeyOf(start) === dayKeyOf(new Date(end.getTime() - 1000))) return `${time.format(start)} تا ${time.format(end)}`;
  return `${fullDay.format(start)} ${time.format(start)} تا ${fullDay.format(end)} ${time.format(end)}`;
}

export const formatDateTime = (iso: string) => `${fullDay.format(new Date(iso))}، ساعت ${time.format(new Date(iso))}`;
