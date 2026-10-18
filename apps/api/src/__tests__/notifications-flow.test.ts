import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { API_PREFIX } from '@hamdastan/config';
import type { CampaignInput, EventInput, NotificationItem } from '@hamdastan/types';

import { buildApp } from '../app';
import { closePool, getPool, runMigrations } from '../data';
import { createLocalMediaStorage, type PushMessage, type PushOutcome, type PushSender, type SmsSender } from '../integrations';
import { setAdminRepository, sqlAdminRepository } from '../modules/admin';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
import { setEngagementRepository, sqlEngagementRepository } from '../modules/engagement';
import { setEventsRepository, sqlEventsRepository } from '../modules/events';
import { setMediaRepository, setMediaStorage, sqlMediaRepository } from '../modules/media';
import { missionsService } from '../modules/missions';
import {
  notificationsService,
  setNotificationsRepository,
  setPushSender,
  sqlNotificationsRepository,
} from '../modules/notifications';
import { progressService, setProgressRepository, sqlProgressRepository } from '../modules/progress';
import { setUsersRepository, sqlUsersRepository } from '../modules/users';
import { setWorldsRepository, sqlWorldsRepository } from '../modules/worlds';

/**
 * Notifications end to end, against a migrated database: a reward notifies
 * once however often it is replayed, a level and a badge are announced the
 * first time; an event's followers hear of a cancellation and a moved time;
 * a campaign reaches its audience — and no one outside it — through the
 * dispatcher, never through the request; a restricted destination is
 * neither sent to outsiders nor opened by them; a push that fails does not
 * lose the in-app notification; and «everyone» is its own permission.
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const MAIN_ADMIN_PHONE = '09059466960';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

type Cookies = Record<string, string>;
const silentSender: SmsSender = { name: 'test', async sendOtp() {} };

/** A push service whose next answers the test decides. */
const pushed: PushMessage[] = [];
let nextOutcome: PushOutcome = { status: 'sent' };
const fakePush: PushSender = {
  name: 'fake',
  publicKey: 'test-public-key',
  async send(_target, message) {
    pushed.push(message);
    return nextOutcome;
  },
};

let app: FastifyInstance;
let admin: Cookies;
let mediaDir: string;
let coverId: string;
let musicId: string;
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

async function newUser() {
  const phone = nextPhone();
  const cookies = await signIn('', phone);
  const { rows } = await getPool().query<{ id: string }>('SELECT id FROM v2_users WHERE phone = $1', [phone]);
  return { phone, cookies, id: rows[0].id };
}

async function adminAs(role: string): Promise<Cookies> {
  const phone = nextPhone();
  const response = await call('POST', '/admin/users', admin, { firstName: 'آزمون', lastName: 'نقش', phone, status: 'active', role });
  expect(response.statusCode, response.body).toBe(201);
  return signIn('/admin', phone);
}

const inbox = async (cookies: Cookies, filter = 'all') =>
  (await call('GET', `/notifications?filter=${filter}`, cookies)).json().data as { items: NotificationItem[]; unread: number; nextCursor: string | null };

const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();

