import type { AccountSettings, AvatarConfig, MissionId } from '@hamdastan/config';

import type { QuestionnaireResult } from './questionnaire';

/**
 * The account area, as `apps/api` returns it.
 *
 * Everything here is decided on the server — the level, what a mission's
 * status is, how much XP is left. The browser renders it.
 */

export type AccountProfile = {
  displayName: string | null;
  username: string | null;
  city: string | null;
  bio: string | null;
  /** Null until the person saves an avatar of their own. */
  avatar: AvatarConfig | null;
};

export type XpActivity = {
  id: string;
  /** What earned it, in Persian. */
  label: string;
  xp: number;
  /** ISO timestamp. */
  createdAt: string;
};

export type AccountProgress = {
  xpTotal: number;
  level: number;
  /** XP at which the current level started. */
  levelStartXp: number;
  /** XP at which the next level starts; null at the top level. */
  nextLevelXp: number | null;
  /** Newest first, at most five. */
  recent: XpActivity[];
};

export type MissionStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export type Mission = {
  id: MissionId;
  title: string;
  description: string;
  xpReward: number;
  status: MissionStatus;
  ctaLabel: string;
  ctaHref: string;
  /** ISO timestamp; null unless completed. */
  completedAt: string | null;
};

export type AccountOverview = {
  profile: AccountProfile;
  progress: AccountProgress;
  missions: Mission[];
  /** Null until the questionnaire is finished. */
  socialProfile: QuestionnaireResult | null;
  settings: AccountSettings;
};

/** What every account write answers with. `xpAwarded` is 0 unless this write earned a reward. */
export type AccountUpdate = {
  account: AccountOverview;
  xpAwarded: number;
};
