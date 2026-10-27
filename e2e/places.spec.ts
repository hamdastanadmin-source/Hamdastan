import path from 'node:path';

import { expect, test, type APIRequestContext } from '@playwright/test';

import { WORLD_DEFAULT_NAVIGATION } from '@hamdastan/config';
import type { AdminPlaceDetail, PlaceInput } from '@hamdastan/types';

import { requireApi, testPhone } from './helpers/api';
import { ADMIN_BASE_URL, ADMIN_STATE, adminApi, API, ok, readyPerson, requireAdminPanel, uniqueSlug } from './helpers/people';

/**
 * Places, through both apps' screens — at a phone's size and a laptop's:
 *
 *   the panel  makes the world's map, gives it an image from the library,
 *              adds «خانه» inside it and moves its pin, publishes; «خانه»
 *              holds «اتاق» with a task (seeded through the API);
 *   a person   sees the map at the top of the world's home with the house
 *              pinned on it, goes in, goes into the room, does the task,
 *              comes back to the room and up to the house.
 *
 * Needs `apps/api` (migrated through 0027, `OTP_DEBUG_DISPLAY=true`) and
 * `apps/admin`; skips with a reason otherwise.
 */

const IMAGE = path.join(__dirname, 'fixtures', 'place-map.jpg');

const inputOf = (detail: AdminPlaceDetail, change: Partial<PlaceInput>): PlaceInput => ({
  name: detail.name,
  summary: detail.summary,
  imageId: detail.imageId,
  activityIds: detail.activityIds,
  pins: detail.children.map((child) => ({ id: child.id, ...child.pin })),
  ...change,
});

async function seed(api: APIRequestContext) {
  const slug = uniqueSlug('e2e-places');
  const world = await ok<{ id: string; slug: string; name: string }>(
    api.post(`${API}/admin/worlds`, {
      data: {
        slug,
        name: `دنیای نقشه ${slug.slice(-4)}`,
        summary: 'برای آزمون مکان‌ها',
        tagline: '',
        description: '',
        coverId: null,
        theme: 'neutral',
        navigation: WORLD_DEFAULT_NAVIGATION.map((item) => ({ ...item })),
      },
    })
  );
  await ok(api.post(`${API}/admin/worlds/${world.id}/status`, { data: { action: 'publish' } }));
  const task = await ok<{ id: string; title: string }>(
    api.post(`${API}/admin/engagement/activities`, {
      data: {
        type: 'survey',
        title: `تسک اتاق ${slug.slice(-4)}`,
        summary: '',
        instructions: '',
        definition: {
          steps: [{ id: 's1', title: '', description: '', questions: [{ id: 'q1', kind: 'text', title: 'چی دیدی؟', required: true, multiline: false }] }],
          estimatedMinutes: 1,
          maxSubmissions: 1,
          anonymous: false,
          review: 'auto',
          assessment: null,
          journey: null,
          xp: { enabled: true, amount: 20, showBeforeStart: true, maxAwards: 1, requirePass: false },
        },
        audience: { kind: 'all' },
        startsAt: null,
        endsAt: null,
        worldIds: [world.id],
      },
    })
  );
  await ok(api.post(`${API}/admin/engagement/activities/${task.id}/status`, { data: { action: 'publish' } }));
  return { world, task };
}

test.beforeEach(async () => {
  await requireApi();
  await requireAdminPanel();
});

