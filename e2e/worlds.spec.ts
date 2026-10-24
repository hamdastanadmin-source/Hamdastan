import { expect, test, type APIRequestContext, type Cookie } from '@playwright/test';

import { WORLD_DEFAULT_NAVIGATION } from '@hamdastan/config';

import { requireApi, testPhone } from './helpers/api';
import { adminApi, API, ok, readyPerson, uniqueSlug } from './helpers/people';

/**
 * A world as a person meets it: home's «جهان‌های هم‌داستان» sheet that leads to it, its hero
 * and bottom menu, the home the admin arranged — featured news in the
 * admin's order, an empty section that asked to stay — a section's «همه»
 * page, an article and the way back, and the world gone the moment it is
 * unpublished.
 *
 * Needs `apps/api` running against a database migrated through 0020, with
 * `OTP_DEBUG_DISPLAY=true`; skips with a reason otherwise. What it makes is
 * archived when it is done. The rules underneath — eligibility, featured
 * items, the lifecycle — are covered by `apps/api`'s `worlds-cms-flow` suite.
 */

test.describe.configure({ mode: 'serial' });

let admin: APIRequestContext;
/** One person for the whole file: every sign-in counts against the API's per-address limit. */
let person: Cookie[];
let world: { id: string; slug: string; name: string };
const articles: { id: string; slug: string; title: string }[] = [];

async function article(kind: 'news' | 'knowledge', title: string) {
  const created = await ok<{ id: string; slug: string }>(
    admin.post(`${API}/admin/content/articles`, {
      data: {
        kind,
        slug: uniqueSlug(kind),
        title,
        summary: `خلاصه‌ی ${title}`,
        body: 'پاراگراف نخست.\n\nپاراگراف دوم.',
        category: '',
        coverId: null,
        coverAlt: '',
        thumbnailId: null,
        worldIds: [world.id],
      },
    })
  );
  await ok(admin.post(`${API}/admin/content/articles/${created.id}/status`, { data: { action: 'publish' } }));
  articles.push({ ...created, title });
  return created;
}

test.beforeAll(async ({ browser }) => {
  await requireApi();
  admin = await adminApi();
  const context = await browser.newContext();
  await readyPerson(await context.newPage(), testPhone());
  person = await context.cookies();
  await context.close();
  const slug = uniqueSlug('e2e-world');
  const name = `دنیای آزمایشی ${slug.slice(-4)}`;
  const created = await ok<{ id: string }>(
    admin.post(`${API}/admin/worlds`, {
      data: {
        slug,
        name,
        summary: 'دنیایی که تست‌ها می‌سازند',
        tagline: 'برای آزمودن صفحه‌ی دنیا',
        description: 'این دنیا را تست‌های e2e ساخته‌اند.',
        coverId: null,
        theme: 'emerald',
        navigation: WORLD_DEFAULT_NAVIGATION,
      },
    })
  );
  world = { id: created.id, slug, name };
  await ok(admin.post(`${API}/admin/worlds/${world.id}/status`, { data: { action: 'publish' } }));

  const first = await article('news', 'خبر نخست');
  const second = await article('news', 'خبر دوم');
  await article('knowledge', 'یک دانستنی');

  // News: only the two featured, the second first. Events: kept with its empty state.
  const home = await ok<{ sections: { kind: string; featured: { id: string }[] }[] }>(admin.get(`${API}/admin/worlds/${world.id}/home`));
  await ok(
    admin.put(`${API}/admin/worlds/${world.id}/home`, {
      data: {
        sections: home.sections.map(({ featured, ...section }) => ({
          ...section,
          featuredIds: section.kind === 'news' ? [second.id, first.id] : featured.map((item) => item.id),
          ...(section.kind === 'news' ? { source: 'featured' } : {}),
          ...(section.kind === 'events' ? { whenEmpty: 'message' } : {}),
        })),
      },
    })
  );
});

test.beforeEach(async ({ context }) => {
  await context.addCookies(person);
});

test.afterAll(async () => {
  if (!admin) return;
  for (const item of articles) await admin.post(`${API}/admin/content/articles/${item.id}/status`, { data: { action: 'archive' } });
  if (world) await admin.post(`${API}/admin/worlds/${world.id}/status`, { data: { action: 'archive' } });
  await admin.dispose();
});

