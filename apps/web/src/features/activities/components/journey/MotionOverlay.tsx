'use client';

import { useCallback, useEffect, useRef } from 'react';

import { Button } from '@hamdastan/ui';

import type { Playable } from '../../utils/journey';
import { BuiltinEffect } from './BuiltinEffect';
import { MediaView } from './MediaView';

/**
 * The short moment after an answer, in the middle of the screen: a file
 * from the library, one of the product's own effects, or just its caption.
 * It ends on its own after the admin's duration, on «رد کردن» or a tap
 * anywhere — and at once if its file fails to load, so the answering is
 * never held up. `onDone` runs once, however it ends.
 */
export function MotionOverlay({ playable, onDone }: { playable: Playable; onDone: () => void }) {
  const finished = useRef(false);
  const end = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }, [onDone]);

  const { durationMs } = playable.setting;
  useEffect(() => {
    const timer = setTimeout(end, durationMs);
    return () => clearTimeout(timer);
  }, [end, durationMs]);

  const { caption, sound } = playable.setting;

  return (
    <div
      // The column's width, like everything that leaves it: the app is a phone wherever it is opened.
      className="fixed inset-0 z-50 mx-auto flex max-w-shell flex-col items-center justify-center gap-6 bg-background/90 p-6 backdrop-blur-sm motion-safe:animate-enter-fade"
      role="status"
      aria-live="polite"
      onClick={end}
    >
      <div className="aspect-square w-full max-w-72">
        {playable.kind === 'file' && (
          <MediaView media={playable.media} loop={false} sound={sound} onError={end} className="size-full" />
        )}
        {playable.kind === 'builtin' && <BuiltinEffect effect={playable.setting.effect} />}
      </div>
      {caption && <p className="text-center text-xl font-bold motion-safe:animate-pop">{caption}</p>}
      <Button variant="ghost" className="text-muted-foreground" onClick={end}>
        رد کردن
      </Button>
    </div>
  );
}
