import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { requestCodeFromScreen, requireApi, testPhone } from './helpers/api';

/**
 * Captures each screen at both sizes, into `e2e/screenshots/<project>/`.
 *
 * It is a deliverable rather than an assertion: the images are what a design
 * review looks at, and the checks alongside them are only enough to be sure
 * the screen actually rendered before the shutter went.
 *
 * The two screens behind a session need the API and its database, so they
 * skip with a reason when it is not up — see `helpers/api.ts`.
 */

const OUTPUT = path.join(__dirname, 'screenshots');

async function capture(page: Page, name: string, project: string): Promise<void> {
  const directory = path.join(OUTPUT, project);
  fs.mkdirSync(directory, { recursive: true });
  // Not `fullPage`: the sticky footer is part of what these are for, and a
  // full-page shot scrolls it out of the frame.
  await page.screenshot({ path: path.join(directory, `${name}.png`) });
}

test('welcome', async ({ page }, testInfo) => {
  await page.goto('/welcome');
  await expect(
    page.getByRole('heading', { name: 'دنیاهای داستانی‌ات منتظرتن' })
  ).toBeVisible();
  // Let the entrance animation finish so the shot is the resting state.
  await page.waitForTimeout(600);
  await capture(page, 'welcome', testInfo.project.name);
});

test('phone', async ({ page }, testInfo) => {
  await page.goto('/auth/phone');
  await expect(
    page.getByRole('heading', { name: 'شماره موبایلت رو وارد کن' })
  ).toBeVisible();
  await capture(page, 'phone', testInfo.project.name);

  await page.getByLabel('شماره موبایل').fill('09123456789');
  // The button enables on the next validation pass; wait for it rather than
  // photographing a disabled button that is about to enable.
  await expect(page.getByRole('button', { name: 'دریافت کد' })).toBeEnabled();
  await capture(page, 'phone-filled', testInfo.project.name);
});

test('verify', async ({ page }, testInfo) => {
  await page.goto('/auth/verify?phone=09123456789');
  await expect(page.getByRole('heading', { name: 'کد تأیید رو وارد کن' })).toBeVisible();
  await capture(page, 'verify', testInfo.project.name);
});

test('the screens behind a session', async ({ page }, testInfo) => {
  await requireApi();

  await page.goto('/auth/phone');
  await page.getByLabel('شماره موبایل').fill(testPhone());
  const code = await requestCodeFromScreen(page);
  await expect(page).toHaveURL(/\/auth\/verify/);
  await capture(page, 'verify', testInfo.project.name);

  await page.getByLabel('کد تأیید').fill(code);

  await expect(page).toHaveURL(/\/auth\/basic-info$/);
  await capture(page, 'basic-info', testInfo.project.name);

  await page.getByLabel('نام', { exact: true }).fill('نیلوفر');
  await page.getByLabel('نام خانوادگی').fill('احمدی');
  await page.getByLabel('روز').click();
  await page.getByRole('option', { name: '۱۲', exact: true }).click();
  await page.getByLabel('ماه').click();
  await page.getByRole('option', { name: 'مرداد' }).click();
  await page.getByLabel('سال').click();
  await page.getByRole('option').nth(10).click();
  await page.getByRole('radio', { name: 'زن' }).click();
  await capture(page, 'basic-info-filled', testInfo.project.name);

  await page.getByRole('button', { name: 'ادامه' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await capture(page, 'onboarding', testInfo.project.name);
});
