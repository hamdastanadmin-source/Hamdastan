import { APP_LOCALE, APP_TIME_ZONE } from '@hamdastan/config';

/** «۲۵ مهر ۱۴۰۵» — the Jalali day an article was published, in Tehran. */
const day = new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: APP_TIME_ZONE });

export const publishedOn = (iso: string) => (iso ? day.format(new Date(iso)) : '');

/** A blank line starts a paragraph — the admin editor writes the body the same way. */
export const paragraphsOf = (body: string) =>
  body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
