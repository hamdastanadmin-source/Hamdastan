import Link from 'next/link';

import type { ActivityCard as ActivityCardData } from '@hamdastan/types';

import { CardCarousel } from '@/components';

import { sortForDisplay } from '../utils/activity';
import { ActivityCard } from './ActivityCard';

/** How many home shows before «همه». */
const HOME_LIMIT = 3;

/**
 * Home's «فعالیت‌ها»: the open ones first, then the ones waiting for
 * review, side by side in a carousel like home's events — the next card
 * peeks in, a lone one takes the full width. Nothing at all when there is
 * nothing to do.
 */
export function ActivitiesSection({ cards }: { cards: ActivityCardData[] }) {
  const shown = sortForDisplay(cards)
    .filter((card) => card.canSubmit || card.status === 'pending_review')
    .slice(0, HOME_LIMIT);
  if (shown.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="activities-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="activities-heading" className="text-lg font-bold leading-tight">
          فعالیت‌ها
        </h2>
        <Link href="/activities" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          همه
        </Link>
      </div>
      <CardCarousel items={shown} label="فعالیت‌ها" renderCard={(card) => <ActivityCard card={card} className="h-full" />} />
    </section>
  );
}
