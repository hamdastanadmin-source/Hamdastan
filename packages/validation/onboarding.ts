/**
 * The onboarding rules, written once.
 *
 * Stage 1 in `apps/web` and `PUT /me/onboarding/interests` in `apps/api` both
 * apply `interestSelectionError` to the same catalog, so the button cannot
 * enable on a selection the server would refuse. The catalog is data now
 * (the API serves it), so the rule takes it as an argument.
 */

import { MIN_INTEREST_CATEGORIES, type InterestCategory } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { z } from 'zod';

/** Every interest id in a catalog, mapped to its category's id. */
export function interestCategoryIndex(categories: readonly InterestCategory[]): Map<string, string> {
  return new Map(categories.flatMap((category) => category.interests.map(({ id }) => [id, category.id] as const)));
}

/** The distinct categories a set of interest ids covers. Unknown ids count for nothing. */
export function interestCategoryCount(interestIds: Iterable<string>, categoryOf: ReadonlyMap<string, string>): number {
  const categories = new Set<string>();
  for (const id of interestIds) {
    const category = categoryOf.get(id);
    if (category) categories.add(category);
  }
  return categories.size;
}

/** Why a selection would be refused, or null when it is fine. */
export function interestSelectionError(
  interestIds: readonly string[],
  categoryOf: ReadonlyMap<string, string>
): string | null {
  if (!interestIds.every((id) => categoryOf.has(id))) return 'یکی از علاقه‌مندی‌ها معتبر نیست';
  if (interestCategoryCount(interestIds, categoryOf) < MIN_INTEREST_CATEGORIES) {
    return `حداقل از ${toPersianDigits(MIN_INTEREST_CATEGORIES)} دسته انتخاب کن`;
  }
  return null;
}

/**
 * The selected interest ids — the request's shape. Duplicates are dropped,
 * so sending one id twice cannot count it twice; whether the ids are in the
 * catalog is `interestSelectionError`'s question. The cap bounds the request.
 */
export const interestsSchema = z.object({
  interestIds: z
    .array(z.string().trim().max(40), { error: 'علاقه‌مندی‌ها رو انتخاب کن' })
    .max(500)
    .transform((ids) => [...new Set(ids)]),
});

export type InterestsInput = z.infer<typeof interestsSchema>;

// ─── The admin panel ─────────────────────────────────────────────────────────

const label = (name: string) =>
  z.string().trim().min(1, { error: `${name} را وارد کنید` }).max(80, { error: `${name} حداکثر ۸۰ نویسه است` });

/** How many interests one category may hold — a bound on a screen of chips. */
export const INTERESTS_PER_CATEGORY_MAX = 60;

/** A category and its interests, saved together. Ids are the server's; a new interest has none. */
export const interestCategoryInputSchema = z.object({
  title: label('عنوان'),
  interests: z
    .array(z.object({ id: z.string().max(40).optional(), label: label('عنوان علاقه‌مندی') }))
    .min(1, { error: 'دست‌کم یک علاقه‌مندی اضافه کنید' })
    .max(INTERESTS_PER_CATEGORY_MAX, { error: `حداکثر ${toPersianDigits(INTERESTS_PER_CATEGORY_MAX)} علاقه‌مندی` }),
});

export type InterestCategoryInputBody = z.infer<typeof interestCategoryInputSchema>;

/**
 * An audience of interest categories (Engagement Studio, notifications).
 * Ids are not checked against the catalog: a category deleted since simply
 * matches nobody.
 */
export const interestCategoryIdsSchema = z
  .array(z.string().trim().min(1).max(40))
  .min(1, { error: 'حداقل یک گروه انتخاب کنید' })
  .max(100)
  .transform((ids) => [...new Set(ids)]);

/** A new order for a catalog list, by id. */
export const catalogReorderSchema = z.object({ ids: z.array(z.string().min(1).max(40)).min(1).max(500) });
