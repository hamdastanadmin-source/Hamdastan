import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX, WORLD_DEFAULT_NAVIGATION } from '@hamdastan/config';
import type { ActivityInput, AdminPlaceDetail, AdminPlaceSummary, PlaceInput, PlaceView, PlayerActivity, WorldInput } from '@hamdastan/types';
import { placeInputSchema, placePublishProblems } from '@hamdastan/validation';

import { buildApp } from '../app';
import { closePool, getPool, runMigrations } from '../data';
import { createLocalMediaStorage, type SmsSender } from '../integrations';
import { setAdminRepository, sqlAdminRepository } from '../modules/admin';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
import { setContentRepository, sqlContentRepository } from '../modules/content';
import { setEngagementRepository, sqlEngagementRepository } from '../modules/engagement';
import { setEventsRepository, sqlEventsRepository } from '../modules/events';
import { setMediaRepository, setMediaStorage, sqlMediaRepository } from '../modules/media';
import { setPlacesRepository, sqlPlacesRepository } from '../modules/places';
import { setProgressRepository, sqlProgressRepository } from '../modules/progress';
import { setUsersRepository, sqlUsersRepository } from '../modules/users';
import { setWorldsRepository, sqlWorldsRepository } from '../modules/worlds';

/**
 * Places end to end, against a migrated database: a world's one map, a house
 * pinned on it and two rooms pinned in the house — and no layer under those;
 * a task in each room; the product sees the map with the house's pin
 * counting the tasks inside it, goes in, sees the rooms where the admin
 * pinned them, does a task once, and sees nothing that is not published.
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const MAIN_ADMIN_PHONE = '09059466960';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

type Cookies = Record<string, string>;
const silentSender: SmsSender = { name: 'test', async sendOtp() {} };

let app: FastifyInstance;
let admin: Cookies;
let mediaDir: string;
let phoneCounter = 0;

const nextPhone = () => {
  phoneCounter += 1;
  return `0996${String(Date.now() % 100_000).padStart(5, '0')}${String(phoneCounter).padStart(2, '0')}`;
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

const code = (response: LightMyRequestResponse) => response.json().error?.code as string | undefined;

const inputOf = (detail: AdminPlaceDetail, change: Partial<PlaceInput> = {}): PlaceInput => ({
  name: detail.name,
  summary: detail.summary,
  imageId: detail.imageId,
  activityIds: detail.activityIds,
  pins: detail.children.map((child) => ({ id: child.id, ...child.pin })),
  ...change,
});

describe('a place before it is published', () => {
  it('needs a name and an image', () => {
    expect(placePublishProblems({ name: 'خانه', imageId: null }).map((p) => p.field)).toEqual(['imageId']);
    expect(placePublishProblems({ name: 'خانه', imageId: crypto.randomUUID() })).toEqual([]);
  });

  it('keeps pins on the image: percent, 0 to 100', () => {
    const base = { name: 'خانه', summary: '', imageId: null, activityIds: [], pins: [{ id: crypto.randomUUID(), x: 20, y: 80 }] };
    expect(placeInputSchema.safeParse(base).success).toBe(true);
    expect(placeInputSchema.safeParse({ ...base, pins: [{ ...base.pins[0], x: 120 }] }).success).toBe(false);
  });
});

describe.skipIf(!hasDatabase)('places against a migrated database', () => {
  let world: { id: string; slug: string };
  let image: string;
  let map: AdminPlaceDetail;
  let house: AdminPlaceDetail;
  let room: AdminPlaceDetail;
  let hall: AdminPlaceDetail;
  const tasks: string[] = [];

  beforeAll(async () => {
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();
    mediaDir = await mkdtemp(path.join(tmpdir(), 'hamdastan-places-'));
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
    setPlacesRepository(sqlPlacesRepository);
    setSmsSender(silentSender);
    app = await buildApp();
    await app.ready();
    admin = await signIn('/admin', MAIN_ADMIN_PHONE);

    const worldInput: WorldInput = {
      slug: `places-${Date.now() % 100_000}`,
      name: 'دنیای مکان‌ها',
      summary: 'برای آزمون',
      tagline: '',
      description: '',
      coverId: null,
      theme: 'neutral',
      navigation: WORLD_DEFAULT_NAVIGATION.map((item) => ({ ...item })),
    };
    world = await ok(await call('POST', '/admin/worlds', admin, worldInput), 201);
    await ok(await call('POST', `/admin/worlds/${world.id}/status`, admin, { action: 'publish' }));
    image = (await ok<{ id: string }>(await call('POST', '/admin/media', admin, { name: 'نقشه', category: 'place', data: PNG }), 201)).id;

    for (const title of ['تسک اتاق', 'تسک سالن']) {
      const activity: ActivityInput = {
        type: 'survey',
        title,
        summary: '',
        instructions: '',
        definition: {
          steps: [{ id: 's1', title: '', description: '', questions: [{ id: 'q1', kind: 'text', title: 'جواب؟', required: true, multiline: false }] }],
          estimatedMinutes: 1,
          maxSubmissions: 2,
          anonymous: false,
          review: 'auto',
          assessment: null,
          journey: null,
          xp: { enabled: true, amount: 30, showBeforeStart: true, maxAwards: 1, requirePass: false },
        },
        audience: { kind: 'all' },
        startsAt: null,
        endsAt: null,
        worldIds: [world.id],
      };
      const created = await ok<{ id: string }>(await call('POST', '/admin/engagement/activities', admin, activity), 201);
      await ok(await call('POST', `/admin/engagement/activities/${created.id}/status`, admin, { action: 'publish' }));
      tasks.push(created.id);
    }
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('takes an image up to 512 KB, and keeps a motion at 250 KB', async () => {
    // A PNG padded past 250 KB: still an image, still taken.
    const big = Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(400 * 1024)]);
    expect((await call('POST', '/admin/media', admin, { name: 'بزرگ', category: 'place', data: big.toString('base64') })).statusCode).toBe(201);
    const huge = Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(600 * 1024)]);
    expect((await call('POST', '/admin/media', admin, { name: 'خیلی بزرگ', category: 'place', data: huge.toString('base64') })).statusCode).toBe(400);
  });

  it('builds one map, a house on it and rooms in the house — and no layer under those', async () => {
    const create = (parentId: string | null, name: string) => call('POST', '/admin/places', admin, { worldId: world.id, parentId, name });
    map = await ok(await create(null, 'نقشه‌ی شهر'), 201);
    expect(code(await create(null, 'نقشه‌ی دوم'))).toBe('PLACE_MAP_EXISTS');
    house = await ok(await create(map.id, 'خانه'), 201);
    room = await ok(await create(house.id, 'اتاق'), 201);
    hall = await ok(await create(house.id, 'سالن'), 201);
    expect([map.depth, house.depth, room.depth]).toEqual([0, 1, 2]);
    expect(room.pin).toEqual({ x: 50, y: 50 });

    const deeper = await create(room.id, 'کمد');
    expect(deeper.statusCode).toBe(400);
    expect(code(deeper)).toBe('PLACE_TOO_DEEP');

    // The panel's list is the maps; what is inside each is on its own page.
    const maps = await ok<AdminPlaceSummary[]>(await call('GET', '/admin/places', admin));
    expect(maps.find((place) => place.worldId === world.id)).toMatchObject({ id: map.id, childCount: 1 });
    expect(maps.every((place) => place.parentId === null)).toBe(true);
    expect((await ok<AdminPlaceDetail>(await call('GET', `/admin/places/${house.id}`, admin))).children.map((child) => child.name)).toEqual(['اتاق', 'سالن']);
  });

  it('pins the house on the map and the rooms in the house, with a task in each room', async () => {
    map = await ok(await call('PUT', `/admin/places/${map.id}`, admin, inputOf(await ok(await call('GET', `/admin/places/${map.id}`, admin)), { imageId: image, pins: [{ id: house.id, x: 30, y: 40 }] })));
    expect(map.children[0].pin).toEqual({ x: 30, y: 40 });

    house = await ok(await call('GET', `/admin/places/${house.id}`, admin));
    house = await ok(await call('PUT', `/admin/places/${house.id}`, admin, inputOf(house, { imageId: image, pins: [{ id: room.id, x: 10, y: 20 }, { id: hall.id, x: 70, y: 60 }] })));
    room = await ok(await call('PUT', `/admin/places/${room.id}`, admin, inputOf(room, { imageId: image, activityIds: [tasks[0]] })));
    hall = await ok(await call('PUT', `/admin/places/${hall.id}`, admin, inputOf(hall, { imageId: image, activityIds: [tasks[1]] })));

    // Another place's child is not moved from here.
    const stray = await ok<AdminPlaceDetail>(await call('PUT', `/admin/places/${map.id}`, admin, inputOf(map, { pins: [{ id: room.id, x: 99, y: 99 }] })));
    expect(stray.children.map((child) => child.id)).toEqual([house.id]);
    expect((await ok<AdminPlaceDetail>(await call('GET', `/admin/places/${room.id}`, admin))).pin).toEqual({ x: 10, y: 20 });

    // An image is required to publish; a place with places inside is not deleted.
    const bare = await ok<AdminPlaceDetail>(await call('POST', '/admin/places', admin, { worldId: world.id, parentId: map.id, name: 'بی‌تصویر' }), 201);
    expect(code(await call('POST', `/admin/places/${bare.id}/status`, admin, { action: 'publish' }))).toBe('PLACE_INCOMPLETE');
    await ok(await call('DELETE', `/admin/places/${bare.id}`, admin));
    expect(code(await call('DELETE', `/admin/places/${house.id}`, admin))).toBe('PLACE_IN_USE');

    for (const place of [map, house, room]) {
      await ok(await call('POST', `/admin/places/${place.id}/status`, admin, { action: 'publish' }));
    }
    expect(code(await call('DELETE', `/admin/places/${room.id}`, admin))).toBe('PLACE_IN_USE');
  });

  it('shows the map with its pins, the house with its published rooms and their tasks, and pays a task once', async () => {
    const person = await signIn('', nextPhone());
    const shown = await ok<PlaceView>(await call('GET', `/worlds/${world.slug}/places/map`, person));
    expect(shown).toMatchObject({ id: map.id, imageId: image, trail: [{ name: 'نقشه‌ی شهر' }] });
    // The house's pin counts the published tasks inside it: the room's, not the unpublished hall's.
    expect(shown.pins).toEqual([{ id: house.id, name: 'خانه', x: 30, y: 40, taskCount: 1 }]);

    const inside = await ok<PlaceView>(await call('GET', `/worlds/${world.slug}/places/${house.id}`, person));
    expect(inside.trail.map((step) => step.name)).toEqual(['نقشه‌ی شهر', 'خانه']);
    expect(inside.pins.map((pin) => pin.name)).toEqual(['اتاق']);
    expect((await call('GET', `/worlds/${world.slug}/places/${hall.id}`, person)).statusCode).toBe(404);

    const atRoom = await ok<PlaceView>(await call('GET', `/worlds/${world.slug}/places/${room.id}`, person));
    expect(atRoom.trail.map((step) => step.name)).toEqual(['نقشه‌ی شهر', 'خانه', 'اتاق']);
    expect(atRoom.tasks.map((task) => task.id)).toEqual([tasks[0]]);

    const played = await ok<PlayerActivity>(await call('GET', `/me/activities/${tasks[0]}`, person));
    const submit = () => call('POST', `/me/activities/${tasks[0]}/submit`, person, { versionId: played.versionId, answers: { q1: 'بله' } });
    expect(await ok(await submit())).toMatchObject({ xpAwarded: 30, xpTotal: 30 });
    expect(await ok(await submit())).toMatchObject({ xpAwarded: 0, xpTotal: 30 });
    const after = await ok<PlaceView>(await call('GET', `/worlds/${world.slug}/places/${room.id}`, person));
    expect(after.tasks[0]).toMatchObject({ status: 'completed' });

    // An unpublished map is no map at all.
    await ok(await call('POST', `/admin/places/${map.id}/status`, admin, { action: 'unpublish' }));
    expect(await ok(await call('GET', `/worlds/${world.slug}/places/map`, person))).toBeNull();
    expect((await call('GET', `/worlds/${world.slug}/places/${house.id}`, person)).statusCode).toBe(404);
    expect((await call('GET', `/worlds/${world.slug}/places/map`, {})).statusCode).toBe(401);
    expect((await call('GET', '/admin/places', {})).statusCode).toBe(401);
  });
});
