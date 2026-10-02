import { expect, test, type Page } from '@playwright/test';

import { OTP } from '@hamdastan/config';

import { requireApi, testPhone } from './helpers/api';

/**
 * The sign-in flow, end to end.
 *
 * These need `apps/api` running with a database behind it — a one-time code
 * is generated, hashed and stored by the backend, and faking that would mean
 * testing the mock. They skip with a reason when the API is not up, rather
 * than passing while nothing works.
 *
 * They also need `OTP_DEBUG_DISPLAY=true`, which is what puts the code on the
 * screen in place of an SMS.
 */

test.beforeEach(async () => {
  await requireApi();
});

/** Walks the phone screen and returns the code the debug Alert is showing. */
async function requestCode(page: Page, phone: string): Promise<string> {
  await page.goto('/auth/phone');
  await page.getByLabel('شماره موبایل').fill(phone);
  await page.getByRole('button', { name: 'دریافت کد' }).click();

  await expect(page).toHaveURL(/\/auth\/verify/);

  const alert = page.getByRole('alert').filter({ hasText: 'کد تست' });
  await expect(alert).toBeVisible({ timeout: 10_000 });

  const code = (await alert.innerText()).match(/\d{6}/)?.[0];
  expect(code, 'OTP_DEBUG_DISPLAY must be on for the e2e run').toBeTruthy();
  return code!;
}

async function fillCode(page: Page, code: string): Promise<void> {
  await page.getByLabel('کد تأیید').fill(code);
}

async function fillBasicInfo(page: Page): Promise<void> {
  const submit = page.getByRole('button', { name: 'ادامه' });
  // Nothing to send until every field is filled.
  await expect(submit).toBeDisabled();

  // `exact`, or this also matches «نام خانوادگی».
  await page.getByLabel('نام', { exact: true }).fill('نیلوفر');
  await page.getByLabel('نام خانوادگی').fill('احمدی');

  await page.getByLabel('روز').click();
  await page.getByRole('option', { name: '۱۲', exact: true }).click();
  await page.getByLabel('ماه').click();
  await page.getByRole('option', { name: 'مرداد' }).click();
  await page.getByLabel('سال').click();
  await page.getByRole('option').nth(10).click();

  await page.getByRole('radio', { name: 'زن' }).click();
  await submit.click();
}

test('a new number: phone, code, basic info, onboarding', async ({ page }) => {
  const phone = testPhone();

  const code = await requestCode(page, phone);
  await fillCode(page, code);

  // A new account goes to the profile form, not home.
  await expect(page).toHaveURL(/\/auth\/basic-info$/);
  await expect(page.getByRole('heading', { name: 'بیا آشنا بشیم' })).toBeVisible();

  await fillBasicInfo(page);
  await expect(page).toHaveURL(/\/onboarding$/);
});

test('an unfinished profile comes back to the same screen', async ({ page }) => {
  const phone = testPhone();

  const code = await requestCode(page, phone);
  await fillCode(page, code);
  await expect(page).toHaveURL(/\/auth\/basic-info$/);

  // Leaving and coming back is what the routing table has to survive.
  await page.goto('/');
  await expect(page).toHaveURL(/\/auth\/basic-info$/);

  await page.goto('/welcome');
  await expect(page).toHaveURL(/\/auth\/basic-info$/);
});

test('a completed profile cannot go back to the form', async ({ page }) => {
  const phone = testPhone();

  await fillCode(page, await requestCode(page, phone));
  await expect(page).toHaveURL(/\/auth\/basic-info$/);
  await fillBasicInfo(page);
  await expect(page).toHaveURL(/\/onboarding$/);

  // The same routing rule a returning sign-in relies on: once the profile is
  // complete, the form is not a page this account can be on. Asserted this way
  // rather than by signing in again, because a second code for the same number
  // is exactly what the two-minute resend cooldown exists to refuse.
  await page.goto('/auth/basic-info');
  await expect(page).not.toHaveURL(/\/auth\/basic-info$/);

  await page.goto('/welcome');
  await expect(page).not.toHaveURL(/\/welcome$/);
});

test('an invalid field turns red and says why', async ({ page }) => {
  await fillCode(page, await requestCode(page, testPhone()));
  await expect(page).toHaveURL(/\/auth\/basic-info$/);

  const name = page.getByLabel('نام', { exact: true });
  await name.fill('Ali');
  await page.getByLabel('نام خانوادگی').click();

  // The message alone is not enough — before `Input` was replaced with the
  // stock shadcn one, the text appeared under a field that still looked
  // untouched, because nothing reacted to the `aria-invalid` that Form sets.
  await expect(page.getByText('نام رو به فارسی وارد کن')).toBeVisible();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).not.toHaveCSS('border-color', 'rgb(0, 0, 0)');

  const borderColor = await name.evaluate((el) => getComputedStyle(el).borderColor);
  const fieldBelow = await page
    .getByLabel('نام خانوادگی')
    .evaluate((el) => getComputedStyle(el).borderColor);
  expect(borderColor).not.toBe(fieldBelow);
});

test('a wrong code is rejected, and five of them burn it', async ({ page }) => {
  const phone = testPhone();
  const code = await requestCode(page, phone);

  const wrong = code === '000000' ? '111111' : '000000';

  for (let attempt = 1; attempt <= OTP.MAX_ATTEMPTS; attempt += 1) {
    await fillCode(page, wrong);
    // The message under the boxes, not Next's route announcer — which is
    // also a live region and also says «کد».
    await expect(page.locator('p[role="alert"]')).toBeVisible();
  }

  // The code is spent: even the right one no longer works.
  await fillCode(page, code);
  await expect(page).toHaveURL(/\/auth\/verify/);
});
