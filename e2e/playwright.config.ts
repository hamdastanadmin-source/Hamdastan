import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the real `apps/web` dev server from the
 * monorepo root, so every path below is relative to the root, not to `e2e/`.
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'junit' : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      // Auth tests manage their own login/logout — no stored state
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: /auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev --workspace @hamdastan/web',
    // SKIP_AUTH short-circuits getSession, which would make /login unreachable
    // and break the storage-state setup below.
    env: { SKIP_AUTH: 'false' },
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
