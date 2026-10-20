import type { PlayerMatchingQuestion } from '@hamdastan/types';
import { describe, expect, it } from 'vitest';

import { matchingFromValue, matchingValue, pairNumber, tapMatching } from './matching';

const question: PlayerMatchingQuestion = {
  id: 'q',
  kind: 'matching',
  title: 'جفت کن',
  required: true,
  prompts: [
    { id: 'p1', label: 'سیب' },
    { id: 'p2', label: 'موز' },
  ],
  matches: [
    { id: 'm2', label: 'زرد' },
    { id: 'm1', label: 'قرمز' },
  ],
};

const empty = matchingFromValue(question, undefined);

describe('matching', () => {
  it('pairs a prompt with a match tapped in either order', () => {
    const one = tapMatching(tapMatching(empty, 'prompt', 'p1'), 'match', 'm1');
    const two = tapMatching(tapMatching(one, 'match', 'm2'), 'prompt', 'p2');
    expect(two.pairs).toEqual({ p1: 'm1', p2: 'm2' });
    expect(matchingValue(question, two)).toEqual(['m1', 'm2']);
  });

  it('is unanswered until every prompt has a match', () => {
    const one = tapMatching(tapMatching(empty, 'prompt', 'p1'), 'match', 'm1');
    expect(matchingValue(question, one)).toBeUndefined();
  });

  it('moves the waiting tile on the same side, and lets go when tapped again', () => {
    const moved = tapMatching(tapMatching(empty, 'prompt', 'p1'), 'prompt', 'p2');
    expect(moved.pending).toEqual({ side: 'prompt', id: 'p2' });
    expect(tapMatching(moved, 'prompt', 'p2').pending).toBeNull();
  });

  it('takes a pair apart when either of its tiles is tapped', () => {
    const paired = tapMatching(tapMatching(empty, 'prompt', 'p1'), 'match', 'm1');
    const apart = tapMatching(paired, 'match', 'm1');
    expect(apart.pairs).toEqual({});
    expect(apart.pending).toEqual({ side: 'match', id: 'm1' });
  });

  it('restores a saved answer and numbers each pair by its prompt', () => {
    const state = matchingFromValue(question, ['m1', 'm2']);
    expect(pairNumber(question, state, 'match', 'm2')).toBe(2);
    expect(pairNumber(question, state, 'prompt', 'p1')).toBe(1);
  });
});
