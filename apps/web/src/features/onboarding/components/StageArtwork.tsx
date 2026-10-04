import { getImageProps } from 'next/image';
import type { CSSProperties } from 'react';

/**
 * An animated owl that is part of the stage, not a clip playing on it.
 *
 * Every file is prepared the same way, so every screen that shows one places
 * it on the same line at the same scale: exported from
 * `assets/illustrations/<name>.webp` into `public/images/brand/` at 720×491,
 * framed so the subject keeps clear of the edges (at least 15% at the sides
 * and 11% top and bottom, in every frame), with the artwork's grey backdrop
 * lifted to white and a `<name>-still.webp` first frame beside it. On the
 * screen there is no frame and no corners: the edges fade out over that
 * clear margin — 14% at the sides, 10% top and bottom — so the fade never
 * reaches the subject.
 *
 * `my-auto` centres it in the space between the text and the footer, so it
 * lands in the same place on every screen however much text sits above it.
 * The parent must be a flex column that fills the body.
 *
 * Decorative — the text says everything — so `alt` is empty. `unoptimized`
 * because the image optimiser would hand back a single still frame. Reduced
 * motion gets the still: an animated image cannot be paused by
 * `motion-reduce`.
 */
export function StageArtwork({
  name,
  fadeIn = true,
  delayMs,
}: {
  name: string;
  /** Fade in rather than pop in, like a player would. */
  fadeIn?: boolean;
  delayMs?: number;
}) {
  const { props } = getImageProps({
    src: `/images/brand/${name}.webp`,
    alt: '',
    width: 720,
    height: 491,
    priority: true,
    unoptimized: true,
  });
  const style: CSSProperties | undefined = fadeIn && delayMs ? { animationDelay: `${delayMs}ms` } : undefined;

  return (
    <picture
      className={
        fadeIn
          ? 'pointer-events-none my-auto block select-none animate-in fade-in duration-700 fill-mode-backwards motion-reduce:animate-none'
          : 'pointer-events-none my-auto block select-none'
      }
      style={style}
    >
      <source media="(prefers-reduced-motion: reduce)" srcSet={`/images/brand/${name}-still.webp`} />
      <img
        {...props}
        alt=""
        draggable={false}
        className="h-auto w-full [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent),linear-gradient(transparent,black_10%,black_90%,transparent)] dark:opacity-90"
      />
    </picture>
  );
}
