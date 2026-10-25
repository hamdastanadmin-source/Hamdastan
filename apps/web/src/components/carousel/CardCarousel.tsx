import type { ReactNode } from 'react';

import { Carousel, CarouselContent, CarouselItem } from '@hamdastan/ui';

/**
 * Cards side by side, swiped — the app's one way to lay out a row of cards.
 * The next card peeks in at the edge to say there is more; a lone card takes
 * the full width. `renderCard` draws one card; give it `h-full` so the row
 * keeps one height.
 */
export function CardCarousel<T extends { id: string }>({
  items,
  label,
  renderCard,
}: {
  items: T[];
  label: string;
  renderCard: (item: T) => ReactNode;
}) {
  return (
    <Carousel opts={{ align: 'start' }} aria-label={label}>
      <CarouselContent>
        {items.map((item) => (
          <CarouselItem key={item.id} className={items.length > 1 ? 'basis-[85%]' : undefined}>
            {renderCard(item)}
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
