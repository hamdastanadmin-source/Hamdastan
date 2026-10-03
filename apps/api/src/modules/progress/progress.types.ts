/**
 * Types internal to the Progress module.
 *
 * Anything the front-end also has to agree on goes in `@hamdastan/types`
 * instead, so both sides compile against one definition.
 */

/** `v2_xp_transactions.source_type`. */
export type XpSourceType = 'personality_test' | 'avatar_created' | 'profile_completed' | 'mission';

/** One reward to grant. `(sourceType, sourceId)` is what makes it once-only per person. */
export type XpReward = {
  sourceType: XpSourceType;
  sourceId: string;
  xp: number;
};

/** One row of the ledger. */
export type XpTransaction = XpReward & {
  id: string;
  createdAt: Date;
};
