import type { InterestCategory } from '@hamdastan/config';
import { interestCategoryCount, interestSelectionError } from '@hamdastan/validation';

/**
 * Stage 1's selection, as pure functions over one flat set of interest ids
 * and the catalog's interest → category index.
 *
 * The rule itself — at least three different categories, no maximum — is
 * `interestSelectionError` in `@hamdastan/validation`, the same function the
 * API runs against the same catalog. The button enables exactly when the
 * server would accept.
 */

export function selectedCategoryCount(selected: ReadonlySet<string>, categoryOf: ReadonlyMap<string, string>): number {
  return interestCategoryCount(selected, categoryOf);
}

export function canContinueInterests(selected: ReadonlySet<string>, categoryOf: ReadonlyMap<string, string>): boolean {
  return interestSelectionError([...selected], categoryOf) === null;
}

/** One category's picks, in catalog order — the value its toggle group holds. */
export function categorySelection(
  selected: ReadonlySet<string>,
  category: InterestCategory
): string[] {
  return category.interests.filter(({ id }) => selected.has(id)).map(({ id }) => id);
}

/**
 * Replaces one category's picks and leaves every other category alone.
 *
 * Each category is its own toggle group, which reports its full value on
 * every change; this folds that back into the one flat set.
 */
export function withCategorySelection(
  selected: ReadonlySet<string>,
  category: InterestCategory,
  values: readonly string[]
): Set<string> {
  const next = new Set(selected);
  for (const { id } of category.interests) next.delete(id);
  for (const id of values) next.add(id);
  return next;
}
