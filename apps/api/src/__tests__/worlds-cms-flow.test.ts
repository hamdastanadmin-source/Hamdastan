import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX, WORLD_DEFAULT_NAVIGATION, WORLD_HOME_KINDS } from '@hamdastan/config';
import type { ActivityInput, AdminWorldHome, ArticleInput, WorldHome, WorldHomeInput, WorldInput } from '@hamdastan/types';
import { worldHomeInputSchema, worldInputSchema } from '@hamdastan/validation';

import { buildApp } from '../app';
import { closePool, getPool, runMigrations } from '../data';
import { createLocalMediaStorage, type SmsSender } from '../integrations';
import { setAdminRepository, sqlAdminRepository } from '../modules/admin';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
import { setContentRepository, sqlContentRepository } from '../modules/content';
import { setEngagementRepository, sqlEngagementRepository } from '../modules/engagement';
import { setEventsRepository, sqlEventsRepository } from '../modules/events';
import { setMediaRepository, setMediaStorage, sqlMediaRepository } from '../modules/media';
import { setProgressRepository, sqlProgressRepository } from '../modules/progress';
import { setUsersRepository, sqlUsersRepository } from '../modules/users';
import { setWorldsRepository, sqlWorldsRepository } from '../modules/worlds';

/**
 * The world CMS end to end, against a migrated database: a world is a draft
 * until it is complete enough to publish, the product sees only published
 * worlds and live articles, a world's home shows only eligible items —
 * featured or latest, in the admin's order, never something unpublished,
 * scheduled or filed elsewhere — a switched-off tab takes its home section
 * with it, a world with content is archived rather than deleted, and every
 * admin route asks for its permission.
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const MAIN_ADMIN_PHONE = '09059466960';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

type Cookies = Record<string, string>;
const silentSender: SmsSender = { name: 'test', async sendOtp() {} };

let app: FastifyInstance;
let admin: Cookies;
let user: Cookies;
let mediaDir: string;
let coverId: string;
let phoneCounter = 0;

const nextPhone = () => {
  phoneCounter += 1;
  return `0997${String(Date.now() % 100_000).padStart(5, '0')}${String(phoneCounter).padStart(2, '0')}`;
};

const cookiesFrom = (response: LightMyRequestResponse): Cookies =>
  Object.fromEntries(response.cookies.map(({ name, value }) => [name, value]));

const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, cookies: Cookies, body?: unknown) =>
  app.inject({ method, url: `${API_PREFIX}${url}`, payload: body as object, cookies });

async function signIn(prefix: '' | '/admin', phone: string): Promise<Cookies> {
  const requested = await call('POST', `${prefix}/auth/otp/request`, {}, { phone });
  const verified = await call('POST', `${prefix}/auth/otp/verify`, {}, { phone, code: requested.json().data.debugCode });
  expect(verified.statusCode, verified.body).toBe(200);
  return cookiesFrom(verified);
}

async function ok<T>(response: LightMyRequestResponse, status = 200): Promise<T> {
  expect(response.statusCode, response.body).toBe(status);
  return response.json().data as T;
}

let counter = 0;
const unique = (prefix: string) => `${prefix}-${++counter}-${Date.now() % 100_000}`;

const world = (overrides: Partial<WorldInput> = {}): WorldInput => ({
  slug: unique('world'),
  name: 'دنیای آزمایشی',
  summary: 'معرفی کوتاه',
  tagline: '',
  description: '',
  coverId,
  theme: 'emerald',
  navigation: WORLD_DEFAULT_NAVIGATION.map((item) => ({ ...item })),
  ...overrides,
});

const article = (worldIds: string[], overrides: Partial<ArticleInput> = {}): ArticleInput => ({
  kind: 'news',
  slug: unique('news'),
  title: 'خبر تازه',
  summary: 'خلاصه',
  body: 'متن خبر',
  category: 'اعلان',
  coverId: null,
  coverAlt: '',
  thumbnailId: null,
  worldIds,
  ...overrides,
});

const survey = (worldIds: string[]): ActivityInput => ({
  type: 'survey',
  title: 'نظرسنجی دنیا',
  summary: '',
  instructions: '',
  definition: {
    steps: [{ id: 's1', title: '', description: '', questions: [{ id: 'q1', kind: 'text', title: 'نظرت؟', required: true, multiline: false }] }],
    estimatedMinutes: 1,
    maxSubmissions: 1,
    anonymous: false,
    review: 'auto',
    assessment: null,
    journey: null,
    xp: { enabled: false, amount: 0, showBeforeStart: false, maxAwards: 1, requirePass: false },
  },
  audience: { kind: 'all' },
  startsAt: null,
  endsAt: null,
  worldIds,
});

/** The home as stored, with every section latest-first except the given changes. */
const homeInput = (home: AdminWorldHome, change: Partial<Record<string, Partial<WorldHomeInput['sections'][number]>>> = {}): WorldHomeInput => ({
  sections: home.sections.map(({ featured, ...section }) => ({
    ...section,
    featuredIds: featured.map((item) => item.id),
    ...change[section.kind],
  })),
});

