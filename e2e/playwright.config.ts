import { defineConfig, devices } from '@playwright/test';

import { MOBILE_SHELL_MAX_WIDTH } from '@hamdastan/config';

/**
 * End-to-end tests run against the real `apps/web` dev server from the
 * monorepo root, so every path below is relative to the root, not to `e2e/`.
 *
 * Two projects, one per size the product has to look right at: a phone, and a
 * laptop where it must still be a phone — a column of
 * `MOBILE_SHELL_MAX_WIDTH` in the middle of the screen, not a dashboard.
 * Every spec runs in both.
 *
 * There is no stored sign-in state. Sessions now live in `apps/api` behind a
 * real one-time code, so a test either walks the flow (`auth.spec.ts`, which
 * needs the API and its database) or stays on the public screens.
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
    {
      // Chromium at an iPhone 13's viewport, with touch and the mobile
      // user agent. Not WebKit: one browser download keeps CI honest, and
      // what these assert — the column width, the routing, the field
      // behaviour — is not engine-specific. Add a WebKit project when there
      // is an iOS-only bug worth guarding against.
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run dev --workspace @hamdastan/web',
    url: 'http://localhost:3000/welcome',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});

export { MOBILE_SHELL_MAX_WIDTH };
