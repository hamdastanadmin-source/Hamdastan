/**
 * Types internal to the Progress module.
 *
 * Anything the front-end also has to agree on goes in `@hamdastan/types`
 * instead, so both sides compile against one definition.
 */

/**
 * `v2_xp_transactions.source_type`. `engagement` is an Engagement Studio
 * activity's reward; `reversal` is a revocation of an earlier row.
 */
export type XpSourceType =
  | 'personality_test'
  | 'avatar_created'
  | 'profile_completed'
  | 'mission'
  | 'engagement'
  | 'reversal';

/** One reward to grant. `(sourceType, sourceId)` is what makes it once-only per person. */
export type XpReward = {
  sourceType: XpSourceType;
  sourceId: string;
  xp: number;
  /** Engagement rewards: the activity and the version that paid. */
  activityId?: string;
  activityVersionId?: string;
  /** Why it was granted, in Persian. */
  reason?: string;
};

/** One row of the ledger. */
export type XpTransaction = {
  id: string;
  sourceType: XpSourceType;
  sourceId: string;
  /** Negative on a reversal. */
  xp: number;
  createdAt: Date;
};

/** The outcome of a revocation attempt. */
export type XpRevocation =
  | { status: 'revoked'; userId: string; amount: number; activityId: string | null }
  | { status: 'not_found' | 'already_revoked' | 'not_revocable' };
