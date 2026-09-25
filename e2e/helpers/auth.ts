import { expect, type Page } from '@playwright/test';

import { OTP_CODE_LENGTH, toLatinDigits } from '@hamdastan/validation';

/** A code of the right shape that is never the right code. */
export const WRONG_CODE = '0'.repeat(OTP_CODE_LENGTH);

/**
 * Driving the login flow from a test.
 *
 * Sign-in is passwordless: a mobile number, then a 6-digit code. There is no
 * SMS gateway, so the code is read off the verify screen, which `apps/api`
 * fills in only when `SHOW_DEV_OTP` is on outside production — see
 * `e2e/playwright.config.ts`.
 */

/** Where the backend answers. The web app reaches it at the same URL. */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

/**
 * The user the browser's session cookie resolves to, straight from the
 * backend — for asserting what was actually stored rather than what the screen
 * happens to show.
 */
export async function signedInUser(page: Page) {
  const response = await page.request.get(`${API_BASE_URL}/api/v1/auth/session`);
  expect(response.ok(), 'the session cookie should resolve').toBeTruthy();
  return (await response.json()).data.user;
}

/** A number nobody else in the suite is using. */
export function uniquePhone(): string {
  // 09 + 9 digits, seeded from the clock so parallel runs do not collide.
  const suffix = String(Date.now()).slice(-8);
  return `091${suffix}`;
}

export const REGISTRATION = {
  firstName: 'آزمون',
  lastName: 'کاربر',
  /** ۲۰ مرداد ۱۳۷۰, which the backend stores as 1991-08-11. */
  birthDay: '۲۰',
  birthMonth: 'مرداد',
  birthYear: '۱۳۷۰',
  birthDateISO: '1991-08-11',
  gender: 'مرد',
} as const;

/** Types a number and continues to the next step. */
export async function submitPhone(page: Page, phone: string) {
  await page.locator('input[name="phone"]').fill(phone);
  await page.getByRole('button', { name: 'ادامه' }).click();
}

/** Picks one option out of one of the birth-date dropdowns. */
async function choose(page: Page, field: string, option: string) {
  await page.getByRole('combobox', { name: field }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/** Fills the registration form of a first-time user and continues. */
export async function submitRegistration(page: Page) {
  await page.locator('input[name="firstName"]').fill(REGISTRATION.firstName);
  await page.locator('input[name="lastName"]').fill(REGISTRATION.lastName);

  // The date is Jalali in the UI; the ISO Gregorian value is derived for the
  // request, which is what `birthDateISO` above asserts against.
  await choose(page, 'روز تولد', REGISTRATION.birthDay);
  await choose(page, 'ماه تولد', REGISTRATION.birthMonth);
  await choose(page, 'سال تولد', REGISTRATION.birthYear);

  await page.getByText(REGISTRATION.gender, { exact: true }).click();
  await page.getByRole('button', { name: 'ادامه' }).click();
}

/** The code the backend echoed onto the verify screen, in ASCII digits. */
export async function readDevCode(page: Page): Promise<string> {
  const shown = page.getByTestId('dev-otp-code');
  await expect(shown).toBeVisible();
  // toLatinDigits also covers the Arabic-Indic forms, which a local copy of
  // this conversion kept missing.
  return toLatinDigits((await shown.innerText()).trim());
}

/**
 * Types a code into the six-box input, which submits it.
 *
 * The box is emptied first on purpose: it only submits on the transition from
 * incomplete to complete, so typing over six digits that are already there
 * would fill the boxes and do nothing else.
 */
export async function enterCode(page: Page, code: string) {
  const input = page.getByRole('textbox', { name: 'کد تأیید' });
  await input.fill('');
  await input.fill(code);
}

/** Resolves once the backend has answered a verification. */
export function awaitVerification(page: Page) {
  return page.waitForResponse((response) => response.url().includes('/auth/otp/verify'));
}

/** Enters the current code and waits for the dashboard. */
export async function verifyAndLand(page: Page) {
  await enterCode(page, await readDevCode(page));
  await page.waitForURL('/', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Registers a brand-new user and leaves the browser signed in.
 *
 * No seed data exists — `apps/api` starts with an empty store — so a test that
 * needs an account creates one.
 */
export async function registerAndSignIn(page: Page, phone = uniquePhone()) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await submitPhone(page, phone);
  await submitRegistration(page);
  await verifyAndLand(page);

  return phone;
}

/** Signs out through the sidebar, which lands back on the login screen. */
export async function logout(page: Page) {
  await page.getByRole('button', { name: 'خروج' }).first().click();
  await page.waitForURL('/login', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}
