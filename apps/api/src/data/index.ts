/**
 * The data layer: PostgreSQL, reached through `pg`.
 *
 * Only a module's `*.repository.ts` may import this. See
 * `docs/ARCHITECTURE.md` §4 and `database/README.md`.
 */
export {
  closePool,
  getPool,
  isDatabaseConfigured,
  pingDatabase,
  query,
  queryOne,
  withTransaction,
} from './pool';
export { runMigrations, type MigrationOutcome } from './migrate';