const createWorld = async (overrides: Partial<WorldInput> = {}) => ok<{ id: string; slug: string }>(await call('POST', '/admin/worlds', admin, world(overrides)), 201);

async function publishedWorld(): Promise<{ id: string; slug: string }> {
  const created = await createWorld();
  await ok(await call('POST', `/admin/worlds/${created.id}/status`, admin, { action: 'publish' }));
  return created;
}

async function publishedArticle(worldIds: string[], overrides: Partial<ArticleInput> = {}, publishAt?: string) {
  const created = await ok<{ id: string; slug: string }>(await call('POST', '/admin/content/articles', admin, article(worldIds, overrides)), 201);
  await ok(await call('POST', `/admin/content/articles/${created.id}/status`, admin, { action: 'publish', publishAt }));
  return created;
}

const titlesIn = (home: WorldHome, kind: string) =>
  (home.sections.find((section) => section.kind === kind)?.items ?? []).map((item) => item.title);

describe('world schemas', () => {
  it('keeps home first and every menu section exactly once', () => {
    const navigation = WORLD_DEFAULT_NAVIGATION.map((item) => ({ ...item }));
    const base = { ...world(), coverId: null };
    expect(worldInputSchema.safeParse({ ...base, navigation }).success).toBe(true);
    expect(worldInputSchema.safeParse({ ...base, navigation: [navigation[1], navigation[0], ...navigation.slice(2)] }).success).toBe(false);
    expect(worldInputSchema.safeParse({ ...base, navigation: navigation.slice(1) }).success).toBe(false);
  });

  it('asks a featured-only section for at least one item', () => {
    const sections = WORLD_HOME_KINDS.map((kind) => ({ kind, title: '', source: 'latest', itemLimit: 3, whenEmpty: 'hide', enabled: true, featuredIds: [] }));
    expect(worldHomeInputSchema.safeParse({ sections }).success).toBe(true);
    expect(worldHomeInputSchema.safeParse({ sections: [{ ...sections[0], source: 'featured' }, ...sections.slice(1)] }).success).toBe(false);
    expect(worldHomeInputSchema.safeParse({ sections: sections.slice(1) }).success).toBe(false);
  });
});

