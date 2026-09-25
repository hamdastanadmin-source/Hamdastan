import { test as setup } from '@playwright/test';
import path from 'path';

import { registerAndSignIn } from './helpers/auth';

const authFile = path.join(__dirname, '.auth/user.json');

/**
 * Creates the account the rest of the suite runs as.
 *
 * `apps/api` holds users in memory and ships no seed data, so there is nobody
 * to sign in as until a test registers somebody.
 */
setup('register and sign in', async ({ page }) => {
  await registerAndSignIn(page);

  await page.context().storageState({ path: authFile });
});
