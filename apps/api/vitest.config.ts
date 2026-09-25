import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The API reads its configuration once, at import time, so anything a test
    // depends on has to be in place before the first import.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      OTP_TTL_SECONDS: '120',
      OTP_MAX_ATTEMPTS: '5',
      OTP_MAX_SENDS: '5',
      OTP_SEND_WINDOW_MINUTES: '15',
      // Off on purpose: the tests read the code from the mock provider's
      // outbox, the way a real client never could, so nothing here depends on
      // the development echo being enabled.
      SHOW_DEV_OTP: 'false',
    },
    testTimeout: 15000,
    pool: 'forks',
  },
});
