import { describe, expect, it } from 'vitest';

import type { InterestCategory } from '@hamdastan/config';
import { interestCategoryIndex, interestSelectionError, interestsSchema } from '@hamdastan/validation';

import {
  canContinueInterests,
  selectedCategoryCount,
  withCategorySelection,
} from './interest-selection';

/** A catalog as the API serves it — the real one is data, edited from the panel. */
const CATALOG: InterestCategory[] = [
  { id: 'music', title: 'موسیقی', interests: [{ id: 'concert', label: '' }, { id: 'cinema', label: '' }, { id: 'rock', label: '' }] },
  { id: 'art', title: 'هنر', interests: [{ id: 'gallery', label: '' }, { id: 'photography', label: '' }] },
  { id: 'lifestyle', title: 'سبک زندگی', interests: [{ id: 'cafe', label: '' }, { id: 'yoga', label: '' }] },
];
const categoryOf = interestCategoryIndex(CATALOG);

describe('interest selection', () => {
  it('counts categories, not interests', () => {
    const many = new Set(['concert', 'cinema', 'rock', 'cafe', 'yoga']);
    expect(selectedCategoryCount(many, categoryOf)).toBe(2);
    expect(canContinueInterests(many, categoryOf)).toBe(false);
  });

  it('passes with picks in three categories, with no maximum', () => {
    const spread = new Set(['concert', 'cinema', 'rock', 'gallery', 'photography', 'cafe']);
    expect(canContinueInterests(spread, categoryOf)).toBe(true);
  });

  it('replaces one category without touching the others', () => {
    const next = withCategorySelection(new Set(['concert', 'cinema', 'photography']), CATALOG[0], ['rock']);
    expect([...next].sort()).toEqual(['photography', 'rock']);
  });

  it('refuses ids that are not in the catalog — the rule the API runs too', () => {
    expect(interestSelectionError(['concert', 'gallery', 'cafe'], categoryOf)).toBeNull();
    expect(interestSelectionError(['concert', 'gallery', 'cafe', 'no-such-id'], categoryOf)).toBe(
      'یکی از علاقه‌مندی‌ها معتبر نیست'
    );
  });

  it('the request schema dedupes repeats', () => {
    expect(interestsSchema.parse({ interestIds: ['concert', 'concert', 'gallery', 'cafe'] }).interestIds).toEqual([
      'concert',
      'gallery',
      'cafe',
    ]);
  });
});
