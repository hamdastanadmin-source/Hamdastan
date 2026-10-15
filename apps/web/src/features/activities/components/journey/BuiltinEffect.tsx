'use client';

import { PartyPopper, Sparkles, ThumbsUp } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import type { BuiltinMotionEffect } from '@hamdastan/types';

/** Confetti in the success, warning and foreground tones — never the brand colour. */
const PIECE_TONES = ['bg-success', 'bg-warning', 'bg-foreground/60'];

/** Spread by index, so the pieces fall the same way on every render. */
const PIECES = Array.from({ length: 24 }, (_, i) => ({
  start: `${(i * 37) % 100}%`,
  delay: `${(i * 53) % 400}ms`,
  tone: PIECE_TONES[i % PIECE_TONES.length],
  round: i % 3 === 0,
}));

const SPARKS = [
  { start: '20%', top: '25%', delay: '0ms' },
  { start: '70%', top: '20%', delay: '150ms' },
  { start: '45%', top: '60%', delay: '300ms' },
  { start: '80%', top: '65%', delay: '450ms' },
  { start: '15%', top: '70%', delay: '200ms' },
];

/**
 * The product's own simple motions, drawn with CSS: confetti, a pop, a
 * sparkle, a thumbs-up. Under reduced motion they show as a still icon.
 */
export function BuiltinEffect({ effect }: { effect: BuiltinMotionEffect }) {
  if (effect === 'confetti') {
    return (
      <div className="pointer-events-none relative size-full overflow-hidden" aria-hidden="true">
        {PIECES.map((piece, i) => (
          <span
            key={i}
            className={cn(
              'absolute top-0 size-2.5 opacity-0 motion-safe:animate-confetti motion-reduce:hidden',
              piece.tone,
              piece.round ? 'rounded-full' : 'rounded-sm'
            )}
            style={{ insetInlineStart: piece.start, animationDelay: piece.delay }}
          />
        ))}
        <PartyPopper className="absolute inset-0 m-auto size-20 text-foreground motion-safe:animate-pop" />
      </div>
    );
  }
  if (effect === 'sparkle') {
    return (
      <div className="pointer-events-none relative size-full" aria-hidden="true">
        {SPARKS.map((spark, i) => (
          <Sparkles
            key={i}
            className="absolute size-8 text-warning opacity-0 motion-safe:animate-twinkle motion-reduce:opacity-100"
            style={{ insetInlineStart: spark.start, top: spark.top, animationDelay: spark.delay }}
          />
        ))}
      </div>
    );
  }
  const Icon = effect === 'thumbs_up' ? ThumbsUp : PartyPopper;
  return (
    <div className="flex size-full items-center justify-center" aria-hidden="true">
      <Icon className="size-24 text-foreground motion-safe:animate-pop" />
    </div>
  );
}
