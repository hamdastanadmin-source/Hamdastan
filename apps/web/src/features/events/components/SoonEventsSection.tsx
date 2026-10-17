import { BellRing } from 'lucide-react';

import type { EventCard as EventCardData } from '@hamdastan/types';

import { EventCard } from './EventCard';

/**
 * The in-app reminder: events starting within a day that the person asked
 * to be reminded of, or holds a confirmed place at. Read live, so a
 * cancellation or a new time shows at once. Nothing when there are none.
 */
export function SoonEventsSection({ events }: { events: EventCardData[] }) {
  if (events.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="soon-heading">
      <h2 id="soon-heading" className="flex items-center gap-2 text-lg font-bold leading-tight">
        <BellRing aria-hidden="true" className="size-5 text-primary" />
        یادت نره
      </h2>
      <ul className="flex flex-col gap-3">
        {events.map((card) => (
          <li key={card.id}>
            <EventCard card={card} layout="row" className="border-primary/40" />
          </li>
        ))}
      </ul>
    </section>
  );
}
