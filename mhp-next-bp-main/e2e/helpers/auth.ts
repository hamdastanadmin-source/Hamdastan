import { Page, expect } from '@playwright/test';

/**
 * Log in via the login form.
 *
 * Uses the exact field names from `src/app/login/page.tsx`:
 *   - input[name="username"]  (placeholder: "نام کاربری خود را وارد کنید")
 *   - input[name="password"]  (placeholder: "رمز عبور خود را وارد کنید")
 *   - submit button with text "ورود"
 *
 * After submission the middleware redirects authenticated users to `/`.
 */
export async function login(
  page: Page,
  username = 'admin',
  password = 'admin123',
) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill credentials using the name attributes
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);

  // Submit
  await page.getByRole('button', { name: 'ورود' }).click();

  // Wait for redirect to dashboard
  await page.waitForURL('/', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Log out by clicking the "خروج" button in the sidebar.
 * The sidebar has a <button> containing the text "خروج" that triggers logoutAction.
 */
export async function logout(page: Page) {
  // The sidebar (expanded) shows a button with text "خروج".
  // In collapsed mode it's a tooltip-wrapped button with the same text.
  // We look for any visible button matching the text.
  const logoutBtn = page.getByRole('button', { name: 'خروج' }).first();
  await logoutBtn.click();

  // logoutAction redirects to /login
  await page.waitForURL('/login', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}
