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
    page.locator('#main-content').getByRole('heading', { name: /^سلام/ })
  ).toBeVisible();
});

test('the home screen lists the quizzes, none of them clickable yet', async ({
  page,
}) => {
  await page.goto('/');

  const quizzes = page.locator('#main-content').getByRole('list');
  await expect(quizzes.getByRole('listitem')).toHaveCount(6);
  await expect(quizzes.getByText('به‌زودی')).toHaveCount(6);

  // Nothing in the list is a link or a button: there is nothing behind them
  // yet, and a card that looks clickable and does nothing is worse than one
  // that plainly says so.
  await expect(quizzes.getByRole('link')).toHaveCount(0);
  await expect(quizzes.getByRole('button')).toHaveCount(0);
});

test('a remembered collapsed sidebar still hydrates cleanly', async ({ page }) => {
  // Regression: the collapse state used to seed React state from localStorage
  // during render, so the server rendered an expanded sidebar and the browser
  // hydrated a collapsed one. Hydration failed, and the page came up blank
  // with "a client-side exception has occurred" — but only for the people who
  // had collapsed it before, which is why it survived every clean-browser run.
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));

  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('sidebar-collapsed', 'true'));
  await page.reload();

  await expect(
    page.locator('#main-content').getByRole('heading', { name: /^سلام/ })
  ).toBeVisible();
  expect(failures).toEqual([]);
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
