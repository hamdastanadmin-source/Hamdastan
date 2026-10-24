import Link from 'next/link';

import type { EventCard as EventCardData } from '@hamdastan/types';

import { EventsCarousel } from './EventsCarousel';

/**
 * Home's «رویدادهای پیش‌رو»: the next few events the person may see, and
 * «همه» to discovery. Nothing at all when there are none.
 */
export function UpcomingEventsSection({ events, without = [] }: { events: EventCardData[]; without?: EventCardData[] }) {
  // An event already in the reminders above is not repeated.
  const shown = events.filter((card) => !without.some((other) => other.id === card.id));
  if (shown.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="upcoming-events-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="upcoming-events-heading" className="text-lg font-bold leading-tight">
          رویدادهای پیش‌رو
        </h2>
        <Link href="/events" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          همه
        </Link>
      </div>
      <EventsCarousel events={shown} label="رویدادهای پیش‌رو" />
    </section>
  );
}
