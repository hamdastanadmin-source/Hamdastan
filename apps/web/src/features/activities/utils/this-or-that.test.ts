import { describe, expect, it } from 'vitest';

import { duelPair } from './this-or-that';

const cards = ['a', 'b', 'c', 'd'].map((id) => ({ id, imageId: id, title: '' }));
const ids = (pair: ReturnType<typeof duelPair>) => pair?.map((card) => card.id) ?? null;

describe('duelPair', () => {
  it('starts with the first two cards', () => {
    expect(ids(duelPair(cards, []))).toEqual(['a', 'b']);
  });

  it('keeps the winner on its side and brings the next card in on the loser’s', () => {
    expect(ids(duelPair(cards, ['b']))).toEqual(['c', 'b']);
    expect(ids(duelPair(cards, ['b', 'c']))).toEqual(['c', 'd']);
  });

  it('is done once n − 1 picks are made', () => {
    expect(duelPair(cards, ['a', 'a', 'a'])).toBeNull();
  });
});