test('home leads to the world, which opens on the home its admin arranged', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /جهان‌های هم‌داستان/ }).click();
  await page.getByRole('dialog', { name: 'جهان‌های هم‌داستان' }).getByRole('link', { name: world.name }).click();
  await expect(page).toHaveURL(new RegExp(`/worlds/${world.slug}$`));

  await expect(page.getByRole('heading', { level: 1, name: world.name })).toBeVisible();
  await expect(page.getByText('برای آزمودن صفحه‌ی دنیا')).toBeVisible();
  // The menu is the bottom bar: home and activities.
  const menu = page.getByRole('navigation', { name: `منوی ${world.name}` }).getByRole('link');
  await expect(menu).toHaveText(WORLD_DEFAULT_NAVIGATION.map((item) => item.label));
  await expect(menu.first()).toHaveAttribute('aria-current', 'page');

  // Events lead the home, here kept with their empty state.
  const events = page.locator('section[aria-labelledby^="world-section-"]').first();
  await expect(events).toHaveAttribute('aria-labelledby', 'world-section-events');
  await expect(events).toContainText('فعلاً چیزی نیست');

  const news = page.locator('section[aria-labelledby="world-section-news"]');
  await expect(news.getByRole('link').filter({ hasText: 'خبر' })).toHaveText([/خبر دوم/, /خبر نخست/]);
  await expect(page.locator('section[aria-labelledby="world-section-events"]').getByText('فعلاً چیزی نیست')).toBeVisible();
  await expect(page.getByRole('heading', { name: `درباره‌ی ${world.name}` })).toBeVisible();
});

test('«همه» opens a page of its own, and an article leads back to it', async ({ page }) => {
  await page.goto(`/worlds/${world.slug}`);
  await page.locator('section[aria-labelledby="world-section-knowledge"]').getByRole('link', { name: 'همه' }).click();
  await expect(page).toHaveURL(new RegExp(`/worlds/${world.slug}/knowledge$`));
  await expect(page.getByRole('heading', { level: 1, name: 'دانستنی‌ها' })).toBeVisible();
  await expect(page.getByRole('link', { name: /یک دانستنی/ })).toBeVisible();

  // The address the section had as a tab still lands on its page.
  await page.goto(`/worlds/${world.slug}?tab=news`);
  await expect(page).toHaveURL(new RegExp(`/worlds/${world.slug}/news$`));
  await page.getByRole('link', { name: /خبر نخست/ }).click();
  await expect(page).toHaveURL(/\/articles\//);
  await expect(page.getByRole('heading', { level: 1, name: 'خبر نخست' })).toBeVisible();
  await expect(page.getByText('پاراگراف دوم.')).toBeVisible();

  await page.getByRole('link', { name: world.name }).first().click();
  await expect(page).toHaveURL(new RegExp(`/worlds/${world.slug}/news$`));
});

test('the menu leads to the world\'s «فعالیت‌ها», which is its own address', async ({ page }) => {
  await page.goto(`/worlds/${world.slug}`);
  const menu = page.getByRole('navigation', { name: `منوی ${world.name}` });
  await menu.getByRole('link', { name: 'فعالیت‌ها' }).click();
  await expect(page).toHaveURL(new RegExp(`/worlds/${world.slug}/activities$`));
  await expect(page.getByRole('heading', { level: 1, name: `فعالیت‌ها · ${world.name}` })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'فعالیت‌ها' })).toHaveAttribute('aria-current', 'page');
  await expect(menu.getByRole('link', { name: 'خانه' })).not.toHaveAttribute('aria-current', 'page');

  // The old tab address lands here too.
  await page.goto(`/worlds/${world.slug}?tab=activities`);
  await expect(page).toHaveURL(new RegExp(`/worlds/${world.slug}/activities$`));
});

test('an unpublished article leaves the home, an unpublished world is gone', async ({ page }) => {
  const first = articles.find((item) => item.title === 'خبر نخست')!;
  await ok(admin.post(`${API}/admin/content/articles/${first.id}/status`, { data: { action: 'unpublish' } }));
  await page.goto(`/worlds/${world.slug}`);
  const news = page.locator('section[aria-labelledby="world-section-news"]');
  await expect(news.getByRole('link').filter({ hasText: 'خبر' })).toHaveText([/خبر دوم/]);
  await page.goto(`/articles/${first.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: 'خبر نخست' })).toHaveCount(0);

  await ok(admin.post(`${API}/admin/worlds/${world.id}/status`, { data: { action: 'unpublish' } }));
  await page.goto(`/worlds/${world.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: world.name })).toHaveCount(0);
  await page.goto('/');
  await page.getByRole('button', { name: /جهان‌های هم‌داستان/ }).click();
  await expect(page.getByRole('dialog', { name: 'جهان‌های هم‌داستان' }).getByRole('link', { name: world.name })).toHaveCount(0);
});
