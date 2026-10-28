import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX } from '@hamdastan/config';
import type { ActivityInput, ActivityResults, ActivitySubmission, PlayerActivity, ThisOrThatSettings } from '@hamdastan/types';
import { activityInputSchema, thisOrThatAnswers, thisOrThatWinners } from '@hamdastan/validation';

import { buildApp } from '../app';
import { closePool, getPool, runMigrations } from '../data';
import { createLocalMediaStorage, type SmsSender } from '../integrations';
import { setAdminRepository, sqlAdminRepository } from '../modules/admin';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
import { setEngagementRepository, sqlEngagementRepository } from '../modules/engagement';
import { cardOrder } from '../modules/engagement/engagement.this-or-that';
import { setMediaRepository, setMediaStorage, sqlMediaRepository } from '../modules/media';
import { setProgressRepository, sqlProgressRepository } from '../modules/progress';
import { setUsersRepository, sqlUsersRepository } from '../modules/users';

/**
 * «این یا اون» end to end: cards meet two at a time, the winner staying on
 * against the next; a run is saved as it goes, checked against the
 * person's own order, taken once and only whole; and the panel counts each
 * card's matches and final picks. The rules run without a database.
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const MAIN_ADMIN_PHONE = '09059466960';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const IMAGE = '7f1c2a9e-4b3d-4c5e-9a8b-1d2e3f4a5b6c';

type Cookies = Record<string, string>;
const silentSender: SmsSender = { name: 'test', async sendOtp() {} };

let app: FastifyInstance;
let admin: Cookies;
let mediaDir: string;

const cookiesFrom = (response: LightMyRequestResponse): Cookies =>
  Object.fromEntries(response.cookies.map(({ name, value }) => [name, value]));

const call = (method: 'GET' | 'POST' | 'PUT', url: string, cookies: Cookies, body?: unknown) =>
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

const duel = (cards: ThisOrThatSettings['cards'], order: ThisOrThatSettings['order'] = 'manual'): ActivityInput => ({
  type: 'this_or_that',
  title: 'کدوم غذا؟',
  summary: '',
  instructions: '',
  definition: {
    steps: [],
    estimatedMinutes: 2,
    maxSubmissions: 5,
    anonymous: false,
    review: 'auto',
    assessment: null,
    journey: null,
    thisOrThat: { coverImageId: null, order, cards },
    xp: { enabled: true, amount: 15, showBeforeStart: true, maxAwards: 5, requirePass: false },
  },
  audience: { kind: 'all' },
  startsAt: null,
  endsAt: null,
  worldIds: [],
});

const cardsOf = (ids: string[], imageId = IMAGE) => ids.map((id) => ({ id, imageId, title: `کارت ${id}` }));

describe('this-or-that rules', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('is taken once, has no questions, and needs an image on every card', () => {
    const parsed = activityInputSchema.parse(duel(cardsOf(ids)));
    expect(parsed.definition.maxSubmissions).toBe(1);
    expect(parsed.definition.xp.maxAwards).toBe(1);
    expect(parsed.definition.steps).toEqual([]);

    const blank = activityInputSchema.safeParse(duel([...cardsOf(['a']), { id: 'b', imageId: '', title: '' }]));
    expect(blank.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['definition.thisOrThat.cards.1.imageId']);
    expect(activityInputSchema.safeParse(duel(cardsOf(['a']))).success).toBe(false);
  });

  it('reads a run of matches from the first card, the winner staying on', () => {
    const answers = thisOrThatAnswers(ids, ['b', 'c', 'c']);
    expect(answers).toEqual({ 1: ['b', 'a'], 2: ['c', 'b'], 3: ['c', 'd'] });
    expect(thisOrThatWinners(ids, answers)).toEqual(['b', 'c', 'c']);
    expect(thisOrThatWinners(ids, { 1: ['b', 'a'] })).toEqual(['b']);
    // A match between cards that never met, a skipped match, or a run too long is not one.
    expect(thisOrThatWinners(ids, { 1: ['c', 'a'] })).toBeNull();
    expect(thisOrThatWinners(ids, { 2: ['c', 'b'] })).toBeNull();
    expect(thisOrThatWinners(['a', 'b'], { 1: ['a', 'b'], 2: ['a', 'b'] })).toBeNull();
  });

  it('shuffles each person’s order the same way every time', () => {
    const settings: ThisOrThatSettings = { coverImageId: null, order: 'random', cards: cardsOf(ids) };
    const once = cardOrder(settings, 'v:user').map((card) => card.id);
    expect(cardOrder(settings, 'v:user').map((card) => card.id)).toEqual(once);
    expect([...once].sort()).toEqual(ids);
    expect(cardOrder({ ...settings, order: 'manual' }, 'v:user').map((card) => card.id)).toEqual(ids);
  });
});

describe.skipIf(!hasDatabase)('this-or-that against a migrated database', () => {
  beforeAll(async () => {
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();
    mediaDir = await mkdtemp(path.join(tmpdir(), 'hamdastan-media-'));
    setUsersRepository(sqlUsersRepository);
    setAuthRepository(sqlAuthRepository);
    setAdminRepository(sqlAdminRepository);
    setProgressRepository(sqlProgressRepository);
    setEngagementRepository(sqlEngagementRepository);
    setMediaRepository(sqlMediaRepository);
    setMediaStorage(createLocalMediaStorage(mediaDir));
    setSmsSender(silentSender);
    app = await buildApp();
    await app.ready();
    admin = await signIn('/admin', MAIN_ADMIN_PHONE);
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('saves a run as it goes, takes it once and whole, and counts every card', async () => {
    const image = await ok<{ id: string }>(
      await call('POST', '/admin/media', admin, { name: 'غذا', category: 'question', data: PNG.toString('base64') }),
      201
    );
    const created = await ok<{ id: string }>(
      await call('POST', '/admin/engagement/activities', admin, duel(cardsOf(['a', 'b', 'c'], image.id))),
      201
    );
    await ok(await call('POST', `/admin/engagement/activities/${created.id}/status`, admin, { action: 'publish' }));

    const player = await signIn('', '09960000001');
    const activity = await ok<PlayerActivity>(await call('GET', `/me/activities/${created.id}`, player));
    expect(activity.thisOrThat?.cards.map((card) => card.id)).toEqual(['a', 'b', 'c']);
    expect(activity.media[image.id]).toBeDefined();
    await ok(await call('POST', `/me/activities/${created.id}/start`, player));

    // Half-way: kept, and handed back on the next read.
    await ok(await call('PUT', `/me/activities/${created.id}/draft`, player, { answers: { 1: ['b', 'a'] } }));
    expect((await ok<PlayerActivity>(await call('GET', `/me/activities/${created.id}`, player))).draft).toEqual({ 1: ['b', 'a'] });
    expect((await call('PUT', `/me/activities/${created.id}/draft`, player, { answers: { 1: ['c', 'a'] } })).statusCode).toBe(400);

    const submit = (answers: object) =>
      call('POST', `/me/activities/${created.id}/submit`, player, { versionId: activity.versionId, answers });
    expect((await submit({ 1: ['b', 'a'] })).statusCode).toBe(400);
    const done = await ok<ActivitySubmission>(await submit({ 1: ['b', 'a'], 2: ['b', 'c'] }));
    expect(done).toMatchObject({ status: 'completed', xpAwarded: 15 });
    expect((await submit({ 1: ['b', 'a'], 2: ['b', 'c'] })).json().error.code).toBe('ACTIVITY_LIMIT_REACHED');

    const results = await ok<ActivityResults>(await call('GET', `/admin/engagement/activities/${created.id}/results`, admin));
    expect(results.activity.stats).toMatchObject({ started: 1, completed: 1 });
    expect(results.thisOrThat?.map(({ id, wins, matches, finalWins, finalShare }) => [id, wins, matches, finalWins, finalShare])).toEqual([
      ['b', 2, 2, 1, 1],
      ['a', 0, 1, 0, 0],
      ['c', 0, 1, 0, 0],
    ]);
  });
});
