import {
  INTEREST_CATEGORIES,
  INTEREST_CATEGORY_BY_ID,
  type AccountSettings,
  type AvatarConfig,
} from '@hamdastan/config';
import type {
  AuthUser,
  NextStep,
  OnboardingInterests,
  SessionResponse,
} from '@hamdastan/types';

import { ForbiddenError, NotFoundError } from '../../shared/errors';

import { usersRepository } from './users.repository';
import type {
  BasicInfo,
  OnboardingInterestsRecord,
  ProfileFields,
  UserRecord,
} from './users.types';

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

/** A suspended account stops working on its next request. */
function requireActive(user: UserRecord): UserRecord {
  if (user.status !== 'ACTIVE') {
    throw new ForbiddenError('حساب کاربری شما غیرفعال شده است');
  }
  return user;
}

/**
 * Every method below that takes a `UserRecord` is handed the row
 * `authenticate` loaded for this request — already read from the database
 * and already checked active — rather than reading it a second time.
 */
export const usersService = {
  /** Throws rather than returning null: every caller here has a session. */
  async getById(id: string): Promise<UserRecord> {
    const user = await usersRepository().findById(id);
    if (!user) throw new NotFoundError('کاربر یافت نشد');
    return requireActive(user);
  },

  /**
   * The user behind a live access token, or null when the token is not
   * live. Throws for a suspended account, like `getById`.
   */
  async findByAccessToken(tokenHash: string, now: Date): Promise<UserRecord | null> {
    const user = await usersRepository().findByAccessToken(tokenHash, now);
    return user && requireActive(user);
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

  async saveBasicInfo(user: UserRecord, info: BasicInfo): Promise<UserRecord> {
    return usersRepository().saveBasicInfo(user.id, info);
  },

  /**
   * The end of onboarding. Only the server says it is over, and it says so
   * once the interests (stage 1) are saved. The questionnaire (stage 2) can
   * be put off: «بعداً انجام می‌دم» comes here too, and home then offers it
   * as a mission. Stage 3 is not built yet.
   */
  async completeOnboarding(user: UserRecord): Promise<UserRecord> {
    if (user.onboardingStage < 1) {
      throw new ForbiddenError('اول مراحل آشنایی رو کامل کن');
    }
    return usersRepository().setOnboardingStep(user.id, 'done');
  },

  async getOnboardingInterests(user: UserRecord): Promise<OnboardingInterestsRecord> {
    return {
      onboardingStage: user.onboardingStage,
      interestIds: await usersRepository().findInterestIds(user.id),
    };
  },

  /**
   * Stage 1. `interestIds` has already passed `interestsSchema` — every id is
   * in the catalog and they span at least three categories — so what is left
   * is the order of things: no answers before the profile exists, and the
   * category of each interest looked up here rather than trusted from the
   * request.
   */
  async saveInterests(user: UserRecord, interestIds: string[]): Promise<OnboardingInterestsRecord> {
    if (nextStepFor(user) === 'basic_info') {
      throw new ForbiddenError('اول اطلاعات پایه‌ات رو کامل کن');
    }

    return usersRepository().saveInterests(
      user.id,
      interestIds.map((interestId) => ({
        interestId,
        categoryId: INTEREST_CATEGORY_BY_ID.get(interestId)!,
      }))
    );
  },

  // ─── The account area ──────────────────────────────────────────────────
  // Validated and decided on by the Account module; these only store.

  updateProfile(id: string, fields: ProfileFields): Promise<UserRecord> {
    return usersRepository().updateProfile(id, fields);
  },

  saveAvatar(id: string, avatar: AvatarConfig): Promise<UserRecord> {
    return usersRepository().saveAvatar(id, avatar);
  },

  saveSettings(id: string, settings: AccountSettings): Promise<UserRecord> {
    return usersRepository().saveSettings(id, settings);
  },
};
