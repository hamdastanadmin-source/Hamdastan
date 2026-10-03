import { query } from '../../data';
import { createRepositorySlot } from '../../shared/repository';

import type { XpReward, XpSourceType, XpTransaction } from './progress.types';

/**
 * Data access port for the Progress module — the XP ledger — and the
 * PostgreSQL adapter that satisfies it.
 *
 * The ledger is append-only. Granting is an insert that does nothing when the
 * same reward is already there, so "only once" is the unique key's job and
 * not a read-then-write that two requests could both pass.
 */
export interface ProgressRepository {
  /** Every reward the person has earned, newest first. */
  listTransactions(userId: string): Promise<XpTransaction[]>;
  /** True when this call granted it; false when it had been granted before. */
  grant(userId: string, reward: XpReward): Promise<boolean>;
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

  async grant(userId, { sourceType, sourceId, xp }) {
    const rows = await query<{ id: string }>(
      `INSERT INTO v2_xp_transactions (user_id, source_type, source_id, xp_amount)
            VALUES ($1, $2, $3, $4)
       ON CONFLICT ON CONSTRAINT v2_xp_transactions_once DO NOTHING
         RETURNING id`,
      [userId, sourceType, sourceId, xp]
    );
    return rows.length > 0;
  },
};
