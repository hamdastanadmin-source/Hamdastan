import { cn } from '@hamdastan/shared/cn';

import { XpAmount } from './XpAmount';

/**
 * «+۵۰ XP» rising and fading once (800ms) — the whole celebration of a
 * reward. No confetti, nothing that stays. Its parent positions it; it takes
 * no space and no taps. Reduced motion skips it, because the total beside it
 * already says the same thing.
 *
 * Announced politely, so a screen reader hears the reward too.
 */
export function XpGain({ value, className }: { value: number; className?: string }) {
  return (
    <span
      role="status"
      className={cn(
        'pointer-events-none text-sm font-semibold text-foreground animate-xp-float motion-reduce:hidden',
        className
      )}
    >
      <XpAmount value={value} signed />
    </span>
  );
}
