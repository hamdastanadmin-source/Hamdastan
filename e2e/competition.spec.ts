import { expect, test, type APIRequestContext } from '@playwright/test';

import { requireApi, testPhone } from './helpers/api';
import { adminApi, API, ok, readyPerson } from './helpers/people';

/**
 * A competition played through the screens: the window and one-try rule on
 * the intro, «شروع» to «ثبت نهایی», the place it earned, the leaderboard
 * with the person's own row — and, once it has ended, the final ranking and
 * every question's right answer with its explanation, never before.
 *
 * Needs `apps/api` running against a database migrated through 0021, with
 * `OTP_DEBUG_DISPLAY=true`; skips with a reason otherwise. The competition
 * is for the test's own numbers only and is archived when it is done. The
 * ranking and the reveal rule are covered by `apps/api`'s `competition-flow`.
 */

const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();

const definition = {
  steps: [
    {
      id: 's1',
      title: '',
      description: '',
      questions: [
        {
          id: 'q1',
          kind: 'single',
          title: 'جغد هری چه نام دارد؟',
          required: true,
          explanation: 'هدویگ هدیه‌ی تولد هاگرید بود.',
          options: [
            { id: 'a', label: 'هدویگ', correct: true },
            { id: 'b', label: 'اسکابرز', correct: false },
          ],
        },
        {
          id: 'q2',
          kind: 'single',
          title: 'مدیر هاگوارتز کیست؟',
          required: true,
          explanation: 'آلبوس دامبلدور.',
          options: [
            { id: 'a', label: 'اسنیپ', correct: false },
            { id: 'b', label: 'دامبلدور', correct: true },
          ],
        },
      ],
    },
  ],
  estimatedMinutes: 2,
  maxSubmissions: 1,
  anonymous: false,
  review: 'auto',
  assessment: { mode: 'knowledge', dimensions: [], passingScore: null, showResult: true, revealAnswers: true },
  journey: null,
  xp: { enabled: true, amount: 20, showBeforeStart: true, maxAwards: 1, requirePass: false },
};

async function publishCompetition(admin: APIRequestContext, phones: string[]) {
  const input = {
    type: 'competition',
    title: 'مسابقه‌ی آزمایشی',
    summary: 'دو سؤال، یک فرصت',
    instructions: '',
    definition,
    audience: { kind: 'users', phones },
    startsAt: hours(-1),
    endsAt: hours(2),
    worldIds: [],
  };
  const created = await ok<{ id: string }>(admin.post(`${API}/admin/engagement/activities`, { data: input }));
  await ok(admin.post(`${API}/admin/engagement/activities/${created.id}/status`, { data: { action: 'publish' } }));
  return { id: created.id, input };
}

test.beforeEach(async () => {
  await requireApi();
});

test('a competition: one try, a place on the board, the answers after the end', async ({ page, browser }) => {
  const admin = await adminApi();
  const [rival, player] = [testPhone(), testPhone()];
  const { id, input } = await publishCompetition(admin, [rival, player]);

  try {
    // Someone has already played — perfectly, and at once.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await readyPerson(otherPage, rival, 'هرمیون');
    const playing = await ok<{ versionId: string }>(otherPage.request.get(`${API}/me/activities/${id}`));
    await ok(otherPage.request.post(`${API}/me/activities/${id}/start`));
    await ok(otherPage.request.post(`${API}/me/activities/${id}/submit`, { data: { versionId: playing.versionId, answers: { q1: 'a', q2: 'b' } } }));
    await other.close();

    await readyPerson(page, player, 'هری');
    await page.goto(`/activities/${id}`);
    await expect(page.getByText(/فقط یک بار می‌تونی شرکت کنی/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'جدول امتیازات' })).toBeVisible();

    // Played through the screens: one right, one wrong.
    await page.getByRole('button', { name: 'شروع' }).click();
    await page.getByText('هدویگ', { exact: true }).click();
    await page.getByRole('button', { name: 'بعدی' }).click();
    await page.getByText('اسنیپ', { exact: true }).click();
    await page.getByRole('button', { name: 'ثبت نهایی' }).click();
    await expect(page.getByText('آفرین، ثبت شد!')).toBeVisible();
    await expect(page.getByText('۵۰٪')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'رتبه' })).toContainText('۲');
    // Still open: no answers yet.
    await expect(page.getByRole('heading', { name: 'پاسخ‌های درست' })).toHaveCount(0);

    // The board, with the person's own row.
    await page.getByRole('button', { name: 'جدول امتیازات' }).click();
    const board = page.locator('section[aria-labelledby="leaderboard"]');
    await expect(board.getByRole('listitem')).toHaveCount(2);
    await expect(board.getByRole('listitem').nth(1)).toContainText('(تو)');
    await expect(board.getByText('تا پایان مسابقه تغییر می‌کنه', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'انجامش دادی' })).toBeDisabled();

    // It ends: the ranking is final and the answers are revealed.
    const detail = await ok<{ definition: unknown }>(admin.get(`${API}/admin/engagement/activities/${id}`));
    await ok(admin.put(`${API}/admin/engagement/activities/${id}`, { data: { ...input, definition: detail.definition, startsAt: hours(-3), endsAt: hours(-0.01) } }));
    await page.reload();
    await expect(page.getByText('نتیجه‌ی نهایی', { exact: false })).toBeVisible();
    const review = page.locator('section[aria-labelledby="answer-review"]');
    await expect(review).toContainText('۱ از ۲ درست');
    await expect(review).toContainText('هدویگ هدیه‌ی تولد هاگرید بود.');
    await expect(review).toContainText('پاسخ درست: دامبلدور');
  } finally {
    await admin.post(`${API}/admin/engagement/activities/${id}/status`, { data: { action: 'archive' } });
    await admin.dispose();
  }
});
