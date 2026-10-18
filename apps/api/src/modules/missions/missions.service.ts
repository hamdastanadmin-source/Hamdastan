import { BADGES, MISSION_BY_ID, MISSIONS, type MissionId } from '@hamdastan/config';
import type { EarnedBadge, Mission } from '@hamdastan/types';

import { notificationsService } from '../notifications';
import { progressService, type XpTransaction } from '../progress';

/**
 * Business logic for the Missions module — ماموریت‌ها.
 *
 * A mission is finished exactly when the XP ledger holds its reward. There
 * is no second record of it: the reward row is the completion, and the
 * ledger's unique key is what keeps it from paying twice.
 *
 * Every mission today is available from the start, so `locked` and
 * `in_progress` are part of the contract but never produced yet.
 */

/** Today's catalog's missions are one-off achievements; their ledger source is their own id. */
const sourceOf = (id: MissionId) => ({ sourceType: id, sourceId: id });

/** The catalog, with each mission's status read off the ledger. */
export function missionsFor(transactions: XpTransaction[]): Mission[] {
  return MISSIONS.map((mission) => {
    const source = sourceOf(mission.id);
    const reward = transactions.find(
      (t) => t.sourceType === source.sourceType && t.sourceId === source.sourceId
    );
    return {
      id: mission.id,
      title: reward ? mission.doneTitle : mission.title,
      description: mission.description,
      xpReward: mission.xpReward,
      status: reward ? 'completed' : 'available',
      ctaLabel: mission.ctaLabel,
      ctaHref: mission.ctaHref,
      completedAt: reward ? reward.createdAt.toISOString() : null,
    };
  });
}

/**
 * The badges whose missions are all done, in catalog order. Like a mission,
 * a badge has no record of its own: it is read off the missions' status.
 */
export function badgesFor(missions: Mission[]): EarnedBadge[] {
  const doneAt = new Map(missions.flatMap((m) => (m.completedAt ? [[m.id, m.completedAt] as const] : [])));

  return BADGES.flatMap((badge) => {
    const dates = badge.requires.map((id) => doneAt.get(id));
    if (dates.some((date) => !date)) return [];
    const { id, title, description, icon } = badge;
    return [{ id, title, description, icon, earnedAt: (dates as string[]).sort().at(-1)! }];
  });
}

export const missionsService = {
  /**
   * Marks a mission done and grants its reward, once. Safe to call every
   * time the triggering action happens: the second call grants nothing.
   * Answers with the XP this call added.
   *
   * Only the call that paid notifies: the XP, any level it reached, and any
   * badge this mission was the last one missing for.
   */
  async complete(userId: string, id: MissionId): Promise<number> {
    const mission = MISSION_BY_ID.get(id)!;
    const xp = await progressService.grant(userId, { ...sourceOf(id), xp: mission.xpReward });
    if (xp > 0) {
      await notificationsService.xpEarned(userId, {
        xp,
        reason: mission.doneTitle,
        dedupeKey: `mission:${id}`,
        destination: { kind: 'profile' },
      });
      const earned = badgesFor(missionsFor(await progressService.listTransactions(userId)));
      for (const badge of earned.filter((b) => BADGES.find((d) => d.id === b.id)?.requires.includes(id))) {
        await notificationsService.badgeEarned(userId, badge);
      }
    }
    return xp;
  },
};
