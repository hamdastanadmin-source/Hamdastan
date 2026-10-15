'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@hamdastan/shared/cn';
import type { PlayerMedia } from '@hamdastan/types';
import { useReducedMotion } from '@hamdastan/ui';

import { activitiesService } from '@/services';

import { useLottieData } from '../../hooks/use-lottie-data';

type LottieAnimation = { destroy(): void; goToAndStop(value: number, isFrame?: boolean): void };

/** A Lottie motion, with lottie-web's light build: SVG only, no expressions, no eval. */
function LottieView({ id, loop, still, onError }: { id: string; loop: boolean; still: boolean; onError?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const { data, failed } = useLottieData(id);

  useEffect(() => {
    if (failed) onError?.();
  }, [failed, onError]);

  useEffect(() => {
    if (!data || !box.current) return;
    let destroyed = false;
    let animation: LottieAnimation | null = null;
    import('lottie-web/build/player/lottie_light')
      .then(({ default: lottie }) => {
        if (destroyed || !box.current) return;
        animation = lottie.loadAnimation({
          container: box.current,
          renderer: 'svg',
          loop: loop && !still,
          autoplay: !still,
          animationData: structuredClone(data),
        });
        if (still) animation.goToAndStop(0, true);
      })
      .catch(() => onError?.());
    return () => {
      destroyed = true;
      animation?.destroy();
    };
  }, [data, loop, still, onError]);

  return <div ref={box} className="size-full" aria-hidden="true" />;
}

/**
 * One library file, drawn: an image whole and unstretched (or filling the
 * box, for a background), a video muted unless `sound`, a Lottie animation.
 * For anyone who asked their system for less motion, a motion holds still.
 * Whatever fails to load reports it, and the screen carries on without it.
 */
export function MediaView({
  media,
  alt = '',
  fill = false,
  loop = true,
  sound = false,
  onError,
  className,
}: {
  media: PlayerMedia;
  alt?: string;
  /** Cover the box, cropping — for a background. Otherwise the whole file shows. */
  fill?: boolean;
  loop?: boolean;
  sound?: boolean;
  onError?: () => void;
  className?: string;
}) {
  const still = useReducedMotion();
  const src = activitiesService.mediaUrl(media);
  const fit = fill ? 'object-cover' : 'object-contain';

  if (media.format === 'lottie') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <LottieView id={media.id} loop={loop} still={still} onError={onError} />
      </div>
    );
  }
  if (media.format === 'webm' || media.format === 'mp4') {
    return (
      <video
        src={src}
        className={cn('size-full', fit, className)}
        autoPlay={!still}
        loop={loop}
        muted={!sound}
        playsInline
        preload="auto"
        onError={onError}
        // A browser may refuse to play with sound before a tap; then it plays muted.
        onCanPlay={(event) => {
          const video = event.currentTarget;
          if (!still && video.paused) {
            video.play().catch(() => {
              video.muted = true;
              void video.play().catch(() => undefined);
            });
          }
        }}
        aria-hidden={alt ? undefined : true}
        aria-label={alt || undefined}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- served by our API, at most 250 KB, already sized.
    <img src={src} alt={alt} className={cn('size-full', fit, className)} onError={onError} decoding="async" />
  );
}
