import type { ThisOrThatCard, ThisOrThatSettings } from '@hamdastan/types';

/**
 * «این یا اون» — the order one person meets the cards in. Pure.
 *
 * `manual` is the admin's order. `random` is a shuffle seeded by the person
 * and the version, so it is the same on every read — leaving and coming
 * back resumes the same run — and the API can check a submission against
 * it without storing it. Every response keeps its matches anyway
 * (`thisOrThatAnswers`), so the order is never needed to read one back.
 */

/** FNV-1a: a 32-bit hash of the seed. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** mulberry32: a small, well-spread generator in [0, 1). */
function generator(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cardOrder(settings: ThisOrThatSettings, seed: string): ThisOrThatCard[] {
  if (settings.order === 'manual') return settings.cards;
  const cards = [...settings.cards];
  const next = generator(hash(seed));
  // Fisher–Yates.
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
