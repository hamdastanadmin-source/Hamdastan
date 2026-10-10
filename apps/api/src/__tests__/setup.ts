/**
 * Runs before any test file imports `config/env.ts`, which parses
 * `process.env` once at import time.
 *
 * `DATABASE_URL` is overwritten unconditionally — to the test database, or to
 * nothing — so no test can reach the database in the root `.env`, whatever
 * the shell running it has exported.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? '';

if (testDatabaseUrl) {
  // The integration suite drops and recreates the schema. Refusing anything
  // not named as a test database is what keeps a pasted production URL from
  // being wiped.
  const name = new URL(testDatabaseUrl).pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error(
      `TEST_DATABASE_URL must name a database ending in "_test" (got "${name}"). ` +
        'The integration suite resets its schema.'
    );
  }
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.DEBUG_LOG ?? 'silent';
process.env.OTP_DEBUG_DISPLAY = 'true';
process.env.SMS_PROVIDER = 'console';
process.env.DATABASE_MIGRATE_ON_BOOT = 'false';
// The suite signs in many times from one address.
process.env.OTP_MAX_SENDS_PER_PHONE = '100';
process.env.OTP_MAX_SENDS_PER_IP = '1000';
// Rate limiting has a suite of its own (rate-limit.test.ts), which turns it
// back on; everywhere else one address signing in dozens of times is the test.
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.MAINTENANCE_ENABLED = 'false';
