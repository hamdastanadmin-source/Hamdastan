import type { EventCard as EventCardData } from '@hamdastan/types';

import { CardCarousel } from '@/components';

import { EventCard } from './EventCard';

/**
 * Events side by side, swiped — home, a world's home, an event's related
 * events. The card is discovery's own, so an event looks the same wherever
 * it appears.
 */
export function EventsCarousel({ events, label }: { events: EventCardData[]; label: string }) {
  return <CardCarousel items={events} label={label} renderCard={(card) => <EventCard card={card} className="h-full" />} />;
}
