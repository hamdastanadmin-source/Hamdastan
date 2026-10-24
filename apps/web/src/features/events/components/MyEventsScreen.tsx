'use client';

import type { EventCard as EventCardData } from '@hamdastan/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';

import { EventCard } from './EventCard';
import { EventsEmpty } from './EventsEmpty';
import { SoonEventsSection } from './SoonEventsSection';

const TABS = [
  { id: 'interested', label: 'علاقه‌مندی‌ها', empty: 'هنوز رویدادی رو نشون نکردی', hint: 'روی «علاقه‌مندم» یک رویداد بزن تا اینجا بیاد.' },
  { id: 'booked', label: 'ثبت‌نام‌ها', empty: 'ثبت‌نام یا خریدی نداری', hint: 'ثبت‌نام‌ها و خریدهای در انتظار تأیید اینجا میان.' },
  { id: 'past', label: 'گذشته', empty: 'رویداد گذشته‌ای نیست', hint: 'رویدادهایی که برگزار شدن اینجا می‌مونن.' },
] as const;

type Tab = (typeof TABS)[number]['id'];

/** Three equal tabs; the selected one reads in the brand, like the rest of events' selections. */
const TRIGGER = 'flex-1 data-[state=active]:font-semibold data-[state=active]:text-primary';

/**
 * `/events/mine`: the person's events, reached from the profile — back goes there. Interest and bookings are separate
 * tabs, and every card says what the booking is — confirmed, waiting for
 * Fidibo's confirmation, or failed — so interest is never mistaken for a
 * place. «به‌زودی» on top is the in-app reminder.
 */
export function MyEventsScreen({ soon, lists }: { soon: EventCardData[]; lists: Record<Tab, EventCardData[] | null> }) {
  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/profile" label="پروفایل" iconOnly />
      </ScreenHeader>
      <ScreenBody className="gap-6 pt-1">
        <ScreenTitle title="رویدادهای من" />
        <SoonEventsSection events={soon} />
        <Tabs defaultValue="interested" className="gap-4">
          <TabsList className="grid w-full grid-cols-3">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className={TRIGGER}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((tab) => {
            const events = lists[tab.id];
            return (
              <TabsContent key={tab.id} value={tab.id}>
                {events === null ? (
                  <EventsEmpty title="این بخش باز نشد" description="کمی بعد دوباره سر بزن." />
                ) : events.length === 0 ? (
                  <EventsEmpty title={tab.empty} description={tab.hint} />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {events.map((card) => (
                      <li key={card.id}>
                        <EventCard card={card} />
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </ScreenBody>
    </Screen>
  );
}
