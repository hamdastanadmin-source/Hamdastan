'use client';

import { useState } from 'react';

import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { CoverEntryEffect, PlayerMedia, PlayerStep } from '@hamdastan/types';
import { Button } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenFooter, ScreenHeader } from '@/components';

import { MediaView } from './MediaView';
import { MotionDisplay } from './MotionDisplay';

/** How the cover comes in; under reduced motion it is simply there. */
const ENTRY: Record<CoverEntryEffect, string> = {
  none: '',
  fade: 'motion-safe:animate-enter-fade',
  slide_up: 'motion-safe:animate-enter-slide-up',
  zoom: 'motion-safe:animate-enter-zoom',
};

/**
 * The screen a day opens on: its number and name, the mascot in the middle,
 * the admin's line for the day, and the one action that starts it. A day
 * with no cover of its own gets this same screen, plainly. The admin's own
 * background (a colour, an image) sits behind; the words sit on the app's
 * surface, so they read whatever colour was chosen.
 */
export function DayCover({
  day,
  number,
  started,
  media,
  onBack,
  onStart,
}: {
  day: PlayerStep;
  number: number;
  /** Some of its questions are answered: the action continues rather than starts. */
  started: boolean;
  media: Record<string, PlayerMedia>;
  onBack: () => void;
  onStart: () => void;
}) {
  const cover = day.cover;
  const background = cover?.backgroundImageId ? media[cover.backgroundImageId] : undefined;
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  const custom = Boolean(cover?.background || (background && !backgroundFailed));

  return (
    <Screen className="relative isolate overflow-hidden">
      {cover?.background && (
        // The admin's colour for this day: content, not a design token.
        <div aria-hidden="true" className="absolute inset-0 -z-20" style={{ backgroundColor: cover.background }} />
      )}
      {background && !backgroundFailed && (
        <MediaView media={background} fill onError={() => setBackgroundFailed(true)} className="absolute inset-0 -z-10" />
      )}
      <ScreenHeader>
        <ScreenBack onClick={onBack} label="بازگشت به چالش" />
      </ScreenHeader>
      <ScreenBody center className={cn('items-center gap-6 text-center', ENTRY[cover?.entryEffect ?? 'fade'])}>
        {cover && <MotionDisplay setting={cover.mascot} media={media} className="aspect-square w-full max-w-60" />}
        <div className={cn('flex flex-col gap-3', custom && 'rounded-2xl bg-background/85 p-5 backdrop-blur-sm')}>
          <p className="text-sm font-semibold text-muted-foreground">
            روز {toPersianDigits(number)}
            {day.title && day.title !== `روز ${toPersianDigits(number)}` && `، ${day.title}`}
          </p>
          <h1 className="text-2xl font-bold leading-snug">{cover?.headline || day.title}</h1>
          {(cover?.text || day.description) && (
            <p className="text-base leading-relaxed text-muted-foreground">{cover?.text || day.description}</p>
          )}
        </div>
      </ScreenBody>
      <ScreenFooter className={cn(custom && 'bg-transparent')}>
        <Button size="xl" className="w-full" onClick={onStart}>
          {started ? 'ادامه' : cover?.buttonLabel || 'شروع'}
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
