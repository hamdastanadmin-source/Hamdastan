'use client';

import { useState } from 'react';

import type { PlayerMedia } from '@hamdastan/types';

import { MediaView } from './journey/MediaView';

/**
 * A question's image, above its text or between the text and the answers,
 * as the admin chose: whole, within a fixed height, never stretched. If it
 * fails to load it is simply not there — the question still is.
 */
export function QuestionImage({ media }: { media: PlayerMedia }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="flex aspect-video max-h-64 w-full items-center justify-center overflow-hidden rounded-2xl bg-foreground/5">
      <MediaView media={media} onError={() => setFailed(true)} />
    </div>
  );
}
