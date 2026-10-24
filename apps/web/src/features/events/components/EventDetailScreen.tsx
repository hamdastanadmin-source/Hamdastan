import type { ReactNode } from 'react';
import Link from 'next/link';
import { Building2, CalendarDays, Eye, MapPin, MonitorPlay, Navigation, Ticket } from 'lucide-react';

import { EVENT_TYPE_LABELS, EVENT_VISIBILITY_LABELS } from '@hamdastan/config';
import type { EventCard as EventCardData, EventDetail } from '@hamdastan/types';
import { Alert, AlertDescription, AlertTitle, Badge, Separator } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenHeader } from '@/components';

import { eventTimeRange, eventWhen, formatDateTime } from '../utils/dates';
import { formatToman, stateBadge } from '../utils/labels';
import { EventActionsProvider } from '../hooks/use-event-actions';
import { EventBookingBar } from './EventBookingBar';
import { EventsCarousel } from './EventsCarousel';
import { EventCover } from './EventCover';
import { EventDescription } from './EventDescription';
import { ReminderCard } from './ReminderCard';
import { ShareEventButton } from './ShareEventButton';

const PREVIEW_STATUS: Record<string, string> = {
  draft: 'پیش‌نویس',
  scheduled: 'زمان‌بندی‌شده',
  published: 'منتشرشده',
  unpublished: 'لغو انتشار',
  cancelled: 'لغوشده',
  archived: 'بایگانی',
};

