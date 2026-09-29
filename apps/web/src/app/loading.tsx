import { Skeleton } from '@hamdastan/ui';

import { Screen, ScreenBody, ScreenFooter, ScreenHeader } from '@/components';

/**
 * The shape of a screen before it has content: a title, a few lines, and the
 * primary action. It mirrors `Screen` rather than inventing a layout of its
 * own, so the skeleton occupies the same space the page is about to.
 */
export default function Loading() {
  return (
    <Screen>
      <ScreenHeader />
      <ScreenBody className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      </ScreenBody>
      <ScreenFooter>
        <Skeleton className="h-12 w-full" />
      </ScreenFooter>
    </Screen>
  );
}
