'use client';

import { useEffect, useRef, useState } from 'react';
import { FileWarning } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import type { MediaFormat } from '@hamdastan/types';
import { useReducedMotion } from '@hamdastan/ui';

import { adminMediaService } from '@/services';

import { useLottieData } from '../hooks/use-lottie-data';

type Previewable = { id: string; format: MediaFormat; version: number; name?: string };

function Broken() {
  return (
    <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
      <FileWarning aria-hidden="true" className="size-5" />
      پیش‌نمایش در دسترس نیست
    </span>
  );
}

/** Draws a Lottie motion with lottie-web's light build: SVG only, no expressions, no eval. */
function LottiePreview({ asset, still }: { asset: Previewable; still: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const { data, failed } = useLottieData(asset.id, asset.version);

  useEffect(() => {
    if (!data || !box.current) return;
    let destroyed = false;
    let animation: { destroy(): void; goToAndStop(value: number, isFrame?: boolean): void } | null = null;
    import('lottie-web/build/player/lottie_light').then(({ default: lottie }) => {
      if (destroyed || !box.current) return;
      animation = lottie.loadAnimation({
        container: box.current,
        renderer: 'svg',
        loop: !still,
        autoplay: !still,
        animationData: structuredClone(data),
      });
      if (still) animation.goToAndStop(0, true);
    });
    return () => {
      destroyed = true;
      animation?.destroy();
    };
  }, [data, still]);

  if (failed) return <Broken />;
  return <div ref={box} className="size-full" aria-hidden="true" />;
}

/**
 * A library file as it will look: an image fitted without cropping, a video
 * muted and looping, a Lottie animation drawn — or, for anyone who asked
 * their system for less motion, the first frame held still.
 */
export function MediaPreview({ asset, className }: { asset: Previewable; className?: string }) {
  const still = useReducedMotion();
  const [broken, setBroken] = useState(false);
  const src = adminMediaService.fileUrl(asset);

  return (
    <div className={cn('flex items-center justify-center overflow-hidden', className)}>
      {broken ? (
        <Broken />
      ) : asset.format === 'lottie' ? (
        <LottiePreview asset={asset} still={still} />
      ) : asset.format === 'webm' || asset.format === 'mp4' ? (
        <video
          key={src}
          src={src}
          className="size-full object-contain"
          muted
          loop={!still}
          autoPlay={!still}
          playsInline
          preload="metadata"
          onError={() => setBroken(true)}
          aria-label={asset.name}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- served by our API, already at most 250 KB.
        <img src={src} alt={asset.name ?? ''} className="size-full object-contain" loading="lazy" onError={() => setBroken(true)} />
      )}
    </div>
  );
}
