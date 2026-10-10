import { expect, request, test, type APIRequestContext } from '@playwright/test';

import { API_BASE_URL, API_PREFIX, SESSION } from '@hamdastan/config';

import { requireApi, testPhone } from './helpers/api';

/**
 * The security layer end to end, over HTTP against a running `apps/api`:
 * sign-in, refresh, logout, rate limits, CSRF, admin roles, and a submission
 * paying its XP once however often it is sent.
 *
 * Needs the API up with `OTP_DEBUG_DISPLAY=true` against a migrated
 * database (the seeded main admin signs in); skips with a reason otherwise.
 * Each actor gets a request context of its own, so cookies never mix.
 * Viewport-independent, so it runs once, in the `desktop` project.
 */

const API = `${API_BASE_URL}${API_PREFIX}`;
const MAIN_ADMIN = '09059466960';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'HTTP-level: one project is enough');
  await requireApi();
});

async function actor(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: API });
}

async function signIn(ctx: APIRequestContext, phone: string, prefix: '' | '/admin' = '') {
  const requested = await ctx.post(`${API}${prefix}/auth/otp/request`, { data: { phone } });
  expect(requested.status(), await requested.text()).toBe(200);
  const { debugCode } = (await requested.json()).data;
  expect(debugCode, 'the API must run with OTP_DEBUG_DISPLAY=true').toMatch(/^\d{6}$/);
  const verified = await ctx.post(`${API}${prefix}/auth/otp/verify`, { data: { phone, code: debugCode } });
  expect(verified.status(), await verified.text()).toBe(200);
  return (await verified.json()).data;
}

const cookie = async (ctx: APIRequestContext, name: string) =>
  (await ctx.storageState()).cookies.find((c) => c.name === name)?.value;

test.describe('sessions', () => {
  test('sign in, refresh with rotation, and log out for good', async () => {
    const user = await actor();
    await signIn(user, testPhone());
    expect((await user.get(`${API}/me`)).status()).toBe(200);

    const before = await cookie(user, SESSION.REFRESH_COOKIE);
    const refreshed = await user.post(`${API}/auth/refresh`);
    expect(refreshed.status()).toBe(200);
    expect(await cookie(user, SESSION.REFRESH_COOKIE)).not.toBe(before);
    expect((await user.get(`${API}/me`)).status()).toBe(200);

    expect((await user.post(`${API}/auth/logout`)).status()).toBe(200);
    expect((await user.get(`${API}/me`)).status()).toBe(401);
    expect((await user.post(`${API}/auth/refresh`)).status()).toBe(401);
  });

  test('a copied refresh token dies with the session at logout', async () => {
    // Replay after the 30s grace window is covered by the integration suite,
    // which can move the clock. Here: a copy still works inside the window,
    // and logging out ends it along with the original.
    const user = await actor();
    await signIn(user, testPhone());
    const stolen = await cookie(user, SESSION.REFRESH_COOKIE);
    await user.post(`${API}/auth/refresh`);

    const thief = await request.newContext({
      baseURL: API,
      extraHTTPHeaders: { cookie: `${SESSION.REFRESH_COOKIE}=${stolen}` },
    });
    expect((await thief.post(`${API}/auth/refresh`)).status()).toBe(200);
    await user.post(`${API}/auth/logout`);
    expect((await thief.post(`${API}/auth/refresh`)).status()).toBe(401);
  });
});

