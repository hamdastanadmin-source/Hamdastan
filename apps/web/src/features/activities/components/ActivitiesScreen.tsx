import { Sparkles } from 'lucide-react';

import type { ActivityCard as ActivityCardData } from '@hamdastan/types';
import { IconBadge } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';

import { sortForDisplay } from '../utils/activity';
import { ActivityCard } from './ActivityCard';

/** `/activities`: every activity the person can do or has done. */
export function ActivitiesScreen({ cards }: { cards: ActivityCardData[] }) {
  const sorted = sortForDisplay(cards);

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/" />
      </ScreenHeader>
      <ScreenBody center={sorted.length === 0} className="gap-6">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <IconBadge tone="muted">
              <Sparkles aria-hidden="true" />
            </IconBadge>
            <ScreenTitle title="فعلاً فعالیتی نیست" description="نظرسنجی‌ها، مأموریت‌ها و آزمون‌های جدید همین‌جا میان." />
          </div>
        ) : (
          <>
            <ScreenTitle title="فعالیت‌ها" description="نظرسنجی، مأموریت و آزمون — انجامشون بده و XP بگیر." />
            <ul className="flex flex-col gap-3">
              {sorted.map((card) => (
                <li key={card.id}>
                  <ActivityCard card={card} />
                </li>
              ))}
            </ul>
          </>
        )}
      </ScreenBody>
    </Screen>
  );
}
