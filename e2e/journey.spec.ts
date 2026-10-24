import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test';

import { API_BASE_URL, API_PREFIX, INTEREST_CATEGORIES } from '@hamdastan/config';

import { requireApi, testPhone } from './helpers/api';

/**
 * The multi-day journey, played through the screens: the timeline, a day's
 * cover, a question, the motion after an answer, the day's celebration and
 * end page with its invitation, progress surviving a reload, a locked day
 * showing nothing of itself — and an invitee brought back to the journey
 * after signing up.
 *
 * Needs `apps/api` running against a database migrated through 0017, with
 * `OTP_DEBUG_DISPLAY=true`; skips with a reason otherwise. The journey it
 * makes is for its own test numbers only, and is archived when it is done,
 * so nobody else ever sees it. The rules underneath — the clock, the
 * ledger, the result — are covered by `apps/api`'s suites.
 */

const API = `${API_BASE_URL}${API_PREFIX}`;
const ADMIN_PHONE = '09059466960';

test.beforeEach(async () => {
  await requireApi();
});

async function signIn(api: APIRequestContext, prefix: '' | '/admin', phone: string) {
  const requested = await api.post(`${API}${prefix}/auth/otp/request`, { data: { phone } });
  const code = (await requested.json()).data.debugCode as string;
  const verified = await api.post(`${API}${prefix}/auth/otp/verify`, { data: { phone, code } });
  expect(verified.ok(), await verified.text()).toBe(true);
}

/** A person through sign-in, the profile, the username and onboarding stage 1 — straight to home. */
async function readyPerson(page: Page, phone: string) {
  await signIn(page.request, '', phone);
  const profile = await page.request.put(`${API}/me/basic-info`, {
    data: { firstName: 'سارا', lastName: 'آزمایشی', birthDate: { year: 1375, month: 6, day: 14 }, gender: 'female' },
  });
  expect(profile.ok(), await profile.text()).toBe(true);
  // Keeps the generated username: the step only has to be answered.
  const session = await (await page.request.get(`${API}/me`)).json();
  expect((await page.request.put(`${API}/me/username`, { data: { username: session.data.user.username } })).ok()).toBe(true);
  const interestIds = INTEREST_CATEGORIES.slice(0, 3).map((category) => category.interests[0].id);
  expect((await page.request.put(`${API}/me/onboarding/interests`, { data: { interestIds } })).ok()).toBe(true);
  expect((await page.request.post(`${API}/me/onboarding/complete`)).ok()).toBe(true);
}

const off = (durationMs: number) => ({ mode: 'off', durationMs, caption: '', sound: false });
const choice = (id: string, title: string) => ({
  id,
  kind: 'single',
  title,
  required: true,
  options: [
    { id: 'a', label: 'گریفیندور' },
    { id: 'b', label: 'ریونکلا' },
  ],
});

/** A published two-day journey for these phones; answered by the caller, archived after. */
async function publishJourney(admin: APIRequestContext, phones: string[]): Promise<string> {
  const created = await admin.post(`${API}/admin/engagement/activities`, {
    data: {
      type: 'journey',
      title: 'چالش آزمایشی',
      summary: 'دو روز',
      instructions: '',
      audience: { kind: 'users', phones },
      startsAt: new Date(Date.now() - 5_000).toISOString(),
      endsAt: null,
      definition: {
        steps: [
          { id: 'd1', title: 'روز اول', description: '', questions: [choice('q1', 'کدوم گروه؟'), choice('q2', 'کدوم کلاس؟')] },
          { id: 'd2', title: 'روز دوم', description: '', questions: [choice('q3', 'کدوم جنگل؟')] },
        ],
        estimatedMinutes: 2,
        maxSubmissions: 1,
        anonymous: false,
        review: 'auto',
        assessment: null,
        journey: {
          unlockMode: 'calendar_day',
          timezone: 'Asia/Tehran',
          missedDays: 'catch_up',
          requirePreviousDay: false,
          allowReview: true,
          questionsPerDay: 2,
          rewards: { perQuestion: 2, perDay: 10 },
          motions: {
            answer: { mode: 'builtin', effect: 'pop', durationMs: 800, caption: 'ایول!', sound: false },
            dayComplete: { mode: 'builtin', effect: 'confetti', durationMs: 1000, caption: 'روز تموم شد!', sound: false },
            journeyComplete: off(3500),
          },
        },
        xp: { enabled: true, amount: 20, showBeforeStart: true, maxAwards: 1, requirePass: false },
      },
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const id = (await created.json()).data.id as string;
  expect((await admin.post(`${API}/admin/engagement/activities/${id}/status`, { data: { action: 'publish' } })).ok()).toBe(true);
  return id;
}

test('a journey day, played through: cover, motion, celebration, end page and invitation', async ({ page, context }) => {
  const admin = await playwrightRequest.newContext();
  await signIn(admin, '/admin', ADMIN_PHONE);
  const phone = testPhone();
  const id = await publishJourney(admin, [phone]);

  try {
    await readyPerson(page, phone);
    await page.goto(`/activities/${id}`);

    // The timeline: day 1 open, day 2 locked and nameless.
    await expect(page.getByRole('heading', { name: 'چالش آزمایشی' })).toBeVisible();
    await expect(page.getByText('روز اول')).toBeVisible();
    await expect(page.getByText('روز دوم')).toHaveCount(0);

    await page.getByRole('button', { name: /شروع روز ۱/ }).click();
    await page.getByRole('button', { name: 'شروع' }).click();

    // An answer: saved, then the motion, then the next question.
    await page.getByText('گریفیندور').click();
    await page.getByRole('button', { name: 'ثبت پاسخ' }).click();
    await expect(page.getByText('ایول!')).toBeVisible();
    await expect(page.getByText('کدوم کلاس؟')).toBeVisible();

    // The day's last answer: the celebration, then the end page.
    await page.getByText('ریونکلا').click();
    await page.getByRole('button', { name: 'ثبت پاسخ' }).click();
    await expect(page.getByText('روز تموم شد!')).toBeVisible();
    await expect(page.getByText('۱ از ۲ روز')).toBeVisible();
    await expect(page.getByText(/امروز/)).toContainText('۱۴');

    // The invitation: with no share sheet, the link is copied.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined }));
    await page.getByRole('button', { name: 'دعوت از دوستان' }).click();
    await expect(page.getByText('لینک دعوت کپی شد')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`/activities/${id}`);

    // Progress is the server's: a reload keeps it.
    await page.reload();
    await expect(page.getByText('۱ از ۲ روز')).toBeVisible();
  } finally {
    await admin.post(`${API}/admin/engagement/activities/${id}/status`, { data: { action: 'archive' } });
    await admin.dispose();
  }
});

test('an invitee is brought back to the journey after signing up', async ({ browser }) => {
  const admin = await playwrightRequest.newContext();
  await signIn(admin, '/admin', ADMIN_PHONE);
  const phone = testPhone();
  const id = await publishJourney(admin, [phone]);

  try {
    const guest = await browser.newContext();
    const page = await guest.newPage();
    await page.goto(`/activities/${id}`);
    await expect(page).toHaveURL(/\/welcome$/);

    await readyPerson(page, phone);
    await page.goto('/');
    await expect(page).toHaveURL(new RegExp(`/activities/${id}$`));
    await guest.close();
  } finally {
    await admin.post(`${API}/admin/engagement/activities/${id}/status`, { data: { action: 'archive' } });
    await admin.dispose();
  }
});
