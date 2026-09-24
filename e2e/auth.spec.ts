import { expect, test } from '@playwright/test';

import { login, logout } from './helpers/auth';

test.describe('authentication', () => {
  test('rejects bad credentials and keeps the user on the login page', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.locator('input[name="username"]').fill('admin');
    await page.locator('input[name="password"]').fill('definitely-wrong');
    await page.getByRole('button', { name: 'ورود' }).click();

    await expect(page.getByText('نام کاربری یا رمز عبور اشتباه است')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('signs in, lands on the dashboard, and signs back out', async ({ page }) => {
    await login(page);

    await expect(page).toHaveURL('/');
    await expect(
      page.locator('#main-content').getByRole('heading', { name: 'داشبورد' })
    ).toBeVisible();

    await logout(page);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sends an anonymous visitor to the login page', async ({ page }) => {
    await page.context().clearCookies();

    await page.goto('/');

    await expect(page).toHaveURL(/\/login$/);
  });
});
