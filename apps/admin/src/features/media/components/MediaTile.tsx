'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

import { MEDIA_CATEGORY_LABELS } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { MediaAsset } from '@hamdastan/types';
import { Badge } from '@hamdastan/ui';

import { formatSize } from '../utils/media';
import { MediaPreview } from './MediaPreview';

const FORMAT_LABELS: Record<MediaAsset['format'], string> = {
  png: 'PNG',
  jpeg: 'JPEG',
  webp: 'WebP',
  lottie: 'Lottie',
  webm: 'WebM',
  mp4: 'MP4',
};

/**
 * One file: its preview, name, shelf, format, size and how many activities
 * use it. In the picker it is a toggle — selection is a foreground border
 * and a check, never the brand colour.
 */
export function MediaTile({
  asset,
  selected,
  onSelect,
  menu,
}: {
  asset: MediaAsset;
  selected?: boolean;
  onSelect?: () => void;
  menu?: ReactNode;
}) {
  const body = (
    <>
      <div className="relative aspect-square w-full rounded-md bg-muted/50">
        <MediaPreview asset={asset} className="size-full p-2" />
        {selected && (
          <span className="absolute end-2 top-2 flex size-6 items-center justify-center rounded-full bg-foreground text-background">
            <Check aria-hidden="true" className="size-4" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 text-start">
        <span className="truncate text-sm font-medium">{asset.name}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{MEDIA_CATEGORY_LABELS[asset.category]}</Badge>
          <Badge variant="outline">{FORMAT_LABELS[asset.format]}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatSize(asset.sizeBytes)} · {asset.usage > 0 ? `در ${toPersianDigits(asset.usage)} فعالیت` : 'استفاده‌نشده'}
        </span>
      </div>
    </>
  );

  return (
    <div className={cn('relative flex flex-col gap-3 rounded-lg border p-3', selected && 'border-foreground')}>
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="flex flex-col gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </button>
      ) : (
        body
      )}
      {menu && <div className="absolute start-2 top-2">{menu}</div>}
    </div>
  );
}
