import { Fragment } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import type { PlaceView } from '@hamdastan/types';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';
import { ActivityCard } from '@/features/activities';
import { placeActivityPath, placePath } from '@/lib';

import { PlaceMap } from './PlaceMap';

/**
 * `/worlds/:slug/places/:id`: a place — its image with the places inside it
 * pinned on it, and the tasks done here. One step down from where it is
 * pinned; the map itself is the world's home, so a place on the map leads
 * back there.
 */
export function PlaceScreen({ place }: { place: PlaceView }) {
  const home = `/worlds/${place.world.slug}`;
  // The trail is map → … → here; the map's page is the world's home.
  const hrefOf = (index: number) => (index === 0 ? home : placePath(place.world.slug, place.trail[index].id));
  const parentIndex = place.trail.length - 2;
  const empty = place.pins.length === 0 && place.tasks.length === 0;

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href={parentIndex >= 0 ? hrefOf(parentIndex) : home} label={parentIndex > 0 ? place.trail[parentIndex].name : place.world.name} />
      </ScreenHeader>
      <ScreenBody className="gap-5 pt-1">
        <Breadcrumb>
          <BreadcrumbList>
            {place.trail.map((step, index) => (
              <Fragment key={step.id}>
                {index > 0 && (
                  // The way runs right to left, deeper each step: the chevron points on, to the place inside.
                  <BreadcrumbSeparator>
                    <ChevronLeft />
                  </BreadcrumbSeparator>
                )}
                <BreadcrumbItem>
                  {index === place.trail.length - 1 ? (
                    <BreadcrumbPage>{step.name}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={hrefOf(index)}>{step.name}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        <ScreenTitle title={place.name} description={place.summary || undefined} />

        <PlaceMap place={place} />

        {place.tasks.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="place-tasks">
            <h2 id="place-tasks" className="text-lg font-bold leading-tight">
              تسک‌های این‌جا
            </h2>
            <ul className="flex flex-col gap-3">
              {place.tasks.map((card) => (
                <li key={card.id}>
                  <ActivityCard card={card} withWorld={false} href={placeActivityPath(card.id, place.world.slug, place.id)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {empty && <p className="py-6 text-center text-sm text-muted-foreground">این‌جا هنوز تسکی نیست.</p>}
      </ScreenBody>
    </Screen>
  );
}
