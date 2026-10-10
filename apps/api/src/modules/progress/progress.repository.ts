import { query, queryOne, withTransaction, type DbClient } from '../../data';
import { createRepositorySlot } from '../../shared/repository';

import type { XpReward, XpRevocation, XpSourceType, XpTransaction } from './progress.types';

/**
 * Data access port for the Progress module — the XP ledger — and the
 * PostgreSQL adapter that satisfies it.
 *
 * The ledger is append-only. Granting is an insert that does nothing when the
 * same reward is already there, so "only once" is the unique key's job and
 * not a read-then-write that two requests could both pass. Revoking is an
 * insert too: a negative row that points at the one it reverses, which is
 * itself never updated or deleted.
 */
export interface ProgressRepository {
  /** Every row of the person's ledger, newest first. */
  listTransactions(userId: string): Promise<XpTransaction[]>;
  /** True when this call granted it; false when it had been granted before. */
  grant(userId: string, reward: XpReward): Promise<boolean>;
  /** The person's XP: the ledger's sum. */
  total(userId: string): Promise<number>;
  /** Appends the reversal of a grant, once. */
  revoke(transactionId: string, reason: string, adminId: string): Promise<XpRevocation>;
}

const slot = createRepositorySlot<ProgressRepository>('progress');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const progressRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setProgressRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

type TransactionRow = {
  id: string;
  source_type: XpSourceType;
  source_id: string;
  xp_amount: number;
  created_at: Date;
};

const INSERT_GRANT = `
  INSERT INTO v2_xp_transactions
         (user_id, source_type, source_id, xp_amount, activity_id, activity_version_id, reason)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT ON CONSTRAINT v2_xp_transactions_once DO NOTHING
  RETURNING id`;

const grantParams = (userId: string, reward: XpReward) => [
  userId,
  reward.sourceType,
  reward.sourceId,
  reward.xp,
  reward.activityId ?? null,
  reward.activityVersionId ?? null,
  reward.reason ?? null,
];

/**
 * A grant that joins the caller's transaction. The Engagement module writes
 * a response, its participation and its reward as one unit — either all
 * three land or none does — so it grants through this rather than through
 * the port, which would commit on a connection of its own.
 */
export async function grantWithin(client: DbClient, userId: string, reward: XpReward): Promise<boolean> {
  const { rows } = await client.query<{ id: string }>(INSERT_GRANT, grantParams(userId, reward));
  return rows.length > 0;
}

export const sqlProgressRepository: ProgressRepository = {
  async listTransactions(userId) {
    const rows = await query<TransactionRow>(
      `SELECT id, source_type, source_id, xp_amount, created_at
         FROM v2_xp_transactions
        WHERE user_id = $1
     ORDER BY created_at DESC, id DESC`,
      [userId]
    );
    return rows.map((row) => ({
      id: String(row.id),
      sourceType: row.source_type,
      sourceId: row.source_id,
      xp: row.xp_amount,
      createdAt: row.created_at,
    }));
  },

  async grant(userId, reward) {
    const rows = await query<{ id: string }>(INSERT_GRANT, grantParams(userId, reward));
    return rows.length > 0;
  },

  async total(userId) {
    const row = await queryOne<{ total: string }>(
      `SELECT COALESCE(sum(xp_amount), 0)::text AS total FROM v2_xp_transactions WHERE user_id = $1`,
      [userId]
    );
    return Number(row?.total ?? 0);
  },

  async revoke(transactionId, reason, adminId) {
    return withTransaction(async (client) => {
      // Locked so two admins revoking the same grant queue; the unique
      // reverses_id would refuse the second anyway.
      const { rows } = await client.query<{
        user_id: string;
        source_type: XpSourceType;
        xp_amount: number;
        activity_id: string | null;
        activity_version_id: string | null;
        reversed: boolean;
      }>(
        `SELECT t.user_id, t.source_type, t.xp_amount, t.activity_id, t.activity_version_id,
                EXISTS (SELECT 1 FROM v2_xp_transactions r WHERE r.reverses_id = t.id) AS reversed
           FROM v2_xp_transactions t
          WHERE t.id = $1
            FOR UPDATE`,
        [transactionId]
      );
      const original = rows[0];
      if (!original) return { status: 'not_found' };
      if (original.source_type === 'reversal') return { status: 'not_revocable' };
      if (original.reversed) return { status: 'already_revoked' };

      await client.query(
        `INSERT INTO v2_xp_transactions
                (user_id, source_type, source_id, xp_amount, activity_id, activity_version_id,
                 reason, reverses_id, created_by_admin_id)
         VALUES ($1, 'reversal', $2, $3, $4, $5, $6, $7, $8)`,
        [
          original.user_id,
          transactionId,
          -original.xp_amount,
          original.activity_id,
          original.activity_version_id,
          reason,
          transactionId,
          adminId,
        ]
      );
      return {
        status: 'revoked',
        userId: original.user_id,
        amount: original.xp_amount,
        activityId: original.activity_id,
      };
    });
  },
};
