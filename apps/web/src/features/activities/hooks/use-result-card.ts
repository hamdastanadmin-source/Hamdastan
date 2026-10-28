'use client';

import { useEffect, useState } from 'react';

import type { PlayerMedia } from '@hamdastan/types';
import { cardFile, drawResultCard, loadCardImage, type ResultCardContent } from '@hamdastan/ui/result-card';

import { activitiesService } from '@/services';
import type { SharedImage } from '@/lib';

/** The product's own logo, for a card whose admin chose none. */
const PRODUCT_LOGO = '/images/brand/logo.svg';

/**
 * A result card as a real PNG — drawn on a canvas at 1080 × 1920 — and an
 * address to show it at: a journey's character, or a personality test's
 * outcome. Redrawn when what is on it changes (the person turning their name
 * on or off); nothing is drawn while `content` is null.
 */
export function useResultCard(
  content: ResultCardContent | null,
  images: { character?: PlayerMedia; logo?: PlayerMedia },
  fileName: string
) {
  const [card, setCard] = useState<SharedImage | null>(null);
  const { character, logo } = images;
  // A fresh object each render: the drawing follows what is in it, not its identity.
  const key = content && JSON.stringify(content);

  useEffect(() => {
    if (!key) return;
    let active = true;
    let url: string | null = null;
    (async () => {
      const [characterImage, logoImage] = await Promise.all([
        loadCardImage(character ? activitiesService.mediaUrl(character) : null),
        loadCardImage(logo ? activitiesService.mediaUrl(logo) : PRODUCT_LOGO),
        // The card's words are in the app's own font: wait until it is there.
        document.fonts.ready,
      ]);
      if (!active) return;
      const canvas = document.createElement('canvas');
      drawResultCard(canvas, JSON.parse(key) as ResultCardContent, { character: characterImage, logo: logoImage });
      const file = await cardFile(canvas, fileName);
      if (!active || !file) return;
      url = URL.createObjectURL(file);
      setCard({ file, url });
    })();
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, character, logo, fileName]);

  return card;
}
