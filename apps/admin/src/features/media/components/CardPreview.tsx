'use client';

import type { ResultCardContent } from '@hamdastan/ui/result-card';
import { Skeleton } from '@hamdastan/ui';

import { useCardPreview } from '../hooks/use-card-preview';
import { useMediaAsset } from '../hooks/use-media-asset';

/** The shareable card as people will get it, small. */
export function CardPreview({
  content,
  characterImageId,
  logoId,
}: {
  content: ResultCardContent;
  characterImageId: string | null;
  logoId: string | null;
}) {
  const { asset: character } = useMediaAsset(characterImageId);
  const { asset: logo } = useMediaAsset(logoId);
  const url = useCardPreview(content, character, logo);

  return (
    <div className="aspect-[9/16] w-56 overflow-hidden rounded-xl border">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a PNG drawn here, shown as is.
        <img src={url} alt="پیش‌نمایش کارت شخصیت" className="size-full object-contain" />
      ) : (
        <Skeleton className="size-full" />
      )}
    </div>
  );
}
