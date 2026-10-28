import { expect, test, type Page } from '@playwright/test';

import { requireApi, testPhone } from './helpers/api';
import { adminApi, API, ok, readyPerson } from './helpers/people';

/**
 * A flow that moves between questions on one route opens each question at
 * its top: «بعدی» and «قبلی» from the bottom of a long question land on the
 * next one's title, while picking an answer leaves the scroll where it is.
 *
 * Needs `apps/api` running against a migrated database with
 * `OTP_DEBUG_DISPLAY=true`; skips with a reason otherwise. The survey is for
 * the test's own number only and is archived when it is done.
 */

const longQuestion = (id: string, title: string) => ({
  id,
  kind: 'single',
  title,
  required: true,
  // Taller than either viewport, so the question has a bottom to scroll to.
  options: Array.from({ length: 25 }, (_, n) => ({ id: `o${n}`, label: `گزینه‌ی ${n + 1}` })),
});

const definition = {
  steps: [
    {
      id: 's1',
      title: '',
      description: '',
      questions: [longQuestion('q1', 'سؤال اول'), longQuestion('q2', 'سؤال دوم'), longQuestion('q3', 'سؤال سوم')],
    },
  ],
  estimatedMinutes: 1,
  maxSubmissions: 1,
  anonymous: false,
  review: 'auto',
  assessment: null,
  journey: null,
  xp: { enabled: false, amount: 0, showBeforeStart: false, maxAwards: 1, requirePass: false },
};

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

/** Scrolls to the bottom and answers with the last option, as a person reading down would. */
async function answerFromBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByText('گزینه‌ی ۲۵', { exact: true }).click();
  // Picking an answer is not a new screen: the scroll stays put.
  expect(await scrollY(page)).toBeGreaterThan(0);
}

test.beforeEach(async () => {
  await requireApi();
});

test('each question opens at its top, forwards and back', async ({ page }) => {
  const admin = await adminApi();
  const phone = testPhone();
  const created = await ok<{ id: string }>(
    admin.post(`${API}/admin/engagement/activities`, {
      data: {
        type: 'survey',
        title: 'نظرسنجی بلند',
        summary: 'سه سؤال بلند',
        instructions: '',
        definition,
        audience: { kind: 'users', phones: [phone] },
        startsAt: null,
        endsAt: null,
        worldIds: [],
      },
    })
  );

  try {
    await ok(admin.post(`${API}/admin/engagement/activities/${created.id}/status`, { data: { action: 'publish' } }));
    await readyPerson(page, phone);
    await page.goto(`/activities/${created.id}`);
    await page.getByRole('button', { name: 'شروع' }).click();

    for (const next of ['سؤال دوم', 'سؤال سوم']) {
      await answerFromBottom(page);
      await page.getByRole('button', { name: 'بعدی' }).click();
      await expect(page.getByRole('heading', { level: 1, name: next })).toBeInViewport();
      expect(await scrollY(page)).toBe(0);
    }

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await scrollY(page)).toBeGreaterThan(0);
    // A dispatched click: `click()` would scroll the header's button into view first and prove nothing.
    await page.getByRole('button', { name: 'قبلی' }).dispatchEvent('click');
    await expect(page.getByRole('heading', { level: 1, name: 'سؤال دوم' })).toBeInViewport();
    expect(await scrollY(page)).toBe(0);
  } finally {
    await admin.post(`${API}/admin/engagement/activities/${created.id}/status`, { data: { action: 'archive' } });
    await admin.dispose();
  }
});