test('a map with a house and a room: built in the panel, walked from the world home', async ({ browser, page }) => {
  test.setTimeout(180_000);
  const api = await adminApi();
  const { world, task } = await seed(api);
  const context = await browser.newContext({ storageState: ADMIN_STATE });
  const panel = await context.newPage();

  // ─── The panel ─────────────────────────────────────────────────────────
  // A map: its name and its world, in one form.
  await panel.goto(`${ADMIN_BASE_URL}/places`);
  await panel.getByRole('button', { name: 'نقشه‌ی جدید' }).click();
  const form = panel.getByRole('dialog', { name: 'نقشه‌ی جدید' });
  await form.getByLabel('نام').fill('نقشه‌ی شهر');
  await form.getByRole('combobox', { name: 'جهان' }).click();
  await panel.getByRole('option', { name: world.name }).click();
  await form.getByRole('button', { name: 'ساخت' }).click();
  await expect(panel).toHaveURL(/\/places\/[0-9a-f-]{36}$/);
  const mapId = panel.url().split('/').pop()!;
  await expect(panel.getByText('پیش از انتشار، تصویر مکان را انتخاب کنید')).toBeVisible();

  // Its image, uploaded from the panel.
  await panel.getByRole('button', { name: 'انتخاب از کتابخانه یا بارگذاری' }).click();
  const picker = panel.getByRole('dialog', { name: 'تصویر «نقشه‌ی شهر»' });
  await picker.getByRole('button', { name: 'بارگذاری' }).click();
  const uploading = panel.getByRole('dialog', { name: 'بارگذاری فایل' });
  await uploading.locator('#media-file').setInputFiles(IMAGE);
  await uploading.getByRole('button', { name: 'بارگذاری' }).click();
  await expect(uploading).toBeHidden();
  await picker.getByRole('button', { name: 'انتخاب' }).click();
  await panel.getByRole('button', { name: 'ذخیره‌ی تغییرات' }).click();
  await expect(panel.getByText('تغییرات ذخیره شد')).toBeVisible();

  // «خانه», inside the map — made and managed on the map's own page; its pin moved with the keyboard and saved.
  await panel.getByRole('button', { name: 'مکان جدید داخل این‌جا' }).click();
  await panel.getByRole('dialog').getByLabel('نام').fill('خانه');
  await panel.getByRole('button', { name: 'ساخت', exact: true }).click();
  const inside = panel.getByRole('list', { name: 'مکان‌های داخل این‌جا' });
  await expect(inside.getByText('پیش‌نویس')).toBeVisible();
  await expect(panel).toHaveURL(new RegExp(`/places/${mapId}$`));
  const pin = panel.getByRole('button', { name: /پین «خانه»/ });
  await pin.focus();
  for (let i = 0; i < 4; i++) await panel.keyboard.press('Shift+ArrowLeft');
  await panel.getByRole('button', { name: 'ذخیره‌ی تغییرات' }).click();
  // The image's save is still on screen; this is the second.
  await expect(panel.getByText('تغییرات ذخیره شد')).toHaveCount(2);
  const map = await ok<AdminPlaceDetail>(api.get(`${API}/admin/places/${mapId}`));
  expect(map.children[0].pin).toEqual({ x: 30, y: 50 });
  const houseId = map.children[0].id;
  await panel.getByRole('button', { name: 'انتشار', exact: true }).click();
  await expect(panel.getByRole('heading', { level: 1 }).getByText('منتشرشده', { exact: true })).toBeVisible();
  await context.close();

  // «اتاق» inside the house, with the task; both published.
  const room = await ok<AdminPlaceDetail>(api.post(`${API}/admin/places`, { data: { worldId: world.id, parentId: houseId, name: 'اتاق' } }));
  const house = await ok<AdminPlaceDetail>(api.get(`${API}/admin/places/${houseId}`));
  await ok(api.put(`${API}/admin/places/${houseId}`, { data: inputOf(house, { imageId: map.imageId, pins: [{ id: room.id, x: 60, y: 40 }] }) }));
  await ok(api.put(`${API}/admin/places/${room.id}`, { data: inputOf(room, { imageId: map.imageId, activityIds: [task.id] }) }));
  for (const id of [houseId, room.id]) await ok(api.post(`${API}/admin/places/${id}/status`, { data: { action: 'publish' } }));

  // ─── The app ───────────────────────────────────────────────────────────
  await readyPerson(page, testPhone());
  await page.goto(`/worlds/${world.slug}`);
  const onMap = page.getByRole('navigation', { name: 'مکان‌های نقشه‌ی شهر' });
  await expect(page.getByRole('heading', { name: 'نقشه‌ی شهر' })).toBeVisible();
  await onMap.getByRole('link', { name: 'خانه، ۱ تسک' }).click();

  await expect(page).toHaveURL(new RegExp(`/places/${houseId}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'خانه' })).toBeVisible();
  await page.getByRole('navigation', { name: 'مکان‌های خانه' }).getByRole('link', { name: /اتاق/ }).click();

  await expect(page.getByRole('navigation', { name: 'breadcrumb' })).toContainText('نقشه‌ی شهر');
  await page.getByRole('region', { name: 'تسک‌های این‌جا' }).getByRole('link', { name: new RegExp(task.title) }).click();
  await page.getByRole('button', { name: 'شروع' }).click();
  await page.getByRole('textbox').fill('یک کلید');
  await page.getByRole('button', { name: 'ثبت نهایی' }).click();
  await page.getByRole('link', { name: 'بازگشت به مکان' }).click();
  await expect(page).toHaveURL(new RegExp(`/places/${room.id}$`));

  // Up to the house, and from there to the world's home.
  await page.locator('header').getByRole('link', { name: 'خانه' }).click();
  await expect(page).toHaveURL(new RegExp(`/places/${houseId}$`));
  await page.locator('header').getByRole('link', { name: world.name }).click();
  await expect(page).toHaveURL(new RegExp(`/worlds/${world.slug}$`));
});
