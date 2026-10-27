'use client';

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';

import type { ImageFrame } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { adminMediaService } from '@/services';

/** How far a file's proportions may be from the frame before it is worth a word: 8%. */
const RATIO_TOLERANCE = 0.08;

const size = (frame: ImageFrame) => `${toPersianDigits(frame.width)}×${toPersianDigits(frame.height)}`;

/** The recommended size, said before a file is chosen. */
export const frameHint = (frame: ImageFrame) => `اندازه‌ی مناسب: ${size(frame)} پیکسل (عرض × ارتفاع).`;

/**
 * A chosen image as the product will draw it: in the frame's proportions,
 * filled and cropped. Under it, a warning when the file's own proportions
 * or width do not fit — read from the image itself once it loads.
 */
export function FramedPreview({ asset, frame }: { asset: { id: string; version?: number }; frame: ImageFrame }) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const expected = frame.width / frame.height;
  const actual = natural ? natural.width / natural.height : expected;
  const offRatio = Math.abs(actual - expected) / expected > RATIO_TOLERANCE;
  const tooNarrow = natural !== null && natural.width < frame.width * 0.75;

  return (
    <div className="flex flex-col gap-2">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border bg-muted/50" style={{ aspectRatio: `${frame.width} / ${frame.height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- served by our API, already at most 512 KB. */}
        <img
          src={adminMediaService.fileUrl(asset)}
          alt=""
          className="size-full object-cover"
          onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        />
      </div>
      {natural && (offRatio || tooNarrow) ? (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning" role="status">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {`این فایل ${size(natural)} است؛ ${offRatio ? 'لبه‌های آن در اپلیکیشن بریده می‌شود' : 'برای این قاب کوچک است و تار دیده می‌شود'}. ${frameHint(frame)}`}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">در اپلیکیشن به همین شکل نمایش داده می‌شود.</p>
      )}
    </div>
  );
}
