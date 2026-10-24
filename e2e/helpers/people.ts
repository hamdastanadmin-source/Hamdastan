import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test';

import { API_BASE_URL, API_PREFIX, INTEREST_CATEGORIES } from '@hamdastan/config';

/**
 * Signing people in for the specs that build their own content: a product
 * account straight to home, and the panel's first admin — signed in once
 * per run and reused, because the API makes one number wait between codes
 * and a dozen specs would otherwise queue behind it.
 */

export const API = `${API_BASE_URL}${API_PREFIX}`;
export const ADMIN_PHONE = '09059466960';

/** Where the panel answers. `ADMIN_BASE_URL` points the specs at another one. */
export const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL ?? 'http://localhost:3001/admin';

/** The admin session, kept between specs of one run (git-ignored). */
export const ADMIN_STATE = path.join(__dirname, '..', '.auth', 'admin.json');

type Body = { ok: boolean; data?: { debugCode?: string }; error?: { code: string; details?: { retryAfter?: number } } };

/** Asks for a code and verifies it; waits out a resend cooldown rather than failing on it. */
export async function signIn(api: APIRequestContext, prefix: '' | '/admin', phone: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const requested = await api.post(`${API}${prefix}/auth/otp/request`, { data: { phone } });
    const body = (await requested.json()) as Body;
    if (body.ok && body.data?.debugCode) {
      const verified = await api.post(`${API}${prefix}/auth/otp/verify`, { data: { phone, code: body.data.debugCode } });
      expect(verified.ok(), await verified.text()).toBe(true);
      return;
    }
    if (body.error?.code !== 'OTP_RATE_LIMITED') throw new Error(`code request failed: ${JSON.stringify(body)}`);
    await new Promise((resolve) => setTimeout(resolve, ((body.error.details?.retryAfter ?? 5) + 1) * 1000));
  }
  throw new Error('could not get a code for the admin number');
}

/** An API context signed in as the panel's first admin; the session is reused while it is alive. */
export async function adminApi(): Promise<APIRequestContext> {
  if (existsSync(ADMIN_STATE)) {
    const reused = await playwrightRequest.newContext({ storageState: ADMIN_STATE });
    if ((await reused.get(`${API}/admin/me`)).ok()) return reused;
    await reused.dispose();
  }
  // A cooldown can be most of a minute and a half.
  test.setTimeout(180_000);
  const fresh = await playwrightRequest.newContext();
  await signIn(fresh, '/admin', ADMIN_PHONE);
  mkdirSync(path.dirname(ADMIN_STATE), { recursive: true });
  await fresh.storageState({ path: ADMIN_STATE });
  return fresh;
}

/** A person through sign-in, the profile, the username and onboarding stage 1 — straight to home. */
export async function readyPerson(page: Page, phone: string, firstName = 'سارا'): Promise<void> {
  await signIn(page.request, '', phone);
  const profile = await page.request.put(`${API}/me/basic-info`, {
    data: { firstName, lastName: 'آزمایشی', birthDate: { year: 1375, month: 6, day: 14 }, gender: 'female' },
  });
  expect(profile.ok(), await profile.text()).toBe(true);
  // Keeps the generated username: the step only has to be answered.
  const session = await (await page.request.get(`${API}/me`)).json();
  expect((await page.request.put(`${API}/me/username`, { data: { username: session.data.user.username } })).ok()).toBe(true);
  const interestIds = INTEREST_CATEGORIES.slice(0, 3).map((category) => category.interests[0].id);
  expect((await page.request.put(`${API}/me/onboarding/interests`, { data: { interestIds } })).ok()).toBe(true);
  expect((await page.request.post(`${API}/me/onboarding/complete`)).ok()).toBe(true);
}

/** Skips the calling test when the admin panel is not answering. */
export async function requireAdminPanel(): Promise<void> {
  let up = false;
  try {
    up = (await fetch(`${ADMIN_BASE_URL}/login`)).ok;
  } catch {
    up = false;
  }
  test.skip(!up, `apps/admin is not reachable at ${ADMIN_BASE_URL}. Start it with: npm run dev --workspace @hamdastan/admin`);
}

/** A slug no other run shares. */
export const uniqueSlug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

/** Fails with the API's answer when a seeding call does not succeed. */
export async function ok<T>(response: Promise<import('@playwright/test').APIResponse>): Promise<T> {
  const answer = await response;
  expect(answer.ok(), await answer.text()).toBe(true);
  return ((await answer.json()) as { data: T }).data;
}
