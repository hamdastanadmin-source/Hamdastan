import { expect, test } from '@playwright/test';

import { requireApi } from './helpers/api';
import { ADMIN_BASE_URL, ADMIN_STATE, adminApi, API, requireAdminPanel, uniqueSlug } from './helpers/people';

/**
 * The world CMS in the panel, through its screens: a new world as a draft
 * with its publish checklist, published from its page, its menu renamed,
 * a news item created from the world's content tab (the world already
 * chosen) and published, featured on the world's home, seen in the
 * preview — and found in the central content area.
 *
 * Needs `apps/api` (migrated through 0020, `OTP_DEBUG_DISPLAY=true`) and
 * `apps/admin` running; skips with a reason otherwise. What it makes is
 * archived when it is done.
 */

test.beforeEach(async () => {
  await requireApi();
  await requireAdminPanel();
});

test('a world from draft to a featured, published news item', async ({ browser }) => {
  const api = await adminApi();
  const context = await browser.newContext({ storageState: ADMIN_STATE });
  const page = await context.newPage();
  const slug = uniqueSlug('e2e-panel');
  const name = `دنیای پنل ${slug.slice(-4)}`;
  const title = `خبر پنل ${slug.slice(-4)}`;
  let worldId: string | null = null;
  let articleId: string | null = null;

  try {
    // A new world is a draft, with the checklist of what publishing needs.
    await page.goto(`${ADMIN_BASE_URL}/worlds`);
    await page.getByRole('button', { name: 'دنیای جدید' }).click();
    await page.getByLabel('نام', { exact: true }).fill(name);
    await page.getByLabel('نامک', { exact: true }).fill(slug);
    await page.getByRole('button', { name: 'ساخت و ادامه' }).click();
    await expect(page).toHaveURL(/\/worlds\/[0-9a-f-]{36}$/);
    worldId = page.url().split('/').pop()!;
    await expect(page.getByText('پیش‌نویس', { exact: true })).toBeVisible();
    await expect(page.getByText('برای انتشار:')).toBeVisible();
    await expect(page.getByRole('button', { name: 'انتشار' })).toBeDisabled();

    // Publishing saves what is on the screen first.
    await page.getByLabel('معرفی کوتاه', { exact: true }).fill('دنیایی برای آزمودن پنل.');
    await page.getByRole('button', { name: 'انتشار' }).click();
    await expect(page.getByText('منتشرشده', { exact: true })).toBeVisible();

    // The menu: a tab renamed.
    await page.getByRole('tab', { name: 'منو' }).click();
    await page.getByLabel('برچسب «اخبار» در منو').fill('تازه‌ها');
    await page.getByRole('button', { name: 'ذخیره‌ی تغییرات' }).click();
    await expect(page.getByText('تغییرات ذخیره شد')).toBeVisible();

    // A news item from the world's own content tab: the world comes chosen.
    await page.getByRole('tab', { name: 'محتوا' }).click();
    await expect(page.getByText('هنوز محتوایی به این دنیا متصل نشده است')).toBeVisible();
    await page.getByRole('button', { name: 'ایجاد' }).click();
    await page.getByRole('menuitem', { name: 'خبر' }).click();
    await expect(page).toHaveURL(new RegExp(`/content/articles/new\\?kind=news&world=${worldId}$`));
    await expect(page.getByRole('checkbox', { name: new RegExp(name) })).toBeChecked();
    await page.getByLabel('عنوان', { exact: true }).fill(title);
    await page.getByLabel('خلاصه', { exact: true }).fill('خلاصه‌ی خبر پنل');
    await page.getByLabel('متن', { exact: true }).fill('متن خبر پنل.');
    await page.getByRole('button', { name: 'انتشار', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'انتشار' }).click();
    await expect(page).toHaveURL(/\/content\/articles\/[0-9a-f-]{36}$/);
    articleId = page.url().split('/').pop()!;
    await expect(page.getByText('منتشرشده', { exact: true })).toBeVisible();

    // Featured on the world's home.
    await page.goto(`${ADMIN_BASE_URL}/worlds/${worldId}?tab=home`);
    const news = page.locator('li', { has: page.getByRole('heading', { name: 'اخبار', exact: true }) });
    await news.getByRole('radio', { name: 'فقط موارد ویژه‌ی انتخاب‌شده' }).click();
    await news.getByRole('button', { name: 'افزودن مورد ویژه' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'افزودن' }).click();
    await page.keyboard.press('Escape');
    await expect(news.getByText(title)).toBeVisible();
    await page.getByRole('button', { name: 'ذخیره‌ی چیدمان' }).click();
    await expect(page.getByText('چیدمان خانه ذخیره شد')).toBeVisible();

    // The preview builds the home as a person would get it.
    await page.getByRole('tab', { name: 'پیش‌نمایش' }).click();
    await expect(page.getByRole('navigation', { name: 'تب‌های دنیا' })).toContainText('تازه‌ها');
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    // And the central content area finds it, by world: the only item filed under it.
    await page.goto(`${ADMIN_BASE_URL}/content`);
    await page.getByRole('combobox', { name: 'دنیا' }).click();
    await page.getByRole('option', { name }).click();
    await expect(page.getByText('۱ مورد')).toBeVisible();
    await expect(page.getByRole('link', { name: title })).toBeVisible();
  } finally {
    if (articleId) await api.post(`${API}/admin/content/articles/${articleId}/status`, { data: { action: 'archive' } });
    if (worldId) await api.post(`${API}/admin/worlds/${worldId}/status`, { data: { action: 'archive' } });
    await context.close();
    await api.dispose();
  }
});
