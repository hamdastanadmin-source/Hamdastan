'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { ImageOff, MapPin, Plus } from 'lucide-react';

import { PLACE_STATUS_LABELS } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import type { AdminPlaceSummary, PlacePin } from '@hamdastan/types';
import { Badge, Button } from '@hamdastan/ui';

import { adminMediaService } from '@/services';

import type { usePlaceActions } from '../hooks/use-place-actions';
import { PLACE_STATUS_BADGE } from '../utils/labels';
import { PlaceRowActions } from './PlaceRowActions';

type Pin = { id: string } & PlacePin;

const round = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 100) / 100;

/**
 * The place's image with the places inside it pinned on it, where the
 * person will see them. A pin is dragged into place, or a place is chosen
 * in the list and the image clicked where it goes. Positions are percent
 * of the image, so they hold at any size.
 */
export function PinBoard({
  image,
  places,
  pins,
  writable,
  canAdd,
  actions,
  onChange,
  onAdd,
}: {
  image: { id: string; version?: number } | null;
  /** The places inside this one. */
  places: AdminPlaceSummary[];
  pins: Pin[];
  writable: boolean;
  /** False at the second layer: nothing more goes inside. */
  canAdd: boolean;
  /** Each place's own actions — publish, unpublish, delete — from this list. */
  actions: ReturnType<typeof usePlaceActions>;
  onChange: (pins: Pin[]) => void;
  onAdd: () => void;
}) {
  const board = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const pinOf = (id: string) => pins.find((pin) => pin.id === id);

  /** The pointer's place on the image, in percent. */
  const at = (event: PointerEvent): PlacePin | null => {
    const rect = board.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    // rtl-ok: image coordinates run from the image's left edge, whatever the reading direction.
    return { x: round(((event.clientX - rect.left) / rect.width) * 100), y: round(((event.clientY - rect.top) / rect.height) * 100) };
  };

  const move = (id: string, to: PlacePin) => onChange(pins.map((pin) => (pin.id === id ? { ...pin, ...to } : pin)));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-2">
        {image ? (
          <div
            ref={board}
            className={cn('relative w-full overflow-hidden rounded-lg border bg-muted/40 select-none', writable && selected && 'cursor-crosshair')}
            onPointerDown={(event) => {
              if (!writable || !selected || event.target !== event.currentTarget.querySelector('img')) return;
              const to = at(event);
              if (to) move(selected, to);
            }}
            onPointerMove={(event) => {
              if (!dragging) return;
              const to = at(event);
              if (to) move(dragging, to);
            }}
            onPointerUp={() => setDragging(null)}
            onPointerCancel={() => setDragging(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- served by our API from the library. */}
            <img src={adminMediaService.fileUrl(image)} alt="" className="block h-auto w-full" draggable={false} />
            {places.map((place) => {
              const pin = pinOf(place.id);
              if (!pin) return null;
              return (
                <button
                  key={place.id}
                  type="button"
                  disabled={!writable}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setSelected(place.id);
                    setDragging(place.id);
                  }}
                  onKeyDown={(event) => {
                    const step = event.shiftKey ? 5 : 1;
                    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
                    if (!delta) return;
                    event.preventDefault();
                    move(place.id, { x: round(pin.x + delta[0]), y: round(pin.y + delta[1]) });
                  }}
                  // rtl-ok: a pin sits at its point on the image, measured from the image's left edge.
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  // rtl-ok: centred over its point with a translate, which does not mirror.
                  className={cn(
                    'absolute flex -translate-x-1/2 -translate-y-full touch-none items-center gap-1 rounded-full border bg-background/95 px-2.5 py-1 text-xs font-medium shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    writable && 'cursor-grab active:cursor-grabbing',
                    selected === place.id && 'border-foreground ring-2 ring-foreground/20'
                  )}
                  aria-label={`پین «${place.name}» — با کلیدهای جهت جابه‌جا می‌شود`}
                >
                  <MapPin aria-hidden="true" className="size-3.5" />
                  {place.name}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
            <ImageOff aria-hidden="true" className="size-6" />
            اول تصویر این مکان را در «مشخصات» انتخاب کنید تا مکان‌ها را روی آن پین کنید.
          </div>
        )}
        {image && places.length > 0 && writable && (
          <p className="text-xs text-muted-foreground">پین را بکشید، یا مکانی را از فهرست انتخاب کنید و روی تصویر بزنید. با کلیدهای جهت هم جابه‌جا می‌شود.</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {places.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {canAdd ? 'هنوز مکانی داخل این‌جا نیست.' : 'این مکان در لایه‌ی دوم است؛ مکانی داخلش ساخته نمی‌شود.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="مکان‌های داخل این‌جا">
            {places.map((place) => (
              <li
                key={place.id}
                className={cn('flex items-center gap-2 rounded-lg border p-2 ps-3 text-sm', selected === place.id && 'border-foreground bg-accent')}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-start outline-none focus-visible:underline"
                  onClick={() => setSelected(place.id)}
                  aria-pressed={selected === place.id}
                >
                  {place.name}
                </button>
                <Badge variant={PLACE_STATUS_BADGE[place.status]}>{PLACE_STATUS_LABELS[place.status]}</Badge>
                <PlaceRowActions place={place} actions={actions} writable={writable} />
              </li>
            ))}
          </ul>
        )}
        {writable && canAdd && (
          <Button type="button" variant="outline" onClick={onAdd}>
            <Plus aria-hidden="true" />
            مکان جدید داخل این‌جا
          </Button>
        )}
      </div>
    </div>
  );
}
