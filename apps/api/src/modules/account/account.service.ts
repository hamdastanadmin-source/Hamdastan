import {
  AVATAR_CATALOG,
  AVATAR_SLOTS,
  DEFAULT_SETTINGS,
  type AccountSettings,
  type AvatarConfig,
} from '@hamdastan/config';
import type { AccountOverview, AccountUpdate } from '@hamdastan/types';

import { ForbiddenError } from '../../shared/errors';
import { badgesFor, missionsFor, missionsService } from '../missions';
import { onboardingService } from '../onboarding';
import { levelFor, progressService, toProgress } from '../progress';
import { usersService, type ProfileFields, type UserRecord } from '../users';

/**
 * Business logic for the Account module — the person's identity and
 * progress hub.
 *
 * It owns no data. It composes the modules that do — the profile row
 * (Users), the social-profile result (Onboarding), the XP ledger (Progress)
 * and the mission catalog (Missions) — and it is where the account's own
 * rules live: what counts as a complete profile, and which avatar items a
 * level allows.
 */

/** The profile mission: a username and a city. The bio is optional and does not count. */
const isProfileComplete = (user: UserRecord) => Boolean(user.username && user.city);

const settingsOf = (user: UserRecord): AccountSettings => ({ ...DEFAULT_SETTINGS, ...user.settings });

async function overviewOf(user: UserRecord): Promise<AccountOverview> {
  const [transactions, socialProfile] = await Promise.all([
    progressService.listTransactions(user.id),
    onboardingService.getResult(user.id),
  ]);

  const missions = missionsFor(transactions);

  return {
    profile: {
      displayName: user.displayName ?? user.firstName,
      username: user.username,
      city: user.city,
      bio: user.bio,
      instagram: user.instagram,
      telegram: user.telegram,
      linkedin: user.linkedin,
      avatar: user.avatarConfig,
    },
    progress: toProgress(transactions),
    missions,
    badges: badgesFor(missions),
    socialProfile,
    settings: settingsOf(user),
  };
}

async function currentLevel(userId: string): Promise<number> {
  return levelFor(toProgress(await progressService.listTransactions(userId)).xpTotal).level;
}

export const accountService = {
  async getOverview(userId: string): Promise<AccountOverview> {
    return overviewOf(await usersService.getById(userId));
  },

  async updateProfile(userId: string, fields: ProfileFields): Promise<AccountUpdate> {
    await usersService.getById(userId);
    const user = await usersService.updateProfile(userId, fields);
    const xpAwarded = isProfileComplete(user)
      ? await missionsService.complete(userId, 'profile_completed')
      : 0;
    return { account: await overviewOf(user), xpAwarded };
  },

  /** The catalog check is the schema's; the level check is here, because only the server knows the level. */
  async saveAvatar(userId: string, avatar: AvatarConfig): Promise<AccountUpdate> {
    await usersService.getById(userId);
    const level = await currentLevel(userId);
    const locked = AVATAR_SLOTS.some((slot) => {
      const item = AVATAR_CATALOG[slot].find(({ id }) => id === avatar[slot]);
      return (item?.unlockLevel ?? 1) > level;
    });
    if (locked) throw new ForbiddenError('این آیتم هنوز برات باز نشده');

    const user = await usersService.saveAvatar(userId, avatar);
    const xpAwarded = await missionsService.complete(userId, 'avatar_created');
    return { account: await overviewOf(user), xpAwarded };
  },

  async saveSettings(userId: string, settings: AccountSettings): Promise<AccountUpdate> {
    await usersService.getById(userId);
    const user = await usersService.saveSettings(userId, settings);
    return { account: await overviewOf(user), xpAwarded: 0 };
  },
};
