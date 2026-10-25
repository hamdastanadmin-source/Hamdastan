import { expect, test } from '@playwright/test';

import { requireApi, testPhone } from './helpers/api';
import { adminApi, API, ok, readyPerson } from './helpers/people';

/**
 * Home's «فعالیت‌ها»: at most three, side by side in a carousel, each a
 * link to its activity.
 *
 * Needs `apps/api` running against a migrated database with
 * `OTP_DEBUG_DISPLAY=true`; skips with a reason otherwise. The surveys are
 * for the test's own number only and are archived when it is done.
 */

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
          title: 'کتاب یا فیلم؟',
          required: true,
          options: [
            { id: 'a', label: 'کتاب' },
            { id: 'b', label: 'فیلم' },
          ],
        },
      ],
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

test.beforeEach(async () => {
  await requireApi();
});

test('home shows up to three activities in a carousel', async ({ page }) => {
  const admin = await adminApi();
  const phone = testPhone();
  const ids: string[] = [];

  try {
    for (const n of [1, 2, 3, 4]) {
      const created = await ok<{ id: string }>(
        admin.post(`${API}/admin/engagement/activities`, {
          data: {
            type: 'survey',
            title: `نظرسنجی خانه ${n}`,
            summary: 'یک سؤال کوتاه',
            instructions: '',
            definition,
            audience: { kind: 'users', phones: [phone] },
            startsAt: null,
            endsAt: null,
            worldIds: [],
          },
        })
      );
      ids.push(created.id);
      await ok(admin.post(`${API}/admin/engagement/activities/${created.id}/status`, { data: { action: 'publish' } }));
    }

    await readyPerson(page, phone);
    await page.goto('/');

    const carousel = page.getByRole('region', { name: 'فعالیت‌ها' });
    await expect(carousel).toBeVisible();
    const slides = carousel.getByRole('group');
    await expect(slides).toHaveCount(3);
    await expect(slides.first().getByRole('link')).toHaveAttribute('href', /^\/activities\//);
  } finally {
    for (const id of ids) await admin.post(`${API}/admin/engagement/activities/${id}/status`, { data: { action: 'archive' } });
    await admin.dispose();
  }
});
