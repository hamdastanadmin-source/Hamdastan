import type { PoolClient } from 'pg';

import type { IdempotencyRef, StoredIdempotency } from '../shared/idempotency';

import { deleteInBatches, queryOne } from './pool';

/**
 * `v2_idempotency_keys` — the record that lets a write be retried safely.
 *
 * It lives in the data layer, beside the pool, because it is infrastructure
 * every module's writes can share rather than one module's domain, and —
 * like `grantWithin` — it must run on the *caller's* transaction: the claim,
 * the work and the recorded outcome commit together or not at all. Only a
 * repository calls these.
 */

export type { IdempotencyRef, StoredIdempotency };

type Row = { request_hash: string; outcome: unknown };

function interpret<T>(row: Row, ref: IdempotencyRef): StoredIdempotency<T> | null {
  if (row.request_hash !== ref.requestHash) return { state: 'mismatch' };
  // NULL only inside a claiming transaction that has not committed, which
  // another session cannot see — treated as absent all the same.
  return row.outcome === null ? null : { state: 'replay', outcome: row.outcome as T };
}

/** A recorded outcome for this key, outside any transaction — the fast path. */
export async function findIdempotency<T>(ref: IdempotencyRef): Promise<StoredIdempotency<T> | null> {
  const row = await queryOne<Row>(
    `SELECT request_hash, outcome FROM v2_idempotency_keys
      WHERE scope = $1 AND owner_id = $2 AND idem_key = $3 AND expires_at > now()`,
    [ref.scope, ref.ownerId, ref.key]
  );
  return row ? interpret<T>(row, ref) : null;
}

/**
 * Claims the key on `client`'s transaction. Returns null when the caller now
 * owns it and should do the work; otherwise what was recorded before.
 *
 * Two requests with one key: the second's insert waits on the first's
 * uncommitted row, then — once that commits — conflicts and reads the
 * outcome it recorded. If the first rolled back, the second claims instead.
 */
export async function claimIdempotency<T>(
  client: PoolClient,
  ref: IdempotencyRef,
  ttlSeconds: number
): Promise<StoredIdempotency<T> | null> {
  // An expired key is spent: it gives way to a fresh claim.
  await client.query(
    `DELETE FROM v2_idempotency_keys
      WHERE scope = $1 AND owner_id = $2 AND idem_key = $3 AND expires_at <= now()`,
    [ref.scope, ref.ownerId, ref.key]
  );
  const claimed = await client.query(
    `INSERT INTO v2_idempotency_keys (scope, owner_id, idem_key, request_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5))
     ON CONFLICT (scope, owner_id, idem_key) DO NOTHING`,
    [ref.scope, ref.ownerId, ref.key, ref.requestHash, ttlSeconds]
  );
  if (claimed.rowCount === 1) return null;

  const { rows } = await client.query<Row>(
    `SELECT request_hash, outcome FROM v2_idempotency_keys
      WHERE scope = $1 AND owner_id = $2 AND idem_key = $3`,
    [ref.scope, ref.ownerId, ref.key]
  );
  const stored = rows[0] ? interpret<T>(rows[0], ref) : null;
  // A row that is there but unreadable cannot happen under READ COMMITTED
  // once the conflicting insert has returned; refuse rather than act twice.
  if (!stored) throw new Error('idempotency key claimed but its outcome is missing');
  return stored;
}

/** Records the outcome on the claiming transaction. */
export async function completeIdempotency(
  client: PoolClient,
  ref: IdempotencyRef,
  outcome: unknown
): Promise<void> {
  await client.query(
    `UPDATE v2_idempotency_keys SET outcome = $4
      WHERE scope = $1 AND owner_id = $2 AND idem_key = $3`,
    [ref.scope, ref.ownerId, ref.key, JSON.stringify(outcome)]
  );
}

/** Deletes keys past their `expires_at`. For the cleanup job. */
export function purgeExpiredIdempotencyKeys(now: Date): Promise<number> {
  return deleteInBatches('v2_idempotency_keys', 'expires_at < $1', [now]);
}
