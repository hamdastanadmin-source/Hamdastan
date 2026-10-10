import { test, type Page } from '@playwright/test';

import { API_BASE_URL } from '@hamdastan/config';

/**
 * Skips the calling test when `apps/api` is not answering.
 *
 * The sign-in flow is end-to-end by definition — a one-time code is issued,
 * hashed and stored by the backend — so those specs cannot run against the
 * front-end alone. Skipping with a reason is honest; mocking the API would
 * mean the test passes while the thing it is named after does not work.
 */
export async function requireApi(): Promise<void> {
  let healthy = false;
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    healthy = response.ok;
  } catch {
    healthy = false;
  }

  test.skip(
    !healthy,
    `apps/api is not reachable at ${API_BASE_URL}. Start it with:\n` +
      `  OTP_DEBUG_DISPLAY=true OTP_MAX_SENDS_PER_IP=500 npm run dev:api\n` +
      `against a database that has had \`npm run db:migrate\` run on it. The ` +
      `raised IP cap is the point: one machine signing in dozens of times is ` +
      `exactly the shape the production limit exists to stop.`
  );
}

/**
 * A number in the 0999 range, which no Iranian operator issues, with seven
 * random digits after it so two runs never share an account.
 */
export function testPhone(): string {
  const suffix = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
  return `0999${suffix}`;
}

/**
 * Clicks «دریافت کد» and returns the one-time code the API issued.
 *
 * The screens never show the code — it goes by SMS — so the test reads it
 * from the response to `POST /auth/otp/request`, which carries it as
 * `debugCode` only in development with `OTP_DEBUG_DISPLAY=true` (never in
 * production).
 */
export async function requestCodeFromScreen(page: Page): Promise<string> {
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/auth/otp/request') && r.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'دریافت کد' }).click();
  const body = (await (await response).json()) as { data?: { debugCode?: string } };
  const code = body.data?.debugCode;
  if (!code) {
    throw new Error('No debugCode in the response: run the API with OTP_DEBUG_DISPLAY=true (development only).');
  }
  return code;
}
