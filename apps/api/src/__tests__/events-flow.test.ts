import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX } from '@hamdastan/config';
import type { EventInput } from '@hamdastan/types';
import { eventPublishProblems } from '@hamdastan/validation';

import { buildApp } from '../app';
import { closePool, getPool, runMigrations } from '../data';
import { createLocalMediaStorage, type SmsSender } from '../integrations';
import { setAdminRepository, sqlAdminRepository } from '../modules/admin';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
import { setEngagementRepository, sqlEngagementRepository } from '../modules/engagement';
import { setEventsRepository, sqlEventsRepository } from '../modules/events';
import { setMediaRepository, setMediaStorage, sqlMediaRepository } from '../modules/media';
import { setProgressRepository, sqlProgressRepository } from '../modules/progress';
import { setUsersRepository, sqlUsersRepository } from '../modules/users';
import { setWorldsRepository, sqlWorldsRepository } from '../modules/worlds';

/**
 * Events end to end, against a migrated database: who sees an event is
 * decided in SQL — a world-only event stays out of global discovery, a
 * restricted one is a 404 to anyone outside its audience, a scheduled one
 * is invisible until its time — publishing refuses an incomplete event, the
 * calendar marks every day a multi-day event covers, a registration respects
 * the room left, a handoff to the partner is never more than «pending», and
 * every admin route asks for its permission.
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
let mediaDir: string;
let coverId: string;
let musicId: string;
let hogwartsId: string;
let gtaId: string;
let phoneCounter = 0;

const nextPhone = () => {
  phoneCounter += 1;
  return `0998${String(Date.now() % 100_000).padStart(5, '0')}${String(phoneCounter).padStart(2, '0')}`;
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

const newUser = async () => {
  const phone = nextPhone();
  return { phone, cookies: await signIn('', phone) };
};

const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();

let slugCounter = 0;

/** A complete physical event, public, starting tomorrow. */
const complete = (overrides: Partial<EventInput> = {}): EventInput => {
  slugCounter += 1;
  return {
    title: 'شب موسیقی هاگوارتز',
    slug: `test-event-${slugCounter}`,
    summary: 'اجرای زنده',
    description: 'یک **شب** به یاد ماندنی.',
    type: 'physical',
    categoryIds: [musicId],
    coverId,
    coverAlt: 'کاور',
    gallery: [],
    visibility: 'public',
    worldIds: [],
    audience: null,
    startAt: hours(24),
    endAt: hours(27),
    timeZone: 'Asia/Tehran',
    registrationDeadline: null,
    venueName: 'تالار وحدت',
    city: 'تهران',
    address: 'خیابان حافظ',
    latitude: null,
    longitude: null,
    onlineUrl: null,
    onlineInstructions: '',
    organizerName: 'هم‌داستان',
    organizerLogoId: null,
    organizerContact: '',
    bookingMode: 'none',
    externalBookingUrl: null,
    partnerRef: '',
    capacity: null,
    tickets: [],
    ...overrides,
  };
};

async function created(input: EventInput): Promise<{ id: string; slug: string }> {
  const response = await call('POST', '/admin/events', admin, input);
  expect(response.statusCode, response.body).toBe(201);
  return response.json().data;
}

async function published(input: EventInput, publishAt?: string): Promise<{ id: string; slug: string }> {
  const event = await created(input);
  const response = await call('POST', `/admin/events/${event.id}/status`, admin, { action: 'publish', publishAt });
  expect(response.statusCode, response.body).toBe(200);
  return event;
}

const slugsIn = async (cookies: Cookies, url: string) =>
  ((await call('GET', url, cookies)).json().data.items as { slug: string }[]).map((item) => item.slug);

describe('eventPublishProblems', () => {
  it('lists what a draft still needs, by field', () => {
    const fields = eventPublishProblems({ ...complete(), coverId: null, type: 'hybrid', visibility: 'world', bookingMode: 'external' }).map(
      (problem) => problem.field
    );
    expect(fields).toEqual(['coverId', 'onlineUrl', 'externalBookingUrl', 'worldIds']);
  });
});

