import { describe, expect, it } from 'vitest';

import { INTEREST_CATEGORIES, INTEREST_CATEGORY_BY_ID } from '@hamdastan/config';
import { interestsSchema } from '@hamdastan/validation';

import {
  canContinueInterests,
  selectedCategoryCount,
  withCategorySelection,
} from './interest-selection';

const idsOf = (categoryId: string, count: number) =>
  INTEREST_CATEGORIES.find(({ id }) => id === categoryId)!
    .interests.slice(0, count)
    .map(({ id }) => id);

describe('interest selection', () => {
  it('has globally unique interest ids', () => {
    const ids = INTEREST_CATEGORIES.flatMap(({ interests }) => interests.map(({ id }) => id));
    expect(INTEREST_CATEGORY_BY_ID.size).toBe(ids.length);
  });

  it('counts categories, not interests', () => {
    const many = new Set([...idsOf('music', 10), ...idsOf('lifestyle', 5)]);
    expect(selectedCategoryCount(many)).toBe(2);
    expect(canContinueInterests(many)).toBe(false);
  });

  it('passes with picks in three categories, with no maximum', () => {
    const spread = new Set([...idsOf('music', 10), ...idsOf('art', 9), ...idsOf('lifestyle', 1)]);
    expect(canContinueInterests(spread)).toBe(true);
  });

  it('replaces one category without touching the others', () => {
    const next = withCategorySelection(
      new Set(['concert', 'cinema', 'photography']),
      INTEREST_CATEGORIES[0],
      ['rock']
    );
    expect([...next].sort()).toEqual(['photography', 'rock']);
  });

  it('the API schema rejects unknown ids and dedupes repeats', () => {
    expect(
      interestsSchema.safeParse({ interestIds: ['concert', 'gallery', 'cafe', 'no-such-id'] }).success
    ).toBe(false);
    expect(
      interestsSchema.parse({ interestIds: ['concert', 'concert', 'gallery', 'cafe'] }).interestIds
    ).toEqual(['concert', 'gallery', 'cafe']);
  });
});
