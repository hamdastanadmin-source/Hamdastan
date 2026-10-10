import Link from 'next/link';

import type { ActivityCard as ActivityCardData } from '@hamdastan/types';

import { sortForDisplay } from '../utils/activity';
import { ActivityCard } from './ActivityCard';

/** How many home shows before «همه». */
const HOME_LIMIT = 3;

/**
 * Home's «فعالیت‌ها»: the open ones first, then the ones waiting for
 * review. Nothing at all when there is nothing to do.
 */
export function ActivitiesSection({ cards }: { cards: ActivityCardData[] }) {
  const relevant = sortForDisplay(cards).filter((card) => card.canSubmit || card.status === 'pending_review');
  if (relevant.length === 0) return null;

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
      <ul className="flex flex-col gap-3">
        {relevant.slice(0, HOME_LIMIT).map((card) => (
          <li key={card.id}>
            <ActivityCard card={card} />
          </li>
        ))}
      </ul>
    </section>
  );
}
