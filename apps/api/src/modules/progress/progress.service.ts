import { LEVEL_THRESHOLDS, MISSION_BY_ID, type MissionId } from '@hamdastan/config';
import type { AccountProgress } from '@hamdastan/types';

import { progressRepository } from './progress.repository';
import type { XpReward, XpRevocation, XpTransaction } from './progress.types';

/**
 * Business logic for the Progress module — XP and levels.
 *
 * XP is only ever the sum of the ledger, and the level only ever a lookup in
 * `LEVEL_THRESHOLDS`: neither is stored, so neither can drift from the
 * rewards that produced it.
 */

const RECENT_LIMIT = 5;

/** The level for a total, and the band it sits in. */
export function levelFor(xpTotal: number): Pick<AccountProgress, 'level' | 'levelStartXp' | 'nextLevelXp'> {
  // The last threshold at or below the total; level 1 starts at 0.
  const index = LEVEL_THRESHOLDS.findLastIndex((threshold) => xpTotal >= threshold);
  return {
    level: index + 1,
    levelStartXp: LEVEL_THRESHOLDS[index],
    nextLevelXp: LEVEL_THRESHOLDS[index + 1] ?? null,
  };
}

/** What earned it, as the person reads it. */
function activityLabel(transaction: XpTransaction): string {
  if (transaction.sourceType === 'engagement') return 'فعالیت';
  if (transaction.sourceType === 'reversal') return 'اصلاح امتیاز';
  const missionId = (
    transaction.sourceType === 'mission' ? transaction.sourceId : transaction.sourceType
  ) as MissionId;
  return MISSION_BY_ID.get(missionId)?.doneTitle ?? 'ماموریت';
}

/** The ledger, newest first, as the account screen shows it. */
export function toProgress(transactions: XpTransaction[]): AccountProgress {
  // A revocation can only take back what was granted, but the floor keeps a
  // level lookup meaningful whatever the ledger holds.
  const xpTotal = Math.max(0, transactions.reduce((sum, { xp }) => sum + xp, 0));
  return {
    xpTotal,
    ...levelFor(xpTotal),
    recent: transactions.slice(0, RECENT_LIMIT).map((transaction) => ({
      id: transaction.id,
      label: activityLabel(transaction),
      xp: transaction.xp,
      createdAt: transaction.createdAt.toISOString(),
    })),
  };
}

export const progressService = {
  listTransactions(userId: string): Promise<XpTransaction[]> {
    return progressRepository().listTransactions(userId);
  },

  /** Grants a reward at most once. Answers with the XP this call added: the reward, or 0. */
  async grant(userId: string, reward: XpReward): Promise<number> {
    return (await progressRepository().grant(userId, reward)) ? reward.xp : 0;
  },

  /** The person's XP balance: the ledger's sum, never below zero. */
  async total(userId: string): Promise<number> {
    return Math.max(0, await progressRepository().total(userId));
  },

  /**
   * Takes a grant back by appending its negative, with the admin and the
   * reason. The original row stays; a grant can be revoked once.
   */
  revoke(transactionId: string, reason: string, adminId: string): Promise<XpRevocation> {
    return progressRepository().revoke(transactionId, reason, adminId);
  },
};
