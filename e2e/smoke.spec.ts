import { expect, test } from '@playwright/test';

/**
 * Runs with the stored authenticated state from `auth.setup.ts`, so these
 * exercise the signed-in app shell.
 */

test('the dashboard renders inside the RTL app shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(
    page.locator('#main-content').getByRole('heading', { name: 'داشبورد' })
  ).toBeVisible();
});

test('the theme toggle flips the dark class and survives a reload', async ({
  page,
}) => {
  await page.goto('/');

  const html = page.locator('html');
  await expect(html).toHaveClass(/dark/);

  await page.getByRole('button', { name: 'حالت روشن' }).click();
  await expect(html).not.toHaveClass(/dark/);

  await page.reload();
  await expect(html).not.toHaveClass(/dark/);
});

test('the component gallery renders', async ({ page }) => {
  await page.goto('/components');

  await expect(
    page
      .locator('#main-content')
      .getByRole('heading', { name: 'کتابخانه کامپوننت‌ها' })
  ).toBeVisible();
});

test('the health endpoint reports healthy', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'healthy' });
});
