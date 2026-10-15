import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX, MEDIA_LIMITS } from '@hamdastan/config';
import type { ActivityInput } from '@hamdastan/types';
import { activityInputSchema } from '@hamdastan/validation';

import { buildApp } from '../app';
import { closePool, getPool, runMigrations } from '../data';
import { createLocalMediaStorage, type SmsSender } from '../integrations';
import { setAdminRepository, sqlAdminRepository } from '../modules/admin';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
import { setEngagementRepository, sqlEngagementRepository } from '../modules/engagement';
import { setMediaRepository, setMediaStorage, sniffMedia, sqlMediaRepository } from '../modules/media';
import { setProgressRepository, sqlProgressRepository } from '../modules/progress';
import { setUsersRepository, sqlUsersRepository } from '../modules/users';

/**
 * The media & motion library end to end: a file is kept only when its bytes
 * are one of the six formats and it is within 250 KB; it is served with the
 * headers that keep it a file; a replacement keeps its id; an activity can
 * only name files that exist, in places that fit them; and a file in use
 * cannot be deleted. The sniffing runs without a database.
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const MAIN_ADMIN_PHONE = '09059466960';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(8)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(12)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('\x9fB\x86\x81\x01B\x82\x84webm', 'latin1')]);
const LOTTIE = Buffer.from(JSON.stringify({ v: '5.7.4', fr: 30, ip: 0, op: 30, w: 100, h: 100, layers: [] }));

describe('sniffMedia', () => {
  it('knows the six formats by their bytes', () => {
    expect([PNG, JPEG, WEBP, MP4, WEBM, LOTTIE].map(sniffMedia)).toEqual(['png', 'jpeg', 'webp', 'mp4', 'webm', 'lottie']);
  });

  it('refuses everything else, whatever it is called', () => {
    const others = [
      Buffer.from('GIF89a\x01\x00\x01\x00', 'latin1'),
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      Buffer.from('<!doctype html><script>alert(1)</script>'),
      Buffer.from(JSON.stringify({ hello: 'world' })),
      Buffer.from('{ not json'),
    ];
    expect(others.map(sniffMedia)).toEqual([null, null, null, null, null]);
  });
});

type Cookies = Record<string, string>;
const silentSender: SmsSender = { name: 'test', async sendOtp() {} };

let app: FastifyInstance;
let admin: Cookies;
let mediaDir: string;

const cookiesFrom = (response: LightMyRequestResponse): Cookies =>
  Object.fromEntries(response.cookies.map(({ name, value }) => [name, value]));

const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, cookies: Cookies, body?: unknown) =>
  app.inject({ method, url: `${API_PREFIX}${url}`, payload: body as object, cookies });

async function signIn(prefix: '' | '/admin', phone: string): Promise<Cookies> {
  const requested = await call('POST', `${prefix}/auth/otp/request`, {}, { phone });
  const verified = await call('POST', `${prefix}/auth/otp/verify`, {}, { phone, code: requested.json().data.debugCode });
  expect(verified.statusCode, verified.body).toBe(200);
  return cookiesFrom(verified);
}

const upload = (bytes: Buffer, name = 'فایل', category = 'question') =>
  call('POST', '/admin/media', admin, { name, category, data: bytes.toString('base64') });

async function uploaded(bytes: Buffer, category = 'question'): Promise<string> {
  const response = await upload(bytes, 'فایل', category);
  expect(response.statusCode, response.body).toBe(201);
  return response.json().data.id as string;
}

/** A published survey whose one question shows `imageId`. */
const survey = (imageId?: string): ActivityInput => ({
  type: 'survey',
  title: 'با تصویر',
  summary: '',
  instructions: '',
  definition: {
    steps: [
      {
        id: 's1',
        title: '',
        description: '',
        questions: [{ id: 'q1', kind: 'text', title: 'این چیه؟', required: true, multiline: false, ...(imageId ? { imageId } : {}) }],
      },
    ],
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
});

describe.skipIf(!hasDatabase)('the media library against a migrated database', () => {
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

  it('keeps the library behind the admin session, and serves the files to anyone', async () => {
    const id = await uploaded(PNG);
    expect((await call('GET', '/admin/media', {})).statusCode).toBe(401);
    expect((await call('POST', '/admin/media', {}, { name: 'x', category: 'other', data: PNG.toString('base64') })).statusCode).toBe(401);
    expect((await call('GET', `/media/${id}`, {})).statusCode).toBe(200);
  });

  it('stores a file and serves exactly its bytes, as a file and nothing else', async () => {
    const created = await upload(PNG, 'مسکات خندان', 'mascot');
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json().data).toMatchObject({ kind: 'image', format: 'png', category: 'mascot', name: 'مسکات خندان', sizeBytes: PNG.length, version: 1, usage: 0 });

    const id = created.json().data.id;
    const served = await call('GET', `/media/${id}`, {});
    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.headers['content-security-policy']).toContain('sandbox');
    expect(served.rawPayload.equals(PNG)).toBe(true);

    const again = await app.inject({ method: 'GET', url: `${API_PREFIX}/media/${id}`, headers: { 'if-none-match': served.headers.etag as string } });
    expect(again.statusCode).toBe(304);
  });

  it('refuses a file that is not one of the six formats, whatever it is called', async () => {
    for (const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), Buffer.from('GIF89a', 'latin1'), Buffer.from('{"a":1}')]) {
      const response = await upload(bytes);
      expect(response.statusCode).toBe(415);
      expect(response.json().error.code).toBe('MEDIA_UNSUPPORTED');
    }
  });

  it('takes a file of exactly 250 KB and refuses one byte more', async () => {
    const atLimit = Buffer.concat([PNG, Buffer.alloc(MEDIA_LIMITS.MAX_BYTES - PNG.length)]);
    expect((await upload(atLimit)).statusCode).toBe(201);
    const over = await upload(Buffer.concat([atLimit, Buffer.alloc(1)]));
    expect([400, 413]).toContain(over.statusCode);
  });

  it('replaces a file under the same id, and keeps an image an image', async () => {
    const id = await uploaded(PNG);
    const replaced = await call('PUT', `/admin/media/${id}/file`, admin, { data: JPEG.toString('base64') });
    expect(replaced.statusCode, replaced.body).toBe(200);
    expect(replaced.json().data).toMatchObject({ id, format: 'jpeg', version: 2 });
    const served = await call('GET', `/media/${id}`, {});
    expect(served.headers['content-type']).toBe('image/jpeg');
    expect(served.rawPayload.equals(JPEG)).toBe(true);

    const wrongKind = await call('PUT', `/admin/media/${id}/file`, admin, { data: LOTTIE.toString('base64') });
    expect(wrongKind.statusCode).toBe(409);
    expect(wrongKind.json().error.code).toBe('MEDIA_KIND_CHANGED');
  });

  it('serves a Lottie motion’s data for the players', async () => {
    const id = await uploaded(LOTTIE, 'answer_motion');
    const data = await call('GET', `/media/${id}/lottie`, {});
    expect(data.statusCode).toBe(200);
    expect(data.json().data).toMatchObject({ v: '5.7.4', layers: [] });
  });

  it('lets an activity name only files that exist, in places that fit them', async () => {
    const unknown = await call('POST', '/admin/engagement/activities', admin, survey('00000000-0000-4000-8000-000000000000'));
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json().error.details.fields).toHaveProperty(['definition.steps.0.questions.0.imageId']);

    const motion = await uploaded(LOTTIE, 'answer_motion');
    const notAnImage = await call('POST', '/admin/engagement/activities', admin, survey(motion));
    expect(notAnImage.statusCode).toBe(400);
  });

  it('will not delete a file an activity uses, and deletes one nothing uses', async () => {
    const used = await uploaded(PNG);
    const created = await call('POST', '/admin/engagement/activities', admin, survey(used));
    expect(created.statusCode, created.body).toBe(201);
    const activityId = created.json().data.id;
    expect((await call('GET', `/admin/media/${used}`, admin)).json().data.usage).toBe(1);

    const refused = await call('DELETE', `/admin/media/${used}`, admin);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.code).toBe('MEDIA_IN_USE');

    // The player is told what the file is, so it can draw it.
    expect((await call('POST', `/admin/engagement/activities/${activityId}/status`, admin, { action: 'publish' })).statusCode).toBe(200);
    const user = await signIn('', `0997${String(Date.now() % 10_000_000).padStart(7, '0')}`);
    const detail = (await call('GET', `/me/activities/${activityId}`, user)).json().data;
    expect(detail.media[used]).toMatchObject({ id: used, kind: 'image', format: 'png' });

    const unused = await uploaded(PNG);
    expect((await call('DELETE', `/admin/media/${unused}`, admin)).statusCode).toBe(200);
    expect((await call('GET', `/media/${unused}`, {})).statusCode).toBe(404);
  });

  it('lists the library by shelf and kind, with usage', async () => {
    await uploaded(PNG, 'cover');
    const covers = (await call('GET', '/admin/media?category=cover', admin)).json().data;
    expect(covers.items.every((item: { category: string }) => item.category === 'cover')).toBe(true);
    const motions = (await call('GET', '/admin/media?kind=motion', admin)).json().data;
    expect(motions.items.every((item: { kind: string }) => item.kind === 'motion')).toBe(true);
  });
});

