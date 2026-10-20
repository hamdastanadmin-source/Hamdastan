'use client';

import { useState, type ReactNode } from 'react';

import { cn } from '@hamdastan/shared/cn';

import { worldsService } from '@/services';

/**
 * A picture from the media library, filling its box. Without one — or if it
 * fails to load — a quiet tile with `fallback` (an icon), never a broken
 * image. The box's shape is the caller's (`className`).
 */
export function MediaImage({
  id,
  alt,
  fallback,
  className,
  priority = false,
}: {
  id: string | null;
  alt: string;
  fallback: ReactNode;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {id && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by our API, at most 250 KB, already sized.
        <img
          src={worldsService.mediaUrl(id)}
          alt={alt}
          className="size-full object-cover"
          decoding="async"
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground [&_svg]:size-8">{fallback}</div>
      )}
    </div>
  );
}
