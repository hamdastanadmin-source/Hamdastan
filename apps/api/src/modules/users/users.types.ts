import type { Gender, UserRole } from '@hamdastan/types';

/**
 * Types internal to the Users module.
 *
 * `AuthUser` in `@hamdastan/types` is what leaves the API. `UserRecord` is
 * what the repository returns: the same person plus the two columns the
 * browser has no business seeing — where they are in onboarding, and whether
 * the account is suspended.
 */

/** `v2_users.onboarding_step`. `done` is the only finished value. */
export type OnboardingStep = 'basic_info' | 'onboarding' | 'done';

export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export type UserRecord = {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  /** Gregorian `YYYY-MM-DD`, exactly as the `date` column holds it. */
  birthDate: string | null;
  gender: Gender | null;
  displayName: string | null;
  onboardingStep: OnboardingStep;
  role: UserRole;
  status: UserStatus;
};

/** The four fields the basic-info form collects, already validated. */
export type BasicInfo = {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: Gender;
};
