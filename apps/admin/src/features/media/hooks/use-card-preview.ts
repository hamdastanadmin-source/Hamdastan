'use client';

import { useEffect, useState } from 'react';

import type { MediaAsset } from '@hamdastan/types';
import { drawResultCard, loadCardImage, type ResultCardContent } from '@hamdastan/ui/result-card';

import { withBasePath } from '@/lib';
import { adminMediaService } from '@/services';

/**
 * The character card exactly as the product draws it — the same renderer,
 * at 1080 × 1920 — as an image address for the builder's preview.
 */
export function useCardPreview(content: ResultCardContent, character: MediaAsset | null, logo: MediaAsset | null) {
  const [url, setUrl] = useState<string | null>(null);
  const key = JSON.stringify(content);

  useEffect(() => {
    let active = true;
    let made: string | null = null;
    (async () => {
      const [characterImage, logoImage] = await Promise.all([
        loadCardImage(character ? adminMediaService.fileUrl(character) : null),
        loadCardImage(logo ? adminMediaService.fileUrl(logo) : withBasePath('/images/brand/logo.svg')),
        document.fonts.ready,
      ]);
      if (!active) return;
      const canvas = document.createElement('canvas');
      drawResultCard(canvas, JSON.parse(key) as ResultCardContent, { character: characterImage, logo: logoImage });
      canvas.toBlob((blob) => {
        if (!active || !blob) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      }, 'image/png');
    })();
    return () => {
      active = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [key, character, logo]);

  return url;
}