test.describe('limits and forgery', () => {
  test('a refresh token presented too often is refused with Retry-After', async () => {
    const replayer = await request.newContext({
      baseURL: API,
      extraHTTPHeaders: { cookie: `${SESSION.REFRESH_COOKIE}=e2e-${Date.now()}` },
    });
    const statuses: number[] = [];
    let last;
    for (let i = 0; i < 11; i += 1) {
      last = await replayer.post(`${API}/auth/refresh`);
      statuses.push(last.status());
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(last!.status()).toBe(429);
    expect(Number(last!.headers()['retry-after'])).toBeGreaterThan(0);
    expect(last!.headers()['x-request-id']).toBeTruthy();
    expect((await last!.json()).error.code).toBe('RATE_LIMITED');
  });

  test('a write from another site is refused, cookies and all', async () => {
    const user = await actor();
    await signIn(user, testPhone());
    const forged = await user.post(`${API}/auth/logout`, { headers: { origin: 'https://evil.example' } });
    expect(forged.status()).toBe(403);
    expect((await forged.json()).error.code).toBe('CSRF_REJECTED');
    // Still signed in: the forged logout did nothing.
    expect((await user.get(`${API}/me`)).status()).toBe(200);
  });
});

test.describe('admin roles', () => {
  test('each role reaches exactly what it may', async () => {
    const main = await actor();
    await signIn(main, MAIN_ADMIN, '/admin');

    async function adminAs(role: string) {
      const phone = testPhone();
      const created = await main.post(`${API}/admin/users`, {
        data: { firstName: 'نقش', lastName: 'آزمایشی', phone, role },
      });
      expect(created.status(), await created.text()).toBe(201);
      const ctx = await actor();
      await signIn(ctx, phone, '/admin');
      return ctx;
    }

    const content = await adminAs('content_manager');
    expect((await content.get(`${API}/admin/users`)).status()).toBe(403);
    expect((await content.get(`${API}/admin/engagement/activities`)).status()).toBe(200);
    expect((await content.post(`${API}/admin/app-users/sessions/lookup`, { data: { phone: MAIN_ADMIN } })).status()).toBe(403);

    const reviewer = await adminAs('mission_reviewer');
    expect((await reviewer.post(`${API}/admin/engagement/activities`, { data: {} })).status()).toBe(403);
    const anyId = '00000000-0000-4000-8000-000000000000';
    expect((await reviewer.post(`${API}/admin/engagement/xp/${anyId}/revoke`, { data: { reason: 'x' } })).status()).toBe(403);
    expect((await reviewer.get(`${API}/admin/engagement/activities/${anyId}/grants`)).status()).toBe(403);

    // A product session is not an admin session.
    const user = await actor();
    await signIn(user, testPhone());
    expect((await user.get(`${API}/admin/engagement/activities`)).status()).toBe(401);
  });
});

test.describe('submissions and XP', () => {
  test('a retried submission is stored and paid once', async () => {
    const main = await actor();
    await signIn(main, MAIN_ADMIN, '/admin');
    const created = await main.post(`${API}/admin/engagement/activities`, {
      data: {
        type: 'survey',
        title: 'نظرسنجی e2e',
        summary: 'یک سؤال',
        instructions: '',
        audience: { kind: 'all' },
        startsAt: null,
        endsAt: null,
        definition: {
          steps: [
            {
              id: 's1',
              title: '',
              description: '',
              questions: [
                {
                  id: 'q1',
                  kind: 'single',
                  title: 'کدوم؟',
                  required: true,
                  options: [
                    { id: 'a', label: 'الف' },
                    { id: 'b', label: 'ب' },
                  ],
                },
              ],
            },
          ],
          estimatedMinutes: 1,
          maxSubmissions: 3,
          anonymous: false,
          review: 'auto',
          assessment: null,
          xp: { enabled: true, amount: 20, showBeforeStart: true, maxAwards: 3, requirePass: false },
        },
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const { id } = (await created.json()).data;
    const published = await main.post(`${API}/admin/engagement/activities/${id}/status`, { data: { action: 'publish' } });
    expect(published.status()).toBe(200);
    const { versionId } = (await published.json()).data;

    const user = await actor();
    await signIn(user, testPhone());
    const key = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const send = () =>
      user.post(`${API}/me/activities/${id}/submit`, {
        data: { versionId, answers: { q1: 'a' } },
        headers: { 'idempotency-key': key },
      });

    // The first, a concurrent copy, and a late retry.
    const [first, copy] = await Promise.all([send(), send()]);
    const late = await send();
    for (const response of [first, copy, late]) expect(response.status()).toBe(200);
    expect((await first.json()).data).toMatchObject({ status: 'completed', xpAwarded: 20 });
    expect((await late.json()).data.xpAwarded).toBe(20);

    const account = (await (await user.get(`${API}/me/account`)).json()).data;
    expect(account.progress.xpTotal).toBe(20);
  });
});
