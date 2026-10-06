'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@hamdastan/shared/cn';

/** One loop of `owl-detective.webp`: 60 frames, 5 seconds. */
const LOOP_MS = 5000;

/**
 * The detective owl, over the whole column, while a result is on its way —
 * the questionnaire's processing step and the profile's full result.
 *
 * It leaves only when both are true: one full loop has played since the image
 * loaded, and `ready`. A slow result keeps it looping. Then it fades out,
 * calls `onDone` and renders nothing.
 *
 * It must read as part of the screen, not a clip on it: the artwork is drawn
 * on white (`assets/illustrations/owl-detective.webp`, lifted to white and
 * framed like every other owl at 720×491), the screen is that white in both
 * themes, and the artwork's edges fade into it. An animated image has no
 * `ended` event, so the loop is timed from `load`.
 */
export function OwlLoader({ ready, onDone }: { ready: boolean; onDone?: () => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [playedOnce, setPlayedOnce] = useState(false);
  const [gone, setGone] = useState(false);
  const done = playedOnce && ready;

  useEffect(() => {
    // A cached image can finish loading before React attaches `onLoad`.
    const image = imageRef.current;
    if (image?.complete) {
      if (image.naturalWidth) setLoaded(true);
      else setPlayedOnce(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => setPlayedOnce(true), LOOP_MS);
    return () => clearTimeout(timer);
  }, [loaded]);

  if (gone) return null;

  return (
    <div
      role="status"
      aria-label="در حال آماده کردن نتیجه"
      onTransitionEnd={(event) => {
        if (!done || event.target !== event.currentTarget) return;
        setGone(true);
        onDone?.();
      }}
      className={cn(
        'fixed inset-0 z-50 mx-auto flex max-w-shell items-center justify-center bg-owl-backdrop px-5 transition-opacity duration-500',
        done && 'pointer-events-none opacity-0',
      )}
    >
      {/* `<img>`, not `next/image`: the optimiser would hand back a single still frame. */}
      <img
        ref={imageRef}
        src="/images/brand/owl-detective.webp"
        alt=""
        width={720}
        height={491}
        draggable={false}
        onLoad={() => setLoaded(true)}
        // Decoration: a result never waits behind a missing file.
        onError={() => setPlayedOnce(true)}
        className={cn(
          'pointer-events-none h-auto w-full select-none opacity-0 [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent),linear-gradient(transparent,black_10%,black_90%,transparent)]',
          loaded && 'opacity-100',
        )}
      />
    </div>
  );
}
