/**
 * Onboarding stage 1, as `apps/api` returns it — and the catalogs behind
 * both stages, as the admin panel edits them.
 */

import type { InterestCategory, Question, QuestionKind, SectionId } from '@hamdastan/config';

/**
 * The catalog, in display order, and the person's picks — ids only, in
 * catalog order. The categories are derived by the server from the
 * interests, never accepted from the client.
 */
export type OnboardingInterests = {
  /** The last onboarding stage the person has finished, `0` to `3`. */
  onboardingStage: number;
  categories: InterestCategory[];
  selectedCategories: string[];
  selectedInterests: string[];
};

// ─── The admin panel ─────────────────────────────────────────────────────────

/** A category as the panel lists it: the catalog row and how many people picked from it. */
export type AdminInterestCategory = InterestCategory & { pickedBy: number };

/**
 * Saving a category saves its interests with it, in order. An interest
 * without an id is new and gets one; one left out is removed.
 */
export type InterestCategoryInput = {
  title: string;
  interests: { id?: string; label: string }[];
};

/**
 * A question as the panel edits it. `scored` questions feed the scoring
 * engine: their kind and option codes are fixed and they cannot be deleted.
 */
export type AdminQuestion = Question & { scored: boolean };

/**
 * Saving a question. An option without a code is new and gets one; codes
 * already saved never change, only labels.
 */
export type QuestionInput = {
  section: SectionId;
  kind: QuestionKind;
  title: string;
  helper: string | null;
  maxSelections: number | null;
  minLabel: string | null;
  maxLabel: string | null;
  options: { code?: string; label: string }[];
};
