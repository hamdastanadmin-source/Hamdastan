'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import type { PlayerMedia } from '@hamdastan/types';

import { MediaView } from '../journey/MediaView';

/**
 * One side of a match: the image, 3:4 and cropped to fill, its title
 * under it. Tapping it picks it. The winner lifts with a foreground border
 * and a check — never the brand colour — and the loser shrinks away; the
 * card that replaces it comes in, keyed by its id. Under reduced motion
 * nothing moves.
 */
export function DuelCard({
  media,
  label,
  title,
  state,
  disabled,
  onPick,
}: {
  media: PlayerMedia | undefined;
  /** What a screen reader hears: the title, else «تصویر n». */
  label: string;
  title: string;
  state: 'idle' | 'won' | 'lost';
  disabled: boolean;
  onPick: () => void;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={state === 'won'}
      className={cn(
        'flex min-w-0 touch-manipulation flex-col gap-2 rounded-2xl text-start outline-none transition-[transform,opacity] duration-300 ease-out focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300',
        state === 'idle' && 'active:scale-[0.97]',
        state === 'won' && 'scale-[1.04]',
        state === 'lost' && 'scale-90 opacity-0'
      )}
    >
      <span
        className={cn(
          'relative block aspect-3/4 w-full overflow-hidden rounded-2xl border bg-foreground/5 transition-colors duration-300',
          state === 'won' && 'border-2 border-foreground'
        )}
      >
        {media && !failed && <MediaView media={media} fill onError={() => setFailed(true)} />}
        {state === 'won' && (
          <span className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-full bg-foreground text-background motion-safe:animate-pop">
            <Check aria-hidden="true" className="size-4" />
          </span>
        )}
      </span>
      {/* Both titles keep the same height, so the two images always line up. */}
      <span className="line-clamp-2 min-h-10 text-center text-sm font-semibold leading-5">{title}</span>
    </button>
  );
}
