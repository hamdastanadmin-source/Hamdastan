'use client';

import { useEffect, useState } from 'react';

import type { PlayerJourneyResult, PlayerMedia } from '@hamdastan/types';
import { cardFile, drawResultCard, loadCardImage } from '@hamdastan/ui/result-card';

import { activitiesService } from '@/services';

/** The product's own logo, for a card whose admin chose none. */
const PRODUCT_LOGO = '/images/brand/logo.svg';

/**
 * The person's character card as a real PNG — drawn on a canvas from the
 * kept result, at 1080 × 1920 — and an address to show it at. Redrawn when
 * the person turns their name on or off.
 */
export function useResultCard(result: PlayerJourneyResult, media: Record<string, PlayerMedia>, userName: string | null) {
  const [card, setCard] = useState<{ file: File; url: string } | null>(null);
  const character = result.character.imageId ? media[result.character.imageId] : undefined;
  const logo = result.card.logoId ? media[result.card.logoId] : undefined;

  useEffect(() => {
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
      drawResultCard(
        canvas,
        {
          name: result.character.name,
          title: result.character.title,
          description: result.character.description,
          userName,
          brandName: result.card.brandName,
          background: result.card.background,
        },
        { character: characterImage, logo: logoImage }
      );
      const file = await cardFile(canvas, `hamdastan-${result.character.name}`);
      if (!active || !file) return;
      url = URL.createObjectURL(file);
      setCard({ file, url });
    })();
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [result, character, logo, userName]);

  return card;
}