describe('where a question’s image goes', () => {
  const question = (imagePosition?: unknown) => ({
    type: 'survey',
    title: 'جای تصویر',
    summary: '',
    instructions: '',
    audience: { kind: 'all' },
    startsAt: null,
    endsAt: null,
    definition: {
      steps: [
        {
          id: 's1',
          title: '',
          description: '',
          questions: [
            {
              id: 'q1',
              kind: 'text',
              title: 'این چیه؟',
              required: true,
              multiline: false,
              imageId: '00000000-0000-4000-8000-000000000000',
              ...(imagePosition === undefined ? {} : { imagePosition }),
            },
          ],
        },
      ],
      estimatedMinutes: 1,
      maxSubmissions: 1,
      anonymous: false,
      review: 'auto',
      assessment: null,
      xp: { enabled: false, amount: 0, showBeforeStart: false, maxAwards: 1, requirePass: false },
    },
  });
  const parse = (value?: unknown) => activityInputSchema.safeParse(question(value));

  it('is above the text unless the admin puts it below', () => {
    const above = parse();
    expect(above.success && above.data.definition.steps[0].questions[0].imagePosition).toBeUndefined();
    const below = parse('below');
    expect(below.success && below.data.definition.steps[0].questions[0].imagePosition).toBe('below');
  });

  it('refuses any other place', () => {
    expect(parse('left').success).toBe(false);
  });
});