describe.skipIf(!hasDatabase)('the world CMS against a migrated database', () => {
  beforeAll(async () => {
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();
    mediaDir = await mkdtemp(path.join(tmpdir(), 'hamdastan-worlds-'));
    setUsersRepository(sqlUsersRepository);
    setAuthRepository(sqlAuthRepository);
    setAdminRepository(sqlAdminRepository);
    setProgressRepository(sqlProgressRepository);
    setEngagementRepository(sqlEngagementRepository);
    setMediaRepository(sqlMediaRepository);
    setMediaStorage(createLocalMediaStorage(mediaDir));
    setEventsRepository(sqlEventsRepository);
    setWorldsRepository(sqlWorldsRepository);
    setContentRepository(sqlContentRepository);
    setSmsSender(silentSender);
    app = await buildApp();
    await app.ready();
    admin = await signIn('/admin', MAIN_ADMIN_PHONE);
    user = await signIn('', nextPhone());
    coverId = (await ok<{ id: string }>(await call('POST', '/admin/media', admin, { name: 'کاور', category: 'cover', data: PNG.toString('base64') }), 201)).id;
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('carries the seeded worlds over as published, with the default menu and home', async () => {
    const worlds = await ok<{ slug: string }[]>(await call('GET', '/worlds', user));
    expect(worlds.map((item) => item.slug)).toEqual(['hogwarts', 'gta', 'game-of-thrones', 'liverpool']);
    const hogwarts = await ok<{ navigation: { section: string }[] }>(await call('GET', '/worlds/hogwarts', user));
    expect(hogwarts.navigation.map((item) => item.section)).toEqual(['home', 'activities']);
  });

  it('keeps a new world a draft until it is complete and published', async () => {
    const created = await createWorld({ coverId: null, summary: '' });
    expect((await call('GET', `/worlds/${created.slug}`, user)).statusCode).toBe(404);

    const refused = await call('POST', `/admin/worlds/${created.id}/status`, admin, { action: 'publish' });
    expect(refused.statusCode).toBe(400);
    expect(refused.json().error.code).toBe('WORLD_INCOMPLETE');
    expect(Object.keys(refused.json().error.details.fields)).toEqual(['summary']);

    await ok(await call('PUT', `/admin/worlds/${created.id}`, admin, world({ slug: created.slug })));
    await ok(await call('POST', `/admin/worlds/${created.id}/status`, admin, { action: 'publish' }));
    expect((await call('GET', `/worlds/${created.slug}`, user)).statusCode).toBe(200);

    await ok(await call('POST', `/admin/worlds/${created.id}/status`, admin, { action: 'unpublish' }));
    expect((await call('GET', `/worlds/${created.slug}/home`, user)).statusCode).toBe(404);
  });

  it('archives a world with content instead of deleting it, and restores it', async () => {
    const target = await publishedWorld();
    await publishedArticle([target.id]);

    const refused = await call('DELETE', `/admin/worlds/${target.id}`, admin);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.code).toBe('WORLD_IN_USE');

    await ok(await call('POST', `/admin/worlds/${target.id}/status`, admin, { action: 'archive' }));
    const locked = await call('PUT', `/admin/worlds/${target.id}`, admin, world({ slug: target.slug }));
    expect(locked.json().error.code).toBe('WORLD_ARCHIVED');
    const restored = await ok<{ status: string; articleCount: number }>(await call('POST', `/admin/worlds/${target.id}/status`, admin, { action: 'restore' }));
    expect(restored).toMatchObject({ status: 'unpublished', articleCount: 1 });

    const empty = await createWorld();
    expect((await call('DELETE', `/admin/worlds/${empty.id}`, admin)).statusCode).toBe(200);
  });

  it('shows the product only live articles, under published worlds', async () => {
    const target = await publishedWorld();
    const draft = await ok<{ id: string; slug: string }>(await call('POST', '/admin/content/articles', admin, article([target.id])), 201);
    expect((await call('GET', `/content/articles/${draft.slug}`, user)).statusCode).toBe(404);

    const incomplete = await ok<{ id: string }>(await call('POST', '/admin/content/articles', admin, article([])), 201);
    const refused = await call('POST', `/admin/content/articles/${incomplete.id}/status`, admin, { action: 'publish' });
    expect(refused.json().error.code).toBe('ARTICLE_INCOMPLETE');

    const live = await publishedArticle([target.id], { title: 'منتشرشده' });
    await publishedArticle([target.id], { title: 'زمان‌بندی‌شده' }, new Date(Date.now() + 86_400_000).toISOString());

    const list = await ok<{ items: { title: string }[] }>(await call('GET', `/content/articles?world=${target.slug}&kind=news`, user));
    expect(list.items.map((item) => item.title)).toEqual(['منتشرشده']);
    expect((await call('GET', `/content/articles/${live.slug}`, user)).statusCode).toBe(200);

    await ok(await call('POST', `/admin/content/articles/${live.id}/status`, admin, { action: 'unpublish' }));
    expect((await call('GET', `/content/articles/${live.slug}`, user)).statusCode).toBe(404);
  });

  it('builds a world home from eligible items, latest or featured in order', async () => {
    const target = await publishedWorld();
    const other = await publishedWorld();
    const first = await publishedArticle([target.id], { title: 'اول' });
    const second = await publishedArticle([target.id], { title: 'دوم' });
    const draft = await ok<{ id: string }>(await call('POST', '/admin/content/articles', admin, article([target.id], { title: 'پیش‌نویس' })), 201);
    const elsewhere = await publishedArticle([other.id], { title: 'دنیای دیگر' });

    let home = await ok<WorldHome>(await call('GET', `/worlds/${target.slug}/home`, user));
    expect(titlesIn(home, 'news')).toEqual(['دوم', 'اول']);
    // An empty section hides by default.
    expect(home.sections.map((section) => section.kind)).toEqual(['news']);

    const stored = await ok<AdminWorldHome>(await call('GET', `/admin/worlds/${target.id}/home`, admin));
    const misplaced = await call('PUT', `/admin/worlds/${target.id}/home`, admin, homeInput(stored, { news: { source: 'featured', featuredIds: [elsewhere.id] } }));
    expect(misplaced.statusCode).toBe(400);
    expect(misplaced.json().error.code).toBe('WORLD_HOME_ITEM_INVALID');

    const saved = await ok<AdminWorldHome>(
      await call('PUT', `/admin/worlds/${target.id}/home`, admin, homeInput(stored, { news: { source: 'featured', featuredIds: [first.id, draft.id, second.id] } }))
    );
    expect(saved.sections.find((section) => section.kind === 'news')!.featured.map((item) => [item.title, item.live])).toEqual([
      ['اول', true],
      ['پیش‌نویس', false],
      ['دوم', true],
    ]);
    home = await ok<WorldHome>(await call('GET', `/worlds/${target.slug}/home`, user));
    expect(titlesIn(home, 'news')).toEqual(['اول', 'دوم']);

    // Unpublishing a featured item takes it off the home at once.
    await ok(await call('POST', `/admin/content/articles/${first.id}/status`, admin, { action: 'unpublish' }));
    home = await ok<WorldHome>(await call('GET', `/worlds/${target.slug}/home`, user));
    expect(titlesIn(home, 'news')).toEqual(['دوم']);
  });

  it('leads with events, orders the rest, shows an empty state when asked, and drops the activities menu when it is off', async () => {
    const target = await publishedWorld();
    await publishedArticle([target.id], { kind: 'knowledge', title: 'دانستنی' });
    const activity = await ok<{ id: string }>(await call('POST', '/admin/engagement/activities', admin, survey([target.id])), 201);
    await ok(await call('POST', `/admin/engagement/activities/${activity.id}/status`, admin, { action: 'publish' }));

    const stored = await ok<AdminWorldHome>(await call('GET', `/admin/worlds/${target.id}/home`, admin));
    const order = ['knowledge', 'activities', 'events', 'news'];
    const input = homeInput(stored, { events: { whenEmpty: 'message', title: 'دورهمی‌ها' } });
    input.sections.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    await ok(await call('PUT', `/admin/worlds/${target.id}/home`, admin, input));

    let home = await ok<WorldHome>(await call('GET', `/worlds/${target.slug}/home`, user));
    // Events lead whatever position they were saved at.
    expect(home.sections.map((section) => [section.kind, section.title, section.items.length])).toEqual([
      ['events', 'دورهمی‌ها', 0],
      ['knowledge', 'دانستنی‌ها', 1],
      ['activities', 'فعالیت‌ها', 1],
    ]);

    const tab = await ok<{ title: string }[]>(await call('GET', `/worlds/${target.slug}/activities`, user));
    expect(tab.map((item) => item.title)).toEqual(['نظرسنجی دنیا']);

    const navigation = WORLD_DEFAULT_NAVIGATION.map((item) => ({ ...item, enabled: item.section !== 'activities' }));
    await ok(await call('PUT', `/admin/worlds/${target.id}`, admin, world({ slug: target.slug, navigation })));
    home = await ok<WorldHome>(await call('GET', `/worlds/${target.slug}/home`, user));
    // The home keeps its sections; only the menu loses «فعالیت‌ها».
    expect(home.sections.map((section) => section.kind)).toEqual(['events', 'knowledge', 'activities']);
    expect(home.world.navigation.map((item) => item.section)).not.toContain('activities');
    // A menu that is off is not there at all.
    expect((await call('GET', `/worlds/${target.slug}/activities`, user)).statusCode).toBe(404);
  });

  it('previews a draft world for the panel only', async () => {
    const draft = await createWorld();
    await publishedArticle([draft.id], { title: 'پیش‌نمایش' });
    const preview = await ok<WorldHome>(await call('GET', `/admin/worlds/${draft.id}/preview`, admin));
    expect(preview.preview).toEqual({ status: 'draft' });
    expect(titlesIn(preview, 'news')).toEqual(['پیش‌نمایش']);
    expect((await call('GET', `/worlds/${draft.slug}/home`, user)).statusCode).toBe(404);
  });

  it('lists articles, events and activities in one index, filtered by world', async () => {
    const target = await publishedWorld();
    await publishedArticle([target.id], { title: 'در فهرست' });
    await ok(await call('POST', '/admin/engagement/activities', admin, { ...survey([target.id]), title: 'فعالیت در فهرست' }), 201);

    const index = await ok<{ items: { type: string; title: string; status: string }[]; total: number }>(
      await call('GET', `/admin/content?world=${target.id}`, admin)
    );
    expect(index.total).toBe(2);
    expect(index.items.map((item) => [item.type, item.title, item.status])).toEqual([
      ['activity', 'فعالیت در فهرست', 'draft'],
      ['news', 'در فهرست', 'published'],
    ]);
    const activities = await ok<{ items: { worlds: { id: string }[] }[] }>(await call('GET', `/admin/engagement/activities?world=${target.id}`, admin));
    expect(activities.items).toHaveLength(1);
    expect(activities.items[0].worlds.map((item) => item.id)).toEqual([target.id]);
  });

  it('asks every admin route for its permission', async () => {
    const phone = nextPhone();
    await ok(await call('POST', '/admin/users', admin, { firstName: 'بازبین', lastName: 'آزمایشی', phone, status: 'active', role: 'mission_reviewer' }), 201);
    const reviewer = await signIn('/admin', phone);

    expect((await call('GET', '/admin/content', reviewer)).statusCode).toBe(403);
    expect((await call('POST', '/admin/content/articles', reviewer, article([]))).statusCode).toBe(403);
    expect((await call('GET', '/admin/worlds', reviewer)).statusCode).toBe(403);
    expect((await call('POST', '/admin/worlds', reviewer, world())).statusCode).toBe(403);
    expect((await call('GET', '/admin/content', user)).statusCode).toBe(401);
  });
});
