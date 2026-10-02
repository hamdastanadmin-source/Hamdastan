/**
 * The onboarding rules, written once.
 *
 * Stage 1 in `apps/web` and `PUT /me/onboarding/interests` in `apps/api` both
 * parse with this, so the button cannot enable on a selection the server
 * would refuse.
 */

import {
  INTEREST_CATEGORY_BY_ID,
  MIN_INTEREST_CATEGORIES,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { z } from 'zod';

/** The distinct categories a set of interest ids covers. Unknown ids count for nothing. */
export function interestCategoryCount(interestIds: Iterable<string>): number {
  const categories = new Set<string>();
  for (const id of interestIds) {
    const category = INTEREST_CATEGORY_BY_ID.get(id);
    if (category) categories.add(category);
  }
  return categories.size;
}

/**
 * The selected interest ids. Duplicates are dropped before the rules run, so
 * sending one id twice cannot count it twice. The array cap is a bound on the
 * request, not a product limit — it is larger than the whole catalog.
 */
export const interestsSchema = z.object({
  interestIds: z
    .array(z.string().trim().max(40), { error: 'علاقه‌مندی‌ها رو انتخاب کن' })
    .max(INTEREST_CATEGORY_BY_ID.size * 2)
    .transform((ids) => [...new Set(ids)])
    .refine((ids) => ids.every((id) => INTEREST_CATEGORY_BY_ID.has(id)), {
      error: 'یکی از علاقه‌مندی‌ها معتبر نیست',
    })
    .refine((ids) => interestCategoryCount(ids) >= MIN_INTEREST_CATEGORIES, {
      error: `حداقل از ${toPersianDigits(MIN_INTEREST_CATEGORIES)} دسته انتخاب کن`,
    }),
});

export type InterestsInput = z.infer<typeof interestsSchema>;
