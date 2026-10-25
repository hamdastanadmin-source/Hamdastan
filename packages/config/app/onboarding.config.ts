/**
 * Onboarding: how many stages there are, the rule stage 1 enforces, and the
 * shape of its catalog.
 *
 * The catalog itself is data — `v2_interest_categories` and `v2_interests`,
 * edited from the admin panel and served by `apps/api` with the person's
 * picks. The ids are the contract: they are what `v2_user_interests` stores.
 * A label can be reworded freely; an id never changes. Every interest id is
 * unique across the whole catalog, so an interest id alone is enough to
 * recover its category.
 */

/** The number of onboarding stages, for the progress indicator. */
export const ONBOARDING_STAGE_COUNT = 3;

/**
 * Stage 1 asks for breadth, not volume: interests from at least this many
 * different categories, and no ceiling on how many in total.
 */
export const MIN_INTEREST_CATEGORIES = 3;

export type Interest = { id: string; label: string };

export type InterestCategory = {
  id: string;
  title: string;
  interests: readonly Interest[];
};
