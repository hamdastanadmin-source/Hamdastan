import Link from 'next/link';
import { CalendarDays, MapPin, MonitorPlay } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import type { EventCard as EventCardData } from '@hamdastan/types';
import { Badge } from '@hamdastan/ui';

import { eventWhen } from '../utils/dates';
import { BOOKING_BADGE, priceLabel, stateBadge } from '../utils/labels';
import { EventCover } from './EventCover';

/** Where it happens, in a few words. */
function placeOf(card: EventCardData): { online: boolean; text: string } {
  if (card.type === 'online') return { online: true, text: 'آنلاین' };
  const place = [card.venueName, card.city].filter(Boolean).join('، ');
  return { online: false, text: card.type === 'hybrid' ? `${place} و آنلاین` : place };
}

/**
 * One event wherever events are listed — discovery, home, a world, related
 * and «رویدادهای من» — always this one card, image first, so an event looks
 * the same everywhere. The whole card is the link, with no button inside,
 * so a screen keeps its one primary action.
 */
export function EventCard({ card, className }: { card: EventCardData; className?: string }) {
  const badge = stateBadge(card);
  const booking = card.bookingStatus ? BOOKING_BADGE[card.bookingStatus] : undefined;
  const price = priceLabel(card);
  const place = placeOf(card);
  const category = card.categories[0];
  const ended = card.phase === 'ended' || card.phase === 'cancelled';

  return (
    <Link
      href={`/events/${card.slug}`}
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-border bg-card outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <EventCover
        id={card.coverId}
        alt={card.coverAlt}
        className={cn('aspect-video w-full shrink-0', ended && 'opacity-70')}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        {(badge || booking || category) && (
          <span className="flex flex-wrap items-center gap-2">
            {booking && <Badge variant={booking.variant}>{booking.label}</Badge>}
            {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
            {category && <span className="text-xs text-muted-foreground">{category.name}</span>}
          </span>
        )}
        <span className="text-base font-bold leading-snug">{card.title}</span>
        {card.summary && <span className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{card.summary}</span>}
        <span className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
            {eventWhen(card.startAt, card.endAt)}
          </span>
          {place.text && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              {place.online ? <MonitorPlay aria-hidden="true" className="size-3.5 shrink-0" /> : <MapPin aria-hidden="true" className="size-3.5 shrink-0" />}
              <span className="truncate">{place.text}</span>
            </span>
          )}
        </span>
        {price && <span className="text-sm font-semibold">{price}</span>}
      </span>
    </Link>
  );
}
