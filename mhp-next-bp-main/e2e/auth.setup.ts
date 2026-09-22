import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="username"]').fill(process.env.TEST_USERNAME ?? 'admin');
  await page.locator('input[name="password"]').fill(process.env.TEST_PASSWORD ?? 'admin123');
  await page.getByRole('button', { name: 'ورود' }).click();

  await page.waitForURL('/', { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  await page.context().storageState({ path: authFile });
});
