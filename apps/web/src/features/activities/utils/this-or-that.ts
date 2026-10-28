import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ThisOrThatCard } from '@hamdastan/types';

/**
 * The two cards on screen after these picks. The winner keeps its side and
 * the next card takes the loser's, so nothing jumps across the screen.
 * Null once a single card is left.
 */
export function duelPair(cards: readonly ThisOrThatCard[], winners: readonly string[]): [ThisOrThatCard, ThisOrThatCard] | null {
  if (cards.length < 2 || winners.length >= cards.length - 1) return null;
  let pair: [ThisOrThatCard, ThisOrThatCard] = [cards[0], cards[1]];
  winners.forEach((winner, i) => {
    const next = cards[i + 2];
    pair = pair[0].id === winner ? [pair[0], next] : [next, pair[1]];
  });
  return pair;
}

/** A card as the person reads it: its title, else its number. */
export const cardLabel = (cards: readonly ThisOrThatCard[], card: ThisOrThatCard) =>
  card.title || `تصویر ${toPersianDigits(cards.indexOf(card) + 1)}`;
