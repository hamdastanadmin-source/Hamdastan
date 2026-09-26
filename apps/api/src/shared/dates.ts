import { APP_TIMEZONE } from '@hamdastan/config';

/**
 * Today, where the product lives.
 *
 * An admin's access expires on a calendar day rather than at an instant, and
 * the day that matters is the one in Tehran, not the one in UTC — between
 * 20:30 and midnight UTC the two disagree, and an account would lose its access
 * three and a half hours early. Asking `Intl` for the date in `APP_TIMEZONE` is
 * what keeps the comparison honest.
 *
 * `en-CA` is used because its short date format is `YYYY-MM-DD`, which is the
 * shape every stored date in this project already has, so the comparison is a
 * plain string comparison.
 */

const isoDateInAppTimezone = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `YYYY-MM-DD` for the given instant, in the product's timezone. */
export function toAppDate(instant: Date = new Date()): string {
  return isoDateInAppTimezone.format(instant);
}

/**
 * Whether a `YYYY-MM-DD` deadline has passed.
 *
 * Inclusive of the named day: access granted until 1404-07-01 works all through
 * that day and stops when it ends.
 */
export function isPastDate(isoDate: string, now: Date = new Date()): boolean {
  return isoDate < toAppDate(now);
}
