'use client';

import { useState } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ThisOrThatCard, ThisOrThatSettings } from '@hamdastan/types';
import { Button, Progress } from '@hamdastan/ui';

import { MediaPreview, useMediaAsset } from '@/features/media';

/** A card's image in the player's 3:4 tile; a blank tile until one is chosen. */
function CardImage({ card }: { card: ThisOrThatCard }) {
  const { asset } = useMediaAsset(card.imageId || null);
  return (
    <div className="aspect-3/4 w-full overflow-hidden rounded-xl bg-muted">
      {asset && <MediaPreview asset={asset} className="size-full" />}
    </div>
  );
}

const cardTitle = (cards: ThisOrThatCard[], card: ThisOrThatCard) =>
  card.title || `کارت ${toPersianDigits(cards.indexOf(card) + 1)}`;

/**
 * «این یا اون» as the player runs it, in the admin's order: tap a card,
 * the winner stays on against the next, until one is left. Played here
 * only — nothing is sent.
 */
export function ThisOrThatPreview({ settings }: { settings: ThisOrThatSettings }) {
  const { cards } = settings;
  const [winners, setWinners] = useState<string[]>([]);
  const champion = cards.find((card) => card.id === winners.at(-1)) ?? cards[0];
  const challenger = cards[winners.length + 1];
  const total = Math.max(1, cards.length - 1);

  if (!champion) return null;
  if (!challenger) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <Trophy aria-hidden="true" className="size-6 text-success" />
        <p className="text-sm font-semibold">انتخاب نهایی</p>
        <div className="w-1/2">
          <CardImage card={champion} />
        </div>
        <p className="text-base font-bold">{cardTitle(cards, champion)}</p>
        <Button variant="outline" size="sm" onClick={() => setWinners([])}>
          <RotateCcw aria-hidden="true" />
          از اول
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>این یا اون؟</span>
        <span className="tabular-nums">
          {toPersianDigits(winners.length + 1)} از {toPersianDigits(total)}
        </span>
      </div>
      <Progress value={(winners.length / total) * 100} className="h-0.5 bg-foreground/10 [&>[data-slot=progress-indicator]]:bg-foreground" />
      <div className="relative grid grid-cols-2 gap-3">
        {[champion, challenger].map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setWinners([...winners, card.id])}
            className="flex flex-col gap-2 rounded-xl text-start focus-visible:outline-2 focus-visible:outline-ring"
          >
            <CardImage card={card} />
            <span className="truncate text-center text-sm font-medium">{cardTitle(cards, card)}</span>
          </button>
        ))}
        {/* rtl-ok: centring between the two cards. */}
        <span className="pointer-events-none absolute left-1/2 top-[40%] flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-xs font-bold">
          VS
        </span>
      </div>
    </div>
  );
}