let slugCounter = 0;
const event = (overrides: Partial<EventInput> = {}): EventInput => {
  slugCounter += 1;
  return {
    title: 'شب موسیقی',
    slug: `notify-event-${slugCounter}`,
    summary: 'اجرای زنده',
    description: 'توضیح',
    type: 'physical',
    categoryIds: [musicId],
    coverId,
    coverAlt: 'کاور',
    gallery: [],
    visibility: 'public',
    worldIds: [],
    audience: null,
    startAt: hours(48),
    endAt: hours(50),
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

async function publishedEvent(input: EventInput): Promise<{ id: string; slug: string }> {
  const createdEvent = await call('POST', '/admin/events', admin, input);
  expect(createdEvent.statusCode, createdEvent.body).toBe(201);
  const { id, slug } = createdEvent.json().data;
  expect((await call('POST', `/admin/events/${id}/status`, admin, { action: 'publish' })).statusCode).toBe(200);
  return { id, slug };
}

const campaign = (overrides: Partial<CampaignInput> = {}): CampaignInput => ({
  title: 'اطلاعیه‌ی آزمایشی',
  body: 'متن کوتاه',
  category: 'system',
  imageId: null,
  destination: { kind: 'none' },
  audience: { kind: 'all' },
  push: false,
  ...overrides,
});

async function sentCampaign(input: CampaignInput, as: Cookies = admin): Promise<string> {
  const draft = await call('POST', '/admin/notifications/campaigns', as, input);
  expect(draft.statusCode, draft.body).toBe(201);
  const id = draft.json().data.id;
  const send = await call('POST', `/admin/notifications/campaigns/${id}/send`, as, { scheduledAt: null });
  expect(send.statusCode, send.body).toBe(200);
  await notificationsService.dispatchOnce();
  return id;
}

describe.skipIf(!hasDatabase)('notifications against a migrated database', () => {
  beforeAll(async () => {
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();
    mediaDir = await mkdtemp(path.join(tmpdir(), 'hamdastan-notifications-'));
    setUsersRepository(sqlUsersRepository);
    setAuthRepository(sqlAuthRepository);
    setAdminRepository(sqlAdminRepository);
    setProgressRepository(sqlProgressRepository);
    setEngagementRepository(sqlEngagementRepository);
    setMediaRepository(sqlMediaRepository);
    setMediaStorage(createLocalMediaStorage(mediaDir));
    setEventsRepository(sqlEventsRepository);
    setWorldsRepository(sqlWorldsRepository);
    setNotificationsRepository(sqlNotificationsRepository);
    setSmsSender(silentSender);
    app = await buildApp();
    await app.ready();
    admin = await signIn('/admin', MAIN_ADMIN_PHONE);

    coverId = (await call('POST', '/admin/media', admin, { name: 'کاور', category: 'cover', data: PNG.toString('base64') })).json().data.id;
    const categories = (await call('GET', '/admin/events/categories', admin)).json().data as { id: string; slug: string }[];
    musicId = categories.find((category) => category.slug === 'music')!.id;
  });

  beforeEach(() => {
    setPushSender(null);
    pushed.length = 0;
    nextOutcome = { status: 'sent' };
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
    await rm(mediaDir, { recursive: true, force: true });
  });

  // ─── System notifications ─────────────────────────────────────────────

  it('notifies a reward once, however often the action is repeated, with the level and badge it brought', async () => {
    const user = await newUser();
    await progressService.grant(user.id, { sourceType: 'engagement', sourceId: 'seed', xp: 60 });

    expect(await missionsService.complete(user.id, 'personality_test')).toBe(50);
    // A replay pays nothing and notifies nothing.
    expect(await missionsService.complete(user.id, 'personality_test')).toBe(0);

    const { items, unread } = await inbox(user.cookies);
    expect(items.map((item) => item.type).sort()).toEqual(['badge_earned', 'level_up', 'xp_earned']);
    expect(unread).toBe(3);
    expect(items.find((item) => item.type === 'level_up')!.title).toContain('۲');
    expect((await inbox(user.cookies, 'achievements')).items).toHaveLength(2);
  });

  it('keeps read state, opens to the destination, and dismisses', async () => {
    const user = await newUser();
    // The XP and the badge it completes.
    await missionsService.complete(user.id, 'profile_completed');
    const { items, unread } = await inbox(user.cookies);
    expect(unread).toBe(2);
    const item = items.find((entry) => entry.type === 'xp_earned')!;
    expect(item.read).toBe(false);

    const opened = await call('POST', `/notifications/${item.id}/open`, user.cookies);
    expect(opened.json().data).toEqual({ href: '/profile' });
    expect((await inbox(user.cookies)).unread).toBe(1);
    expect((await inbox(user.cookies, 'unread')).items.map((entry) => entry.type)).toEqual(['badge_earned']);

    // Someone else's notification does not exist for this person.
    const other = await newUser();
    expect((await call('POST', `/notifications/${item.id}/open`, other.cookies)).statusCode).toBe(404);

    expect((await call('DELETE', `/notifications/${item.id}`, user.cookies)).statusCode).toBe(200);
    expect((await inbox(user.cookies)).items.map((entry) => entry.id)).not.toContain(item.id);
  });

  it('marks everything read at once', async () => {
    const user = await newUser();
    await progressService.grant(user.id, { sourceType: 'engagement', sourceId: 'seed', xp: 90 });
    await missionsService.complete(user.id, 'avatar_created');
    expect((await inbox(user.cookies)).unread).toBeGreaterThan(0);
    expect((await call('POST', '/notifications/read', user.cookies, {})).json().data).toEqual({ unread: 0 });
  });

  it("respects a switched-off category, and keeps the old settings switch's choice", async () => {
    const user = await newUser();
    const saved = await call('PUT', '/notifications/preferences', user.cookies, {
      categories: [{ category: 'activity', inApp: false, push: false }],
    });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json().data.categories.find((c: { category: string }) => c.category === 'activity')).toEqual({
      category: 'activity',
      inApp: false,
      push: false,
    });
    await missionsService.complete(user.id, 'avatar_created');
    expect((await inbox(user.cookies, 'activity')).items).toHaveLength(0);
    // Badges are another category, still on.
    expect((await inbox(user.cookies, 'achievements')).items.length).toBeGreaterThan(0);
  });

  it("tells an event's followers it was cancelled or moved — once per change — and no one else", async () => {
    const live = await publishedEvent(event());
    const follower = await newUser();
    const stranger = await newUser();
    await call('PUT', `/events/${live.id}/interest`, follower.cookies, { remindInApp: true });

    const moved = event({ slug: live.slug, startAt: hours(72), endAt: hours(74) });
    expect((await call('PUT', `/admin/events/${live.id}`, admin, moved)).statusCode).toBe(200);
    // The same save again changes nothing and notifies nothing.
    expect((await call('PUT', `/admin/events/${live.id}`, admin, moved)).statusCode).toBe(200);
    expect((await call('POST', `/admin/events/${live.id}/status`, admin, { action: 'cancel' })).statusCode).toBe(200);

    const types = (await inbox(follower.cookies, 'events')).items.map((item) => item.type).sort();
    expect(types).toEqual(['event_cancelled', 'event_changed']);
    expect((await inbox(stranger.cookies)).items).toHaveLength(0);

    const cancelled = (await inbox(follower.cookies)).items.find((item) => item.type === 'event_cancelled')!;
    expect((await call('POST', `/notifications/${cancelled.id}/open`, follower.cookies)).json().data).toEqual({
      href: `/events/${live.slug}`,
    });
  });

  it("reminds interested people the day before, once, and tells a buyer the partner's answer", async () => {
    const soon = await publishedEvent(
      event({
        startAt: hours(10),
        endAt: hours(12),
        bookingMode: 'external',
        externalBookingUrl: 'https://fidibo.art/event/9',
        tickets: [{ title: 'عادی', description: '', priceToman: 100_000, capacity: null, benefits: [], availability: 'available', externalId: '' }],
      })
    );
    const person = await newUser();
    await call('PUT', `/events/${soon.id}/interest`, person.cookies, { remindInApp: true });
    const detail = (await call('GET', `/events/${soon.slug}`, person.cookies)).json().data;
    const handoff = await call('POST', `/events/${soon.id}/booking-handoff`, person.cookies, { ticketOptionId: detail.tickets[0].id, quantity: 1 });

    await notificationsService.dispatchOnce();
    await notificationsService.dispatchOnce();
    await call('POST', `/admin/events/bookings/${handoff.json().data.booking.id}`, admin, { status: 'confirmed', externalRef: 'F-1' });

    const types = (await inbox(person.cookies)).items.map((item) => item.type).sort();
    expect(types).toEqual(['booking_confirmed', 'event_reminder']);
  });

  // ─── Campaigns ────────────────────────────────────────────────────────

  it('sends a campaign through the dispatcher, to its audience only, and reports it truthfully', async () => {
    const chosen = await newUser();
    const other = await newUser();
    const draft = await call('POST', '/admin/notifications/campaigns', admin, campaign({ audience: { kind: 'users', phones: [chosen.phone] } }));
    const id = draft.json().data.id;

    const estimate = await call('POST', '/admin/notifications/audience', admin, {
      audience: { kind: 'users', phones: [chosen.phone] },
      category: 'system',
      destination: { kind: 'none' },
    });
    expect(estimate.json().data).toEqual({ eligible: 1, push: 0 });

    const send = await call('POST', `/admin/notifications/campaigns/${id}/send`, admin, { scheduledAt: null });
    expect(send.json().data.status).toBe('scheduled');
    // Nothing is created by the request itself.
    expect((await inbox(chosen.cookies)).items).toHaveLength(0);
    // A second click only re-times it; the dispatcher still sends it once.
    expect((await call('POST', `/admin/notifications/campaigns/${id}/send`, admin, { scheduledAt: null })).statusCode).toBe(200);

    await notificationsService.dispatchOnce();
    await notificationsService.dispatchOnce();
    expect((await inbox(chosen.cookies)).items.map((item) => item.title)).toEqual(['اطلاعیه‌ی آزمایشی']);
    expect((await inbox(other.cookies)).items).toHaveLength(0);

    const done = (await call('GET', `/admin/notifications/campaigns/${id}`, admin)).json().data;
    expect(done).toMatchObject({ status: 'sent', recipientCount: 1 });
    expect((await call('GET', `/admin/notifications/campaigns/${id}/report`, admin)).json().data).toEqual({
      recipients: 1,
      read: 0,
      opened: 0,
      dismissed: 0,
      push: { queued: 0, sent: 0, failed: 0, cancelled: 0 },
    });
    // What was sent is not edited.
    expect((await call('PUT', `/admin/notifications/campaigns/${id}`, admin, campaign())).statusCode).toBe(409);
  });

  it('holds a scheduled campaign until its time, and a cancelled one for good', async () => {
    const user = await newUser();
    const draft = await call('POST', '/admin/notifications/campaigns', admin, campaign({ audience: { kind: 'users', phones: [user.phone] } }));
    const id = draft.json().data.id;
    const scheduled = await call('POST', `/admin/notifications/campaigns/${id}/send`, admin, { scheduledAt: hours(2) });
    expect(scheduled.json().data.status).toBe('scheduled');

    await notificationsService.dispatchOnce();
    expect((await inbox(user.cookies)).items).toHaveLength(0);

    expect((await call('POST', `/admin/notifications/campaigns/${id}/cancel`, admin)).json().data.status).toBe('cancelled');
    await notificationsService.dispatchOnce(new Date(Date.now() + 3 * 3_600_000));
    expect((await inbox(user.cookies)).items).toHaveLength(0);
  });

  it('sends a restricted event only to its audience, and opens it only for them', async () => {
    const insider = await newUser();
    const outsider = await newUser();
    const restricted = await publishedEvent(event({ visibility: 'restricted', audience: { kind: 'users', phones: [insider.phone] } }));

    await sentCampaign(campaign({ category: 'events', destination: { kind: 'event', eventId: restricted.id }, audience: { kind: 'users', phones: [insider.phone, outsider.phone] } }));

    expect((await inbox(outsider.cookies)).items).toHaveLength(0);
    const [item] = (await inbox(insider.cookies)).items;
    expect((await call('POST', `/notifications/${item.id}/open`, insider.cookies)).json().data).toEqual({ href: `/events/${restricted.slug}` });

    // Taken out of the audience later: the notification no longer opens it.
    await getPool().query(`UPDATE v2_events SET audience = '{"kind":"users","phones":["09120000000"]}' WHERE id = $1`, [restricted.id]);
    expect((await call('POST', `/notifications/${item.id}/open`, insider.cookies)).json().data).toEqual({ href: null });
  });

  it('reaches the people interested in an event, or only those confirmed', async () => {
    const live = await publishedEvent(event());
    const fan = await newUser();
    await call('PUT', `/events/${live.id}/interest`, fan.cookies, { remindInApp: false });
    await sentCampaign(campaign({ audience: { kind: 'event', eventId: live.id, relation: 'confirmed' } }));
    expect((await inbox(fan.cookies)).items).toHaveLength(0);
    await sentCampaign(campaign({ audience: { kind: 'event', eventId: live.id, relation: 'interested' } }));
    expect((await inbox(fan.cookies)).items).toHaveLength(1);
  });

  it('refuses push without a push service, and keeps the in-app notification when a push fails', async () => {
    const user = await newUser();
    const draft = await call('POST', '/admin/notifications/campaigns', admin, campaign({ push: true, audience: { kind: 'users', phones: [user.phone] } }));
    const refused = await call('POST', `/admin/notifications/campaigns/${draft.json().data.id}/send`, admin, { scheduledAt: null });
    expect(refused.json().error.code).toBe('PUSH_UNAVAILABLE');

    setPushSender(fakePush);
    expect((await call('GET', '/notifications/preferences', user.cookies)).json().data.push).toEqual({ available: true, publicKey: 'test-public-key' });
    const subscribed = await call('POST', '/notifications/push/subscriptions', user.cookies, {
      endpoint: `https://push.example.com/${user.id}`,
      keys: { p256dh: 'key', auth: 'auth' },
    });
    expect(subscribed.statusCode, subscribed.body).toBe(201);

    // The push service says the subscription is gone.
    nextOutcome = { status: 'gone', error: 'HTTP 410' };
    const id = await sentCampaign(campaign({ push: true, audience: { kind: 'users', phones: [user.phone] } }));

    expect(pushed).toHaveLength(1);
    expect(pushed[0].url).toMatch(/^\/notifications\/[0-9a-f-]{36}$/);
    expect((await inbox(user.cookies)).items).toHaveLength(1);
    expect((await call('GET', `/admin/notifications/campaigns/${id}/report`, admin)).json().data.push).toEqual({
      queued: 0,
      sent: 0,
      failed: 1,
      cancelled: 0,
    });
    const { rows } = await getPool().query('SELECT 1 FROM v2_push_subscriptions WHERE user_id = $1', [user.id]);
    expect(rows).toHaveLength(0);
  });

  it('retries a transient push failure later instead of giving up', async () => {
    setPushSender(fakePush);
    const user = await newUser();
    await call('POST', '/notifications/push/subscriptions', user.cookies, {
      endpoint: `https://push.example.com/retry-${user.id}`,
      keys: { p256dh: 'key', auth: 'auth' },
    });
    nextOutcome = { status: 'retry', error: 'HTTP 503' };
    const id = await sentCampaign(campaign({ push: true, audience: { kind: 'users', phones: [user.phone] } }));
    expect((await call('GET', `/admin/notifications/campaigns/${id}/report`, admin)).json().data.push.queued).toBe(1);

    nextOutcome = { status: 'sent' };
    await notificationsService.dispatchOnce(new Date(Date.now() + 2 * 60_000));
    expect((await call('GET', `/admin/notifications/campaigns/${id}/report`, admin)).json().data.push).toMatchObject({ queued: 0, sent: 1 });
  });

  it('keeps «everyone» to the roles that may broadcast, and every route to its permission', async () => {
    const content = await adminAs('content_manager');
    const draft = await call('POST', '/admin/notifications/campaigns', content, campaign());
    expect(draft.statusCode).toBe(201);
    const refused = await call('POST', `/admin/notifications/campaigns/${draft.json().data.id}/send`, content, { scheduledAt: null });
    expect(refused.statusCode).toBe(403);

    const manager = await adminAs('notification_manager');
    expect((await call('POST', `/admin/notifications/campaigns/${draft.json().data.id}/send`, manager, { scheduledAt: null })).statusCode).toBe(200);

    const reviewer = await adminAs('mission_reviewer');
    expect((await call('GET', '/admin/notifications/campaigns', reviewer)).statusCode).toBe(403);
    expect((await call('POST', '/admin/notifications/campaigns', reviewer, campaign())).statusCode).toBe(403);
    const { cookies } = await newUser();
    expect((await call('GET', '/admin/notifications/campaigns', cookies)).statusCode).toBe(401);
    expect((await call('GET', '/notifications', {})).statusCode).toBe(401);
  });
});
