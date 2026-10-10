/**
 * The data layer: PostgreSQL, reached through `pg`.
 *
 * Only a module's `*.repository.ts` may import this. See
 * `docs/ARCHITECTURE.md` §4 and `database/README.md`.
 */
export {
  closePool,
  deleteInBatches,
  getPool,
  isDatabaseConfigured,
  pingDatabase,
  query,
  queryOne,
  withTransaction,
} from './pool';
/** The connection a `withTransaction` callback receives. */
export type { PoolClient as DbClient } from 'pg';
export {
  claimIdempotency,
  completeIdempotency,
  findIdempotency,
  purgeExpiredIdempotencyKeys,
  type IdempotencyRef,
  type StoredIdempotency,
} from './idempotency';
export { hasDrift, runMigrations, type MigrationOutcome } from './migrate';
export { describeDrift, diffSchema, readSchema, readSnapshot } from './schema-check';
