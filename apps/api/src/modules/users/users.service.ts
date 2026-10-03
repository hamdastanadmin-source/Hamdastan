import { INTEREST_CATEGORIES, INTEREST_CATEGORY_BY_ID } from '@hamdastan/config';
import type {
  AuthUser,
  NextStep,
  OnboardingInterests,
  SessionResponse,
} from '@hamdastan/types';

import { ForbiddenError, NotFoundError } from '../../shared/errors';

import { usersRepository } from './users.repository';
import type { BasicInfo, OnboardingInterestsRecord, UserRecord } from './users.types';

/**
 * Business logic for the Users module — the account itself, and the one
 * question the whole front-end is built around: where does this person go
 * next?
 *
 * `nextStepFor` is deliberately here and not in the browser. The client is
 * never allowed to decide that a profile is complete; it renders the answer
 * this function gives, which is why a half-filled account cannot be walked
 * past by editing a URL.
 */

/** Strips everything the browser has no business knowing. */
export function toAuthUser(record: UserRecord): AuthUser {
  return {
    id: record.id,
    phone: record.phone,
    firstName: record.firstName,
    lastName: record.lastName,
    birthDate: record.birthDate,
    gender: record.gender,
    displayName: record.displayName,
    role: record.role,
  };
}

/**
 * The routing table, as one expression.
 *
 * The basic-info test is on the columns rather than on `onboarding_step`,
 * because the column is bookkeeping and the columns are the truth: a row
 * whose step somehow says `onboarding` while `first_name` is null still has
 * a form to fill in.
 */
export function nextStepFor(record: UserRecord): NextStep {
  const profileComplete =
    record.firstName !== null &&
    record.lastName !== null &&
    record.birthDate !== null &&
    record.gender !== null;

  if (!profileComplete) return 'basic_info';
  return record.onboardingStep === 'done' ? 'home' : 'onboarding';
}

export function toSession(record: UserRecord): SessionResponse {
  return { user: toAuthUser(record), nextStep: nextStepFor(record) };
}

/**
 * The stored answers, in catalog order, with the categories derived from the
 * interests. An id that has since left the catalog is dropped rather than
 * sent back to a screen that has no chip for it.
 */
export function toOnboardingInterests(record: OnboardingInterestsRecord): OnboardingInterests {
  const saved = new Set(record.interestIds);
  const categories = INTEREST_CATEGORIES.filter((category) =>
    category.interests.some(({ id }) => saved.has(id))
  );

  return {
    onboardingStage: record.onboardingStage,
    selectedCategories: categories.map(({ id }) => id),
    selectedInterests: categories.flatMap((category) =>
      category.interests.filter(({ id }) => saved.has(id)).map(({ id }) => id)
    ),
  };
}

export const usersService = {
  /** Throws rather than returning null: every caller here has a session. */
  async getById(id: string): Promise<UserRecord> {
    const user = await usersRepository().findById(id);
    if (!user) throw new NotFoundError('کاربر یافت نشد');
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenError('حساب کاربری شما غیرفعال شده است');
    }
    return user;
  },

  async findByPhone(phone: string): Promise<UserRecord | null> {
    return usersRepository().findByPhone(phone);
  },

  /**
   * The account a verified code is entitled to. Called only by the auth
   * service, and only after the code has been checked — this is the moment
   * the spec calls "the account is created at verification", so a person who
   * abandons the basic-info form still has their verified number on file.
   */
  async ensureByPhone(phone: string): Promise<{ user: UserRecord; isNew: boolean }> {
    const existing = await usersRepository().findByPhone(phone);
    if (existing) return { user: existing, isNew: false };
    return { user: await usersRepository().createWithPhone(phone), isNew: true };
  },

  async saveBasicInfo(id: string, info: BasicInfo): Promise<UserRecord> {
    await this.getById(id);
    return usersRepository().saveBasicInfo(id, info);
  },

  /**
   * The end of onboarding. Only the server says it is over: the questionnaire
   * (stage 2) has to be finished first, so a client cannot call this to skip
   * it. Stage 3 is not built yet; when it is, this checks for it instead.
   */
  async completeOnboarding(id: string): Promise<UserRecord> {
    await this.getById(id);
    const { onboardingStage } = await usersRepository().findOnboardingInterests(id);
    if (onboardingStage < 2) {
      throw new ForbiddenError('اول مراحل آشنایی رو کامل کن');
    }
    return usersRepository().setOnboardingStep(id, 'done');
  },

  async getOnboardingInterests(id: string): Promise<OnboardingInterestsRecord> {
    await this.getById(id);
    return usersRepository().findOnboardingInterests(id);
  },

  /**
   * Stage 1. `interestIds` has already passed `interestsSchema` — every id is
   * in the catalog and they span at least three categories — so what is left
   * is the order of things: no answers before the profile exists, and the
   * category of each interest looked up here rather than trusted from the
   * request.
   */
  async saveInterests(id: string, interestIds: string[]): Promise<OnboardingInterestsRecord> {
    const user = await this.getById(id);
    if (nextStepFor(user) === 'basic_info') {
      throw new ForbiddenError('اول اطلاعات پایه‌ات رو کامل کن');
    }

    return usersRepository().saveInterests(
      id,
      interestIds.map((interestId) => ({
        interestId,
        categoryId: INTEREST_CATEGORY_BY_ID.get(interestId)!,
      }))
    );
  },
};
