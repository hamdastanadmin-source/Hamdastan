import { getPool, purgeExpiredIdempotencyKeys } from '../../data';
import { createRepositorySlot } from '../../shared/repository';

/**
 * Data access for the cleanup job: the lock that keeps two API instances
 * from running it at once, and the one table no module owns — the
 * idempotency record, which is infrastructure in `data/`.
 */
export interface MaintenanceRepository {
  /**
   * Runs `fn` while holding the job's advisory lock, or answers `skipped`
   * without running it when another instance holds it.
   */
  withJobLock<T>(fn: () => Promise<T>): Promise<{ ran: true; result: T } | { ran: false }>;
  purgeIdempotencyKeys(now: Date): Promise<number>;
}

const slot = createRepositorySlot<MaintenanceRepository>('maintenance');

export const maintenanceRepository = slot.get;
export const setMaintenanceRepository = slot.set;

// Distinct from the migration runner's key.
const JOB_LOCK_KEY = 0x6864_6d6e; // "hdmn"

export const sqlMaintenanceRepository: MaintenanceRepository = {
  async withJobLock(fn) {
    // The lock lives on this one connection for the duration; the purges
    // themselves run on others, which is fine — it is a mutex, not a
    // transaction.
    const client = await getPool().connect();
    try {
      const { rows } = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [JOB_LOCK_KEY]
      );
      if (!rows[0]?.locked) return { ran: false };
      try {
        return { ran: true, result: await fn() };
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [JOB_LOCK_KEY]).catch(() => undefined);
      }
    } finally {
      client.release();
    }
  },

  purgeIdempotencyKeys(now) {
    return purgeExpiredIdempotencyKeys(now);
  },
};
