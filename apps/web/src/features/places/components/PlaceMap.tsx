import Link from 'next/link';
import { MapPin } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { PlaceView } from '@hamdastan/types';

import { placePath } from '@/lib';
import { worldsService } from '@/services';

/**
 * A place's image with the places inside it pinned where the admin put
 * them — each pin a link in. Positions are percent of the image, so they
 * hold at the column's width. Without an image, the same links as a list.
 */
export function PlaceMap({ place }: { place: PlaceView }) {
  const pins = place.pins.map((pin) => (
    <Link
      key={pin.id}
      href={placePath(place.world.slug, pin.id)}
      className="group flex min-h-11 items-center p-1 outline-none"
      aria-label={pin.taskCount > 0 ? `${pin.name}، ${toPersianDigits(pin.taskCount)} تسک` : pin.name}
    >
      <span className="flex items-center gap-1 rounded-full border bg-background/95 px-2.5 py-1.5 text-xs font-semibold shadow-md transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
        {pin.name}
        {/* No dot between: beside a Persian digit, «·» reads as «۰». */}
        {pin.taskCount > 0 && <span className="ms-1 font-normal text-muted-foreground">{toPersianDigits(pin.taskCount)} تسک</span>}
      </span>
    </Link>
  ));

  if (!place.imageId) {
    return pins.length > 0 ? <nav aria-label={`مکان‌های ${place.name}`} className="flex flex-wrap gap-1">{pins}</nav> : null;
  }

  return (
    <figure className="relative overflow-hidden rounded-2xl border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- served by our API from the library, at most 512 KB. */}
      <img src={worldsService.mediaUrl(place.imageId)} alt={place.name} className="block h-auto w-full" decoding="async" />
      <nav aria-label={`مکان‌های ${place.name}`}>
        {place.pins.map((pin, index) => (
          <div
            key={pin.id}
            // rtl-ok: a pin sits at its point on the image, measured from the image's left edge.
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            // rtl-ok: centred over its point with a translate, which does not mirror.
            className="absolute -translate-x-1/2 -translate-y-full"
          >
            {pins[index]}
          </div>
        ))}
      </nav>
    </figure>
  );
}
