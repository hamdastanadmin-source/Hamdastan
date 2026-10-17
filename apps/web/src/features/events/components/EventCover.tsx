'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';

import { eventsService } from '@/services';

/**
 * An event's image from the media library, filling its box. Without one —
 * or if it fails to load — a quiet tile with the events icon, never a
 * broken image.
 */
export function EventCover({ id, alt, className }: { id: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {id && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by our API, at most 250 KB, already sized.
        <img
          src={eventsService.mediaUrl(id)}
          alt={alt}
          className="size-full object-cover"
          decoding="async"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-8" />
        </div>
      )}
    </div>
  );
}
