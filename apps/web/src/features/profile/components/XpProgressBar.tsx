'use client';

import { useEffect, useState } from 'react';

import type { AccountProgress } from '@hamdastan/types';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { Progress } from '@hamdastan/ui';

import { XpAmount, XpGain } from '@/components';

/**
 * Level, XP and the way to the next level, on one neutral bar.
 *
 * The bar is foreground on a faint track — never the brand: violet is the
 * primary action's alone. When the hub is opened straight after a reward
 * (`gained`), the bar starts where it stood before and eases to where it is
 * now (700ms) while «+n XP» rises off it; crossing into a new level starts
 * from that level's empty bar. Reduced motion shows the end state.
 */

const percentOf = (xp: number, start: number, next: number | null) =>
  next === null ? 100 : Math.max(0, Math.min(100, ((xp - start) / (next - start)) * 100));

export function XpProgressBar({ progress, gained = 0 }: { progress: AccountProgress; gained?: number }) {
  const { xpTotal, level, levelStartXp, nextLevelXp } = progress;
  const target = percentOf(xpTotal, levelStartXp, nextLevelXp);
  const [value, setValue] = useState(() =>
    gained > 0 ? percentOf(xpTotal - gained, levelStartXp, nextLevelXp) : target
  );

  useEffect(() => {
    // Next frame, so the starting width paints first and the change animates.
    const frame = requestAnimationFrame(() => setValue(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);

  useEffect(() => {
    // The reward has been shown; a refresh should not replay it.
    if (gained > 0) window.history.replaceState(null, '', window.location.pathname);
  }, [gained]);

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">سطح {toPersianDigits(level)}</span>
        <span className="relative text-xs text-muted-foreground">
          <XpAmount value={xpTotal} of={nextLevelXp} />
          {gained > 0 && <XpGain value={gained} className="absolute -top-5 end-0" />}
        </span>
      </div>

      <Progress
        value={value}
        aria-label="پیشرفت تا سطح بعد"
        className="h-1.5 bg-foreground/10 [&>[data-slot=progress-indicator]]:bg-foreground [&>[data-slot=progress-indicator]]:duration-700 [&>[data-slot=progress-indicator]]:ease-out motion-reduce:[&>[data-slot=progress-indicator]]:transition-none"
      />

      <p className="text-xs text-muted-foreground">
        {nextLevelXp === null ? (
          'به بالاترین سطح رسیدی'
        ) : (
          <>
            <XpAmount value={nextLevelXp - xpTotal} /> تا سطح بعد
          </>
        )}
      </p>
    </div>
  );
}