describe.skipIf(!hasDatabase)('events against a migrated database', () => {
  beforeAll(async () => {
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();
    mediaDir = await mkdtemp(path.join(tmpdir(), 'hamdastan-events-'));
    setUsersRepository(sqlUsersRepository);
    setAuthRepository(sqlAuthRepository);
    setAdminRepository(sqlAdminRepository);
    setProgressRepository(sqlProgressRepository);
    setEngagementRepository(sqlEngagementRepository);
    setMediaRepository(sqlMediaRepository);
    setMediaStorage(createLocalMediaStorage(mediaDir));
    setEventsRepository(sqlEventsRepository);
    setWorldsRepository(sqlWorldsRepository);
    setSmsSender(silentSender);
    app = await buildApp();
    await app.ready();
    admin = await signIn('/admin', MAIN_ADMIN_PHONE);

    const upload = await call('POST', '/admin/media', admin, { name: 'کاور', category: 'cover', data: PNG.toString('base64') });
    coverId = upload.json().data.id;
    const categories = (await call('GET', '/admin/events/categories', admin)).json().data as { id: string; slug: string }[];
    musicId = categories.find((category) => category.slug === 'music')!.id;
    const worlds = (await call('GET', '/admin/worlds', admin)).json().data as { id: string; slug: string }[];
    hogwartsId = worlds.find((world) => world.slug === 'hogwarts')!.id;
    gtaId = worlds.find((world) => world.slug === 'gta')!.id;
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('seeds the twelve categories and the four worlds', async () => {
    expect((await call('GET', '/admin/events/categories', admin)).json().data).toHaveLength(12);
    const { cookies } = await newUser();
    expect(((await call('GET', '/worlds', cookies)).json().data as { slug: string }[]).map((w) => w.slug)).toEqual([
      'hogwarts',
      'gta',
      'game-of-thrones',
      'liverpool',
    ]);
  });

  it('saves an incomplete draft but refuses to publish it, saying what is missing', async () => {
    const draft = await created({ ...complete(), coverId: null, description: '' });
    const response = await call('POST', `/admin/events/${draft.id}/status`, admin, { action: 'publish' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('EVENT_INCOMPLETE');
    expect(Object.keys(response.json().error.details.fields)).toEqual(['coverId', 'description']);
  });

  it('refuses an end before the start', async () => {
    const response = await call('POST', '/admin/events', admin, complete({ startAt: hours(5), endAt: hours(4) }));
    expect(response.statusCode).toBe(400);
  });

  it('keeps a draft out of the product, and shows a public event everywhere it belongs', async () => {
    const { cookies } = await newUser();
    const draft = await created(complete());
    const live = await published(complete({ worldIds: [hogwartsId] }));

    expect((await call('GET', `/events/${draft.slug}`, cookies)).statusCode).toBe(404);
    const global = await slugsIn(cookies, '/events');
    expect(global).toContain(live.slug);
    expect(global).not.toContain(draft.slug);
    expect(await slugsIn(cookies, '/events?world=hogwarts')).toContain(live.slug);
    expect(await slugsIn(cookies, '/events?world=gta')).not.toContain(live.slug);
  });

  it('keeps a world-only event out of global discovery and search, but in its worlds', async () => {
    const { cookies } = await newUser();
    const scoped = await published(complete({ title: 'فقط دنیایی منحصربه‌فرد', visibility: 'world', worldIds: [hogwartsId, gtaId] }));

    expect(await slugsIn(cookies, '/events')).not.toContain(scoped.slug);
    expect(await slugsIn(cookies, `/events?q=${encodeURIComponent('منحصربه‌فرد')}`)).not.toContain(scoped.slug);
    expect(await slugsIn(cookies, '/events?world=hogwarts')).toContain(scoped.slug);
    expect(await slugsIn(cookies, '/events?world=gta')).toContain(scoped.slug);
    // A deep link opens it: world-only is not members-only.
    expect((await call('GET', `/events/${scoped.slug}`, cookies)).statusCode).toBe(200);
  });

  it('changes scope without recreating the event', async () => {
    const { cookies } = await newUser();
    const input = complete({ visibility: 'world', worldIds: [hogwartsId] });
    const event = await published(input);
    expect(await slugsIn(cookies, '/events')).not.toContain(event.slug);

    const updated = await call('PUT', `/admin/events/${event.id}`, admin, { ...input, visibility: 'public' });
    expect(updated.statusCode, updated.body).toBe(200);
    expect(await slugsIn(cookies, '/events')).toContain(event.slug);
  });

  it('shows a restricted event only to its audience — a 404 to anyone else, from every read', async () => {
    const insider = await newUser();
    const outsider = await newUser();
    const restricted = await published(
      complete({ visibility: 'restricted', audience: { kind: 'users', phones: [insider.phone] }, worldIds: [hogwartsId] })
    );

    expect(await slugsIn(insider.cookies, '/events')).toContain(restricted.slug);
    expect((await call('GET', `/events/${restricted.slug}`, insider.cookies)).statusCode).toBe(200);

    expect(await slugsIn(outsider.cookies, '/events')).not.toContain(restricted.slug);
    expect(await slugsIn(outsider.cookies, '/events?world=hogwarts')).not.toContain(restricted.slug);
    expect((await call('GET', `/events/${restricted.slug}`, outsider.cookies)).statusCode).toBe(404);
    expect((await call('GET', `/events/${restricted.slug}/related`, outsider.cookies)).statusCode).toBe(404);
    expect((await call('PUT', `/events/${restricted.id}/interest`, outsider.cookies, { remindInApp: true })).statusCode).toBe(404);
  });

  it('hides a scheduled event until its time, and can take publication back', async () => {
    const { cookies } = await newUser();
    const scheduled = await published(complete(), hours(48));
    expect((await call('GET', `/admin/events/${scheduled.id}`, admin)).json().data.status).toBe('scheduled');
    expect((await call('GET', `/events/${scheduled.slug}`, cookies)).statusCode).toBe(404);

    const live = await published(complete());
    expect((await call('POST', `/admin/events/${live.id}/status`, admin, { action: 'unpublish' })).statusCode).toBe(200);
    expect((await call('GET', `/events/${live.slug}`, cookies)).statusCode).toBe(404);
  });

  it('keeps a cancelled event visible as cancelled, with no way to book', async () => {
    const { cookies } = await newUser();
    const event = await published(complete({ bookingMode: 'free_registration' }));
    expect((await call('POST', `/admin/events/${event.id}/status`, admin, { action: 'cancel' })).statusCode).toBe(200);
    const detail = (await call('GET', `/events/${event.slug}`, cookies)).json().data;
    expect(detail.phase).toBe('cancelled');
    expect(detail.cta).toEqual({ kind: 'cancelled' });
    const register = await call('POST', `/events/${event.id}/registrations`, cookies, { ticketOptionId: null, quantity: 1 });
    expect(register.statusCode).toBe(409);

    // Discovery keeps it, labelled; related events and «still open» leave it out.
    const other = await published(complete());
    const related = (await call('GET', `/events/${other.slug}/related`, cookies)).json().data as { slug: string }[];
    expect(related.map((item) => item.slug)).not.toContain(event.slug);
    expect(await slugsIn(cookies, '/events?available=true')).not.toContain(event.slug);
  });

  it('marks every day a multi-day event covers, and filters a day to what overlaps it', async () => {
    const { cookies } = await newUser();
    // 2030-03-10 10:00 → 2030-03-12 10:00 Tehran (+03:30).
    const event = await published(
      complete({ title: 'جشنواره سه‌روزه', startAt: '2030-03-10T10:00:00+03:30', endAt: '2030-03-12T10:00:00+03:30' })
    );
    const days = (await call('GET', '/events/calendar?from=2030-03-09&to=2030-03-13', cookies)).json().data as { date: string }[];
    expect(days.map((day) => day.date)).toEqual(['2030-03-10', '2030-03-11', '2030-03-12']);
    expect(await slugsIn(cookies, '/events?from=2030-03-11&to=2030-03-11')).toContain(event.slug);
    expect(await slugsIn(cookies, '/events?from=2030-03-13&to=2030-03-13')).not.toContain(event.slug);
  });

  it('registers within the room left, once per person', async () => {
    const event = await published(complete({ bookingMode: 'free_registration', capacity: 2 }));
    const first = await newUser();
    const second = await newUser();

    const booked = await call('POST', `/events/${event.id}/registrations`, first.cookies, { ticketOptionId: null, quantity: 1 });
    expect(booked.statusCode, booked.body).toBe(201);
    expect(booked.json().data.status).toBe('confirmed');
    const again = await call('POST', `/events/${event.id}/registrations`, first.cookies, { ticketOptionId: null, quantity: 1 });
    expect(again.json().data.id).toBe(booked.json().data.id);

    const tooMany = await call('POST', `/events/${event.id}/registrations`, second.cookies, { ticketOptionId: null, quantity: 2 });
    expect(tooMany.statusCode).toBe(409);
    expect(tooMany.json().error.code).toBe('EVENT_SOLD_OUT');

    const mine = (await call('GET', '/me/events?tab=booked', first.cookies)).json().data as { slug: string; bookingStatus: string }[];
    expect(mine.find((item) => item.slug === event.slug)?.bookingStatus).toBe('confirmed');
    expect((await call('GET', `/events/${event.slug}`, first.cookies)).json().data.cta).toEqual({ kind: 'registered' });
  });

  it('records a handoff to the partner as pending, and only an admin confirms it', async () => {
    const event = await published(
      complete({
        bookingMode: 'external',
        externalBookingUrl: 'https://fidibo.art/event/123',
        tickets: [
          { title: 'عادی', description: '', priceToman: 150_000, capacity: null, benefits: [], availability: 'available', externalId: '' },
        ],
      })
    );
    const { cookies } = await newUser();
    const detail = (await call('GET', `/events/${event.slug}`, cookies)).json().data;
    expect(detail.cta).toEqual({ kind: 'external', free: false });
    expect(detail.startingPriceToman).toBe(150_000);

    const handoff = await call('POST', `/events/${event.id}/booking-handoff`, cookies, { ticketOptionId: detail.tickets[0].id, quantity: 2 });
    expect(handoff.statusCode, handoff.body).toBe(200);
    expect(handoff.json().data).toMatchObject({ url: 'https://fidibo.art/event/123', booking: { status: 'pending', totalToman: 300_000 } });

    // Coming back proves nothing.
    expect((await call('GET', `/events/${event.slug}`, cookies)).json().data.booking.status).toBe('pending');

    const bookingId = handoff.json().data.booking.id;
    const reviewed = await call('POST', `/admin/events/bookings/${bookingId}`, admin, { status: 'confirmed', externalRef: 'FID-9' });
    expect(reviewed.statusCode, reviewed.body).toBe(200);
    expect((await call('GET', `/events/${event.slug}`, cookies)).json().data.booking.status).toBe('confirmed');
  });

  it('keeps interest apart from booking', async () => {
    const event = await published(complete());
    const { cookies } = await newUser();
    expect((await call('PUT', `/events/${event.id}/interest`, cookies, { remindInApp: true })).statusCode).toBe(200);
    const interested = (await call('GET', '/me/events?tab=interested', cookies)).json().data as { slug: string; bookingStatus: null }[];
    expect(interested.find((item) => item.slug === event.slug)).toMatchObject({ interested: true, bookingStatus: null });
    expect((await call('GET', '/me/events?tab=booked', cookies)).json().data).toEqual([]);
    expect(await slugsIn(cookies, '/events?interested=true')).toEqual([event.slug]);
  });

  it('refuses to delete a category or a world that events use', async () => {
    const categoryResponse = await call('DELETE', `/admin/events/categories/${musicId}`, admin);
    expect(categoryResponse.statusCode).toBe(409);
    expect((await call('DELETE', `/admin/worlds/${hogwartsId}`, admin)).statusCode).toBe(409);

    const fresh = await call('POST', '/admin/events/categories', admin, {
      slug: 'temp-category',
      name: 'موقت',
      description: '',
      icon: 'ticket',
      imageId: coverId,
      isActive: true,
    });
    expect(fresh.statusCode, fresh.body).toBe(201);
    expect((await call('DELETE', `/admin/events/categories/${fresh.json().data.id}`, admin)).statusCode).toBe(200);
  });

  it('keeps a file an event uses from being deleted from the library', async () => {
    const response = await call('DELETE', `/admin/media/${coverId}`, admin);
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MEDIA_IN_USE');
  });

  it('asks every admin route for its permission', async () => {
    const phone = nextPhone();
    const createdAdmin = await call('POST', '/admin/users', admin, {
      firstName: 'بازبین',
      lastName: 'آزمایشی',
      phone,
      status: 'active',
      role: 'mission_reviewer',
    });
    expect(createdAdmin.statusCode, createdAdmin.body).toBe(201);
    const reviewer = await signIn('/admin', phone);

    expect((await call('GET', '/admin/events', reviewer)).statusCode).toBe(403);
    expect((await call('POST', '/admin/events', reviewer, complete())).statusCode).toBe(403);
    expect((await call('POST', '/admin/worlds', reviewer, { slug: 'x', name: 'x', summary: '', coverId: null, isActive: true })).statusCode).toBe(403);
    expect((await call('GET', '/admin/events', {})).statusCode).toBe(401);
    const { cookies } = await newUser();
    expect((await call('GET', '/admin/events', cookies)).statusCode).toBe(401);
  });
});
