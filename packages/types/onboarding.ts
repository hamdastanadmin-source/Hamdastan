/**
 * Onboarding answers, as `apps/api` returns them.
 *
 * Ids only, in catalog order (`@hamdastan/config` holds the catalog). The
 * categories are derived by the server from the interests, never accepted
 * from the client.
 */
export type OnboardingInterests = {
  /** The last onboarding stage the person has finished, `0` to `3`. */
  onboardingStage: number;
  selectedCategories: string[];
  selectedInterests: string[];
};
