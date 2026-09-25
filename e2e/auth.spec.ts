import { expect, test } from '@playwright/test';

import {
  awaitVerification,
  enterCode,
  logout,
  readDevCode,
  REGISTRATION,
  registerAndSignIn,
  signedInUser,
  submitPhone,
  submitRegistration,
  uniquePhone,
  verifyAndLand,
  WRONG_CODE,
} from './helpers/auth';

/**
 * The login flow against the real apps.
 *
 * `apps/api` keeps users in memory and ships no seed data, so every test that
 * needs an account registers one — which is also how the "new user" path gets
 * covered without fixtures.
 *
 * Two rules are left to the unit tests in `apps/api/src/modules/auth/__tests__`
 * rather than being waited out here: a code expiring, and a resend replacing
 * it. Both take the full two minutes of `OTP_TTL_SECONDS`, and shortening it
 * for the browser tests would mean testing a flow the product does not have.
 */

test.describe('registration', () => {
  test('a new number registers, verifies, and lands on the dashboard', async ({ page }) => {
    const phone = uniquePhone();

    await page.goto('/login');
    await submitPhone(page, phone);

    // An unknown number is asked who it belongs to before any code is sent.
    await expect(page.getByRole('heading', { name: 'تکمیل ثبت‌نام' })).toBeVisible();

    await submitRegistration(page);

    await expect(page.getByRole('heading', { name: 'کد تأیید' })).toBeVisible();
    await verifyAndLand(page);

    await expect(page).toHaveURL('/');
    await expect(
      page.locator('#main-content').getByRole('heading', { name: 'داشبورد' })
    ).toBeVisible();
    // The name typed into the form is the name the app greets them by.
    await expect(page.locator('#main-content')).toContainText('آزمون کاربر');

    // The date was picked as ۲۰ مرداد ۱۳۷۰ and has to have been stored as the
    // Gregorian day it means — the whole point of the Jalali conversion.
    const user = await signedInUser(page);
    expect(user).toMatchObject({
      phone,
      birthDate: REGISTRATION.birthDateISO,
      gender: 'MALE',
      role: 'USER',
    });
  });

  test('refuses a number that is not a mobile number, without leaving the step', async ({
    page,
  }) => {
    await page.goto('/login');
    await submitPhone(page, '12345');

    await expect(page.getByText('شماره موبایل باید با ۰۹ شروع شود')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ورود یا ثبت‌نام' })).toBeVisible();
  });

  test('refuses an incomplete registration form', async ({ page }) => {
    await page.goto('/login');
    await submitPhone(page, uniquePhone());

    await expect(page.getByRole('heading', { name: 'تکمیل ثبت‌نام' })).toBeVisible();
    // Straight to the button with nothing filled in.
    await page.getByRole('button', { name: 'ادامه' }).click();

    // The field rule is applied before anything is sent.
    await expect(page.getByText('نام باید حداقل ۲ نویسه باشد')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'تکمیل ثبت‌نام' })).toBeVisible();
  });
});

test.describe('signing in an existing user', () => {
  test('a registered number signs straight in with a code', async ({ page }) => {
    const phone = await registerAndSignIn(page);
    await logout(page);

    await page.goto('/login');
    await submitPhone(page, phone);

    // No registration step this time — the backend knows the number.
    await expect(page.getByRole('heading', { name: 'کد تأیید' })).toBeVisible();
    await verifyAndLand(page);

    await expect(page).toHaveURL('/');
  });

  test('signs out and cannot get back in on the old session', async ({ page }) => {
    await registerAndSignIn(page);

    await logout(page);
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sends an anonymous visitor to the login page', async ({ page }) => {
    await page.context().clearCookies();

    await page.goto('/');

    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('the code', () => {
  test('rejects a wrong code and says how it went', async ({ page }) => {
    await page.goto('/login');
    await submitPhone(page, uniquePhone());
    await submitRegistration(page);

    await enterCode(page, WRONG_CODE);

    await expect(page.getByText('کد وارد‌شده نادرست است.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('locks the challenge after too many wrong codes', async ({ page }) => {
    await page.goto('/login');
    await submitPhone(page, uniquePhone());
    await submitRegistration(page);

    // OTP_MAX_ATTEMPTS is 5. Each answer is waited for, so the attempts are
    // counted one at a time rather than raced.
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const answered = awaitVerification(page);
      await enterCode(page, WRONG_CODE);
      await answered;
    }

    await expect(page.getByText('تعداد تلاش‌های نادرست بیش از حد مجاز است')).toBeVisible();

    // Nothing more can be typed: the box and the button are both shut, so the
    // only way forward is a new code. That the backend also refuses the right
    // code while locked is covered in auth.service.test.ts.
    await expect(page.getByRole('textbox', { name: 'کد تأیید' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'تأیید و ورود' })).toBeDisabled();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('holds the resend behind the countdown', async ({ page }) => {
    await page.goto('/login');
    await submitPhone(page, uniquePhone());
    await submitRegistration(page);

    // The countdown starts at the full two minutes of OTP_TTL_SECONDS.
    await expect(page.getByText(/اعتبار کد/)).toContainText('۲:۰');

    const resend = page.getByRole('button', { name: /ارسال دوباره/ });
    await expect(resend).toBeDisabled();
  });
});

test.describe('editing the number', () => {
  test('shows the number the code went to', async ({ page }) => {
    const phone = uniquePhone();

    await page.goto('/login');
    await submitPhone(page, phone);
    await submitRegistration(page);

    // Grouped and in Persian digits, so ۰۹۱۲ … rather than the raw string.
    await expect(page.getByRole('button', { name: 'ویرایش شماره' })).toBeVisible();
    await expect(page.getByText(/۰۹۱/).first()).toBeVisible();
  });

  test('goes back to step one and invalidates the code already sent', async ({ page }) => {
    const phone = await registerAndSignIn(page);
    await logout(page);

    await page.goto('/login');
    await submitPhone(page, phone);
    const firstCode = await readDevCode(page);

    await page.getByRole('button', { name: 'ویرایش شماره' }).click();
    await expect(page.getByRole('heading', { name: 'ورود یا ثبت‌نام' })).toBeVisible();

    // Same number again: a new code is issued, immediately, with no cooldown
    // left over from the cancelled one.
    await submitPhone(page, phone);
    await expect(page.getByRole('heading', { name: 'کد تأیید' })).toBeVisible();
    const secondCode = await readDevCode(page);
    expect(secondCode).not.toBe(firstCode);

    // The code from before the edit is dead.
    await enterCode(page, firstCode);
    await expect(page.getByText('کد وارد‌شده نادرست است.')).toBeVisible();

    // The new one still works.
    await enterCode(page, secondCode);
    await page.waitForURL('/', { timeout: 15000 });
  });
});
