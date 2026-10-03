import { cn } from '@hamdastan/shared/cn';

import { XpAmount } from '@/components';

/** «+۵۰ XP» on a mission — a quiet neutral pill, never the brand. */
export function RewardChip({ xp, muted = false }: { xp: number; muted?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium',
        muted ? 'text-muted-foreground' : 'text-foreground'
      )}
    >
      <XpAmount value={xp} signed />
    </span>
  );
}
