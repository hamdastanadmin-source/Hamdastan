'use client';

import { useState } from 'react';

import { cn } from '@hamdastan/shared/cn';
import type { PlayerMedia } from '@hamdastan/types';

import { MediaView } from './journey/MediaView';

/**
 * A question's image, above its text or between the text and the answers,
 * as the admin chose: whole, within a fixed height, never stretched. If it
 * fails to load it is simply not there — the question still is. A
 * result's image and the done screen's image are drawn the same way.
 */
export function QuestionImage({ media, className }: { media: PlayerMedia; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div
      className={cn(
        'flex aspect-video max-h-64 w-full items-center justify-center overflow-hidden rounded-2xl bg-foreground/5',
        className
      )}
    >
      <MediaView media={media} onError={() => setFailed(true)} />
    </div>
  );
}
