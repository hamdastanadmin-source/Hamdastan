import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the real apps from the monorepo root, so every
 * path below is relative to the root, not to `e2e/`.
 *
 * Both servers are started: signing in is a conversation between `apps/web` and
 * `apps/api`, and the session cookie is issued by the API, so the web app alone
 * cannot get anybody through the login screen.
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
      // Auth tests walk the flow themselves — no stored state.
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
  webServer: [
    {
      command: 'npm run dev --workspace @hamdastan/api',
      // No SMS gateway, so the tests read the code off the verify screen. The
      // API refuses to echo it when NODE_ENV=production.
      env: { NODE_ENV: 'development', SHOW_DEV_OTP: 'true', LOG_LEVEL: 'warn' },
      url: 'http://localhost:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: 'npm run dev --workspace @hamdastan/web',
      env: { NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000' },
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});
