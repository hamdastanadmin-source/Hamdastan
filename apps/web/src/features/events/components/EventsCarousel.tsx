import type { EventCard as EventCardData } from '@hamdastan/types';
import { Carousel, CarouselContent, CarouselItem } from '@hamdastan/ui';

import { EventCard } from './EventCard';

/**
 * Events side by side, swiped — home, a world's home, an event's related
 * events. The card is discovery's own, so an event looks the same wherever
 * it appears. The next card peeks in at the edge to say there is more; a
 * lone event takes the full width.
 */
export function EventsCarousel({ events, label }: { events: EventCardData[]; label: string }) {
  return (
    <Carousel opts={{ align: 'start' }} aria-label={label}>
      <CarouselContent>
        {events.map((card) => (
          <CarouselItem key={card.id} className={events.length > 1 ? 'basis-[85%]' : undefined}>
            <EventCard card={card} className="h-full" />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
