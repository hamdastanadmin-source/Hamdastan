import type { FastifyBaseLogger } from 'fastify';

import { buildApp } from './app';
import { env } from './config';
import {
  closePool,
  describeDrift,
  hasDrift,
  isDatabaseConfigured,
  pingDatabase,
  runMigrations,
} from './data';
import {
  createConsoleSmsSender,
  createKavenegarSmsSender,
  type SmsSender,
} from './integrations';
import { setAdminRepository, sqlAdminRepository } from './modules/admin';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from './modules/auth';
import { setEngagementRepository, sqlEngagementRepository } from './modules/engagement';
import {
  maintenanceService,
  setMaintenanceRepository,
  sqlMaintenanceRepository,
} from './modules/maintenance';
import { setOnboardingRepository, sqlOnboardingRepository } from './modules/onboarding';
import { setProgressRepository, sqlProgressRepository } from './modules/progress';
import { setUsersRepository, sqlUsersRepository } from './modules/users';

/**
 * Process entry point: build the server, listen, and shut down cleanly.
 *
 * All request wiring lives in `app.ts`. This file owns the process — opening
 * the data layer before the first request arrives, and binding each module's
 * repository implementation with `set<Module>Repository(...)` as those get
 * written.
 */

/**
 * Proves the connection string works before the port opens, so a bad password
 * is a boot failure with a readable message rather than a 500 on whichever
 * request happens to touch storage first.
 *
 * In production an unreachable database is fatal: an instance that cannot
 * read anything should not join the load balancer. In development it is a
 * warning, so the front-end can still be worked on with the database down.
 */
async function openDataLayer(log: (message: string) => void): Promise<void> {
  if (!isDatabaseConfigured()) {
    log('DATABASE_URL is not set — repositories stay unbound (HTTP 501).');
    return;
  }

  if (!(await pingDatabase())) {
    throw new Error('database is unreachable');
  }

  if (env.DATABASE_MIGRATE_ON_BOOT) {
    const { applied, drift } = await runMigrations(log);
    log(`migrations: ${applied.length} applied`);
    // Loud, not fatal: a drifted column breaks one feature, while refusing to
    // boot would take down all of them. `npm run db:migrate` is where it fails.
    if (hasDrift(drift)) {
      log(`WARNING — the database has drifted from database/schema/snapshot.txt:\n${describeDrift(drift!)}`);
    }
  }

  // The repositories are bound only once the connection is proven, so a
  // module answers 501 ("no data layer") rather than 500 ("the query blew
  // up") on a host with no database.
  setUsersRepository(sqlUsersRepository);
  setAuthRepository(sqlAuthRepository);
  setOnboardingRepository(sqlOnboardingRepository);
  setProgressRepository(sqlProgressRepository);
  setAdminRepository(sqlAdminRepository);
  setEngagementRepository(sqlEngagementRepository);
  setMaintenanceRepository(sqlMaintenanceRepository);

  log('database connected — users, auth, onboarding, progress, admin and engagement repositories bound');
}

/**
 * Picks the SMS adapter. `console` writes the code to the log and is what
 * makes the sign-in flow exercisable before an SMS contract exists; the
 * deployed environment sets `SMS_PROVIDER=kavenegar` and nothing else
 * changes.
 */
function chooseSmsSender(log: FastifyBaseLogger): SmsSender | null {
  if (env.SMS_PROVIDER === 'kavenegar') {
    return createKavenegarSmsSender({
      // Both are guaranteed by the check in `config/env.ts`.
      apiKey: env.KAVENEGAR_API_KEY!,
      template: env.KAVENEGAR_TEMPLATE ?? 'verify',
      timeoutMs: env.SMS_TIMEOUT_MS,
      log,
    });
  }
  // Fail closed: the console sender is a development tool, and production
  // without a real provider issues no codes at all (requests answer 503).
  if (env.isProduction) return null;
  return createConsoleSmsSender(log, { revealCode: true });
}

async function main(): Promise<void> {
  const app = await buildApp();
  let stopMaintenance = () => {};

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      app.log.info({ signal }, 'shutting down');
      stopMaintenance();
      void app
        .close()
        // After the server stops accepting requests, so in-flight statements
        // finish against a pool that is still open.
        .then(closePool)
        .then(() => process.exit(0));
    });
  }

  const smsSender = chooseSmsSender(app.log);
  setSmsSender(smsSender);
  if (smsSender) app.log.info({ provider: smsSender.name }, 'sms sender bound');
  else app.log.error('no SMS provider in production — one-time codes are refused (503) until SMS_PROVIDER=kavenegar');

  let dataLayerOpen = false;
  try {
    await openDataLayer((message) => app.log.info(message));
    dataLayerOpen = true;
  } catch (error) {
    if (env.isProduction) {
      app.log.fatal({ err: error }, 'data layer unavailable');
      process.exit(1);
    }
    app.log.warn({ err: error }, 'data layer unavailable — continuing');
  }

  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
  } catch (error) {
    app.log.fatal({ err: error }, 'failed to start');
    await closePool();
    process.exit(1);
  }

  // Expired tokens, codes and long-ended sessions, hourly.
  if (dataLayerOpen) stopMaintenance = maintenanceService.start(app.log);
}

void main();
