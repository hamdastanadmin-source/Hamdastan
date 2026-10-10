import type { FastifyBaseLogger } from 'fastify';

import { env } from '../../config';
import { adminService } from '../admin';
import { authService } from '../auth';

import { maintenanceRepository } from './maintenance.repository';

/**
 * The cleanup job: deletes what can never be used again, on a timer.
 *
 * What goes, and what stays:
 *
 *   • expired access and refresh tokens, expired one-time codes, failure
 *     windows long over, and idempotency keys past their 30 days — none can
 *     be presented, replayed or matched again;
 *   • sessions (product and admin) only `SESSION_RETENTION_DAYS` after they
 *     *ended*, and the log of sent codes after `OTP_SEND_RETENTION_DAYS` —
 *     both are kept that long as the record support and security ask about.
 *
 * Nothing that holds value is touched: the XP ledger, responses, the audit
 * log and live sessions are outside its reach. Every run logs what it
 * deleted per table and how long it took (`maintenance` in the log), and a
 * failure is logged at `error` without stopping the next run — which is how
 * it is watched.
 */

export type MaintenanceReport = { counts: Record<string, number>; durationMs: number };

export const maintenanceService = {
  /** One pass. Answers null when another instance is running it. */
  async runOnce(): Promise<MaintenanceReport | null> {
    const started = Date.now();
    const outcome = await maintenanceRepository().withJobLock(async () => {
      const counts: Record<string, number> = {
        ...(await authService.purgeExpired({
          sessionDays: env.SESSION_RETENTION_DAYS,
          otpSendDays: env.OTP_SEND_RETENTION_DAYS,
        })),
        admin_sessions: await adminService.purgeEnded(env.SESSION_RETENTION_DAYS),
        idempotency_keys: await maintenanceRepository().purgeIdempotencyKeys(new Date()),
      };
      return counts;
    });
    return outcome.ran ? { counts: outcome.result, durationMs: Date.now() - started } : null;
  },

  /**
   * Starts the timer. The first pass waits a minute, so it never competes
   * with boot; the timer is `unref`'d, so it never holds the process open.
   * Answers a function that stops it.
   */
  start(log: FastifyBaseLogger): () => void {
    if (!env.MAINTENANCE_ENABLED) return () => {};

    let running = false;
    const run = async () => {
      if (running) return; // A slow pass is never overlapped by the next.
      running = true;
      try {
        const report = await maintenanceService.runOnce();
        if (report) log.info({ maintenance: report }, 'maintenance: cleanup done');
        else log.debug('maintenance: another instance holds the lock, skipped');
      } catch (error) {
        log.error({ err: error }, 'maintenance: cleanup failed');
      } finally {
        running = false;
      }
    };

    const first = setTimeout(run, 60_000);
    const every = setInterval(run, env.MAINTENANCE_INTERVAL_MINUTES * 60_000);
    first.unref();
    every.unref();
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  },
};