/** A map's route to the place: by coordinates when there are some, by address otherwise. */
function directionsUrl(venue: NonNullable<EventDetail['venue']>): string | null {
  if (venue.latitude !== null && venue.longitude !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`;
  }
  const query = [venue.address, venue.city].filter(Boolean).join('، ');
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

function InfoRow({ icon, title, children }: { icon: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground [&_svg]:size-4">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <span className="font-semibold leading-relaxed">{title}</span>
        {children && <span className="flex flex-col leading-relaxed text-muted-foreground">{children}</span>}
      </span>
    </li>
  );
}

/**
 * `/events/:slug`: one event — image and gallery, what and when, where (with
 * a route to it) or how to join online, who runs it, the description,
 * tickets and related events. The API has already decided the person may see
 * it; an admin's preview carries a banner with where it stands. At the
 * bottom, «علاقه‌مندم» and the booking the API offers.
 */
export function EventDetailScreen({ event, related }: { event: EventDetail; related: EventCardData[] }) {
  const badge = stateBadge(event);
  const directions = event.venue ? directionsUrl(event.venue) : null;

  const screen = (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/events" label="رویدادها" />
        {!event.preview && <ShareEventButton title={event.title} slug={event.slug} />}
      </ScreenHeader>

      <ScreenBody className="gap-6 pt-1">
        {event.preview && (
          <Alert>
            <Eye aria-hidden="true" />
            <AlertTitle>پیش‌نمایش</AlertTitle>
            <AlertDescription>
              وضعیت: {PREVIEW_STATUS[event.preview.status] ?? event.preview.status} · {EVENT_VISIBILITY_LABELS[event.preview.visibility]}. کاربرها
              این صفحه رو فقط بعد از انتشار و طبق محل نمایش می‌بینن.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          <EventCover id={event.coverId} alt={event.coverAlt} className="aspect-video w-full rounded-2xl" />
          {event.gallery.length > 0 && (
            <ul className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 [scrollbar-width:none]" aria-label="گالری">
              {event.gallery.map((item) => (
                <li key={item.mediaId} className="snap-start">
                  <EventCover id={item.mediaId} alt={item.alt} className="aspect-video h-24 rounded-xl" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
            <Badge variant="outline">{EVENT_TYPE_LABELS[event.type]}</Badge>
            {event.categories.map((category) => (
              <Link key={category.slug} href={`/events?category=${category.slug}`} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                {category.name}
              </Link>
            ))}
          </div>
          <h1 className="text-2xl font-extrabold leading-tight text-balance">{event.title}</h1>
          {event.summary && <p className="text-sm leading-relaxed text-muted-foreground">{event.summary}</p>}
          {event.worlds.length > 0 && (
            <p className="flex flex-wrap gap-x-2 text-sm">
              <span className="text-muted-foreground">از دنیای</span>
              {event.worlds.map((world, index) => (
                <span key={world.slug} className="font-semibold">
                  {world.name}
                  {index < event.worlds.length - 1 && '،'}
                </span>
              ))}
            </p>
          )}
        </div>

        <ul className="flex flex-col gap-4">
          <InfoRow icon={<CalendarDays />} title={eventWhen(event.startAt, event.endAt)}>
            {eventTimeRange(event.startAt, event.endAt)}
            {event.registrationDeadline && <span className="block">مهلت ثبت‌نام: {formatDateTime(event.registrationDeadline)}</span>}
          </InfoRow>

          {event.venue && (
            <InfoRow icon={<MapPin />} title={[event.venue.name, event.venue.city].filter(Boolean).join('، ')}>
              {event.venue.address}
              {directions && (
                <a
                  href={directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex w-fit items-center gap-1.5 font-semibold text-foreground underline-offset-4 hover:underline"
                >
                  <Navigation aria-hidden="true" className="size-4" />
                  مسیریابی
                </a>
              )}
            </InfoRow>
          )}

          {event.online && (
            <InfoRow icon={<MonitorPlay />} title="آنلاین">
              {event.online.instructions && <span className="block whitespace-pre-line">{event.online.instructions}</span>}
              {event.online.url ? (
                <a
                  href={event.online.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex w-fit font-semibold text-foreground underline-offset-4 hover:underline"
                >
                  ورود به رویداد آنلاین
                </a>
              ) : (
                event.bookingMode !== 'none' && <span className="block">لینک شرکت بعد از تأیید ثبت‌نام نشون داده می‌شه.</span>
              )}
            </InfoRow>
          )}

          {event.organizer && (
            <InfoRow icon={<Building2 />} title={`برگزارکننده: ${event.organizer.name}`}>
              {event.organizer.contact}
            </InfoRow>
          )}
        </ul>

        {!event.preview && <ReminderCard event={event} />}

        {event.description && (
          <>
            <Separator />
            <section className="flex flex-col gap-3" aria-labelledby="about-heading">
              <h2 id="about-heading" className="text-lg font-bold">
                درباره‌ی رویداد
              </h2>
              <EventDescription source={event.description} />
            </section>
          </>
        )}

        {event.tickets.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="tickets-heading">
            <h2 id="tickets-heading" className="text-lg font-bold">
              بلیت‌ها
            </h2>
            <ul className="flex flex-col gap-3">
              {event.tickets.map((ticket) => (
                <li key={ticket.id} className="flex flex-col gap-2 rounded-2xl border border-border p-4">
                  <span className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <Ticket aria-hidden="true" className="size-4 text-muted-foreground" />
                      {ticket.title}
                    </span>
                    <span className="text-sm font-semibold">{ticket.priceToman > 0 ? formatToman(ticket.priceToman) : 'رایگان'}</span>
                  </span>
                  {ticket.description && <span className="text-sm text-muted-foreground">{ticket.description}</span>}
                  {ticket.benefits.length > 0 && (
                    <ul className="list-disc ps-5 text-sm text-muted-foreground">
                      {ticket.benefits.map((benefit) => (
                        <li key={benefit}>{benefit}</li>
                      ))}
                    </ul>
                  )}
                  {ticket.availability !== 'available' && (
                    <Badge variant={ticket.availability === 'sold_out' ? 'warning' : 'outline'} className="w-fit">
                      {ticket.availability === 'sold_out' ? 'تکمیل ظرفیت' : 'ظرفیت محدود'}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {related.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="related-heading">
            <h2 id="related-heading" className="text-lg font-bold">
              رویدادهای مرتبط
            </h2>
            <EventsCarousel events={related} label="رویدادهای مرتبط" />
          </section>
        )}
      </ScreenBody>

      {/* An admin's preview shows the page, not the actions: nothing it does is recorded. */}
      {!event.preview && <EventBookingBar event={event} />}
    </Screen>
  );

  return event.preview ? screen : <EventActionsProvider event={event}>{screen}</EventActionsProvider>;
}
