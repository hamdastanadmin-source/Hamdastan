import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX } from '@hamdastan/config';
import type { ActivityInput, ActivityQuestion, JourneySettings } from '@hamdastan/types';
import { journeyDayEndDefaults, journeyResultDefaults, motionOff } from '@hamdastan/validation';

import { buildApp } from '../app';
import { closePool, getPool, runMigrations } from '../data';
import type { SmsSender } from '../integrations';
import { setAdminRepository, sqlAdminRepository } from '../modules/admin';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
import { setEngagementRepository, sqlEngagementRepository } from '../modules/engagement';
import { setMediaRepository, sqlMediaRepository } from '../modules/media';
import { setProgressRepository, sqlProgressRepository } from '../modules/progress';
import { setUsersRepository, sqlUsersRepository } from '../modules/users';

/**
 * The multi-day journey end to end, against a real PostgreSQL built from the
 * migrations: days open on the server's clock, an answer is written and paid
 * once, a finished day is a response, and the last day finishes the journey.
 * Time passing is simulated by moving the stored start back — the API is
 * never told the time by the client. Skips without `TEST_DATABASE_URL`.
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const MAIN_ADMIN_PHONE = '09059466960';

type Cookies = Record<string, string>;

const silentSender: SmsSender = { name: 'test', async sendOtp() {} };

let app: FastifyInstance;
let admin: Cookies;
let phoneCounter = 0;

const nextPhone = () => {
  phoneCounter += 1;
  return `0998${String(Date.now() % 100_000).padStart(5, '0')}${String(phoneCounter).padStart(2, '0')}`;
};

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

const choice = (id: string, required = true): ActivityQuestion => ({
  id,
  kind: 'single',
  title: `سؤال ${id}`,
  required,
  options: [
    { id: 'a', label: 'الف' },
    { id: 'b', label: 'ب' },
  ],
});

const JOURNEY: JourneySettings = {
  unlockMode: 'calendar_day',
  timezone: 'Asia/Tehran',
  missedDays: 'catch_up',
  requirePreviousDay: false,
  allowReview: true,
  questionsPerDay: 2,
  rewards: { perQuestion: 2, perDay: 5 },
  motions: { answer: motionOff(), dayComplete: motionOff(2500), journeyComplete: motionOff(3500) },
  dayEnd: journeyDayEndDefaults(),
  result: journeyResultDefaults(),
};

/** Two days of two questions; the second question of day 2 is optional. */
const journeyInput = (): ActivityInput => ({
  type: 'journey',
  title: 'چالش آزمایشی',
  summary: 'دو روز',
  instructions: '',
  definition: {
    steps: [
      { id: 'day1', title: 'روز اول', description: '', questions: [choice('q1'), choice('q2')] },
      { id: 'day2', title: 'روز دوم', description: '', questions: [choice('q3'), choice('q4', false)] },
    ],
    estimatedMinutes: 3,
    maxSubmissions: 1,
    anonymous: false,
    review: 'auto',
    assessment: null,
    journey: JOURNEY,
    xp: { enabled: true, amount: 20, showBeforeStart: true, maxAwards: 1, requirePass: false },
  },
  audience: { kind: 'all' },
  // The campaign has just begun; its end is derived by the API.
  startsAt: new Date(Date.now() - 5_000).toISOString(),
  endsAt: null,
});

async function publishJourney(): Promise<string> {
  const created = await call('POST', '/admin/engagement/activities', admin, journeyInput());
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json().data.id as string;
  expect((await call('POST', `/admin/engagement/activities/${id}/status`, admin, { action: 'publish' })).statusCode).toBe(200);
  return id;
}

const answer = (cookies: Cookies, id: string, questionId: string, value: unknown) =>
  call('POST', `/me/activities/${id}/answers`, cookies, { questionId, value });

const ledger = async (phone: string) =>
  (
    await getPool().query<{ source_id: string; xp_amount: number }>(
      `SELECT t.source_id, t.xp_amount FROM v2_xp_transactions t JOIN v2_users u ON u.id = t.user_id
        WHERE u.phone = $1 AND t.source_type = 'engagement' ORDER BY t.id`,
      [phone]
    )
  ).rows;

/** A day passes: the campaign started, and ends, a day earlier than it did. */
const aDayPasses = (activityId: string) =>
  getPool().query(
    `UPDATE v2_engagement_activities
        SET starts_at = starts_at - interval '1 day', ends_at = ends_at - interval '1 day'
      WHERE id = $1`,
    [activityId]
  );

describe.skipIf(!hasDatabase)('Journeys against a migrated database', () => {
  beforeAll(async () => {
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();
    setUsersRepository(sqlUsersRepository);
    setAuthRepository(sqlAuthRepository);
    setAdminRepository(sqlAdminRepository);
    setProgressRepository(sqlProgressRepository);
    setEngagementRepository(sqlEngagementRepository);
    setMediaRepository(sqlMediaRepository);
    setSmsSender(silentSender);
    app = await buildApp();
    await app.ready();
    admin = await signIn('/admin', MAIN_ADMIN_PHONE);
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
  });

  it('opens day by day, pays each answer, day and the finish once, and ends the journey', async () => {
    const id = await publishJourney();
    const phone = nextPhone();
    const user = await signIn('', phone);

    // The card offers everything it can pay: 4 answers × 2 + 2 days × 5 + 20.
    const card = (await call('GET', '/me/activities', user)).json().data.find((c: { id: string }) => c.id === id);
    expect(card).toMatchObject({ type: 'journey', xp: 38, canSubmit: true });

    // Day 1 open, day 2 locked — and nothing of it is sent: no step, no title.
    let detail = (await call('GET', `/me/activities/${id}`, user)).json().data;
    expect(detail.endsAt).not.toBeNull();
    expect(detail.journey.days.map((d: { status: string }) => d.status)).toEqual(['available', 'locked']);
    expect(detail.steps.map((step: { id: string }) => step.id)).toEqual(['day1']);
    expect(detail.journey.days[1].title).toBeNull();

    // Day 2 cannot be answered early, however the client asks.
    const early = await answer(user, id, 'q3', 'a');
    expect(early.statusCode).toBe(409);
    expect(early.json().error.code).toBe('JOURNEY_DAY_LOCKED');

    // The whole-activity submit is not how a journey is answered.
    const submit = await call('POST', `/me/activities/${id}/submit`, user, { versionId: detail.versionId, answers: {} });
    expect(submit.json().error.code).toBe('JOURNEY_ANSWER_ONLY');

    // An answer is recorded and paid once; the same answer again is a harmless repeat.
    const first = await answer(user, id, 'q1', 'a');
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json().data).toMatchObject({ status: 'recorded', xpAwarded: { question: 2, day: 0, journey: 0 } });
    expect(first.json().data.journey.days[0].status).toBe('in_progress');

    const repeat = await answer(user, id, 'q1', 'a');
    expect(repeat.json().data).toMatchObject({ status: 'already_answered', xpAwarded: { question: 0, day: 0, journey: 0 } });
    // A different answer to the same question is refused: the first one stands.
    expect((await answer(user, id, 'q1', 'b')).json().error.code).toBe('JOURNEY_ALREADY_ANSWERED');

    // The day's last answer, sent five times at once, finishes it once.
    const burst = await Promise.all(Array.from({ length: 5 }, () => answer(user, id, 'q2', 'b')));
    expect(burst.map((r) => r.statusCode), burst.map((r) => r.body).join("\n")).toEqual([200, 200, 200, 200, 200]);
    const recorded = burst.map((r) => r.json().data).filter((d) => d.status === 'recorded');
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ dayCompleted: true, journeyCompleted: false, xpAwarded: { question: 2, day: 5 } });
    // The day's own XP, read from the ledger: two answers and the finish.
    expect(recorded[0].journey.days[0].xpEarned).toBe(2 + 2 + 5);
    // Tomorrow's day is still shut today, and the API says when it opens.
    expect(recorded[0].journey.days[1].status).toBe('locked');
    expect(recorded[0].journey.nextUnlockAt).not.toBeNull();

    // A finished day is an ordinary response for the dashboard.
    const results = (await call('GET', `/admin/engagement/activities/${id}/results`, admin)).json().data;
    expect(results.responses).toBe(1);

    // A day later, day 2 opens.
    await aDayPasses(id);
    detail = (await call('GET', `/me/activities/${id}`, user)).json().data;
    expect(detail.journey.days.map((d: { status: string }) => d.status)).toEqual(['completed', 'available']);
    expect(detail.steps[1].questions).toHaveLength(2);
    expect(detail.journey.days[1].title).toBe('روز دوم');
    expect(detail.journey.answers).toMatchObject({ q1: 'a', q2: 'b' });

    // A required question cannot be skipped; an optional one can.
    expect((await answer(user, id, 'q3', null)).statusCode).toBe(400);
    expect((await answer(user, id, 'q3', 'a')).statusCode).toBe(200);
    const last = (await answer(user, id, 'q4', null)).json().data;
    expect(last).toMatchObject({ dayCompleted: true, journeyCompleted: true, xpAwarded: { question: 0, day: 5, journey: 20 } });
    expect(last.journey.completedDays).toBe(2);

    // Every reward is in the ledger exactly once: 2 + 2 + 5 + 2 + 5 + 20.
    const rows = await ledger(phone);
    expect(rows.reduce((sum, row) => sum + row.xp_amount, 0)).toBe(36);
    expect(new Set(rows.map((row) => row.source_id)).size).toBe(rows.length);

    // Finished: the card no longer offers it, and nothing more is taken.
    const after = (await call('GET', '/me/activities', user)).json().data.find((c: { id: string }) => c.id === id);
    expect(after).toMatchObject({ status: 'completed', canSubmit: false });
    expect((await answer(user, id, 'q4', 'a')).statusCode).toBe(409);
  });

  it('keeps progress across sessions: a new sign-in resumes where the person stopped', async () => {
    const id = await publishJourney();
    const phone = nextPhone();
    await answer(await signIn('', phone), id, 'q1', 'b');

    const again = await signIn('', phone);
    const detail = (await call('GET', `/me/activities/${id}`, again)).json().data;
    expect(detail.journey.answers).toEqual({ q1: 'b' });
    expect(detail.journey.days[0]).toMatchObject({ status: 'in_progress', answeredCount: 1 });
  });

  it('refuses an answer that does not fit its question', async () => {
    const id = await publishJourney();
    const user = await signIn('', nextPhone());
    expect((await answer(user, id, 'q1', 'zz')).statusCode).toBe(400);
    expect((await answer(user, id, 'nope', 'a')).statusCode).toBe(409);
  });

  it('works out the character once, keeps it through an edit, and never sends the points', async () => {
    const input = journeyInput();
    const settings = input.definition.journey!;
    settings.result = {
      ...journeyResultDefaults(),
      enabled: true,
      traits: [
        { id: 'brave', title: 'شجاعت' },
        { id: 'smart', title: 'هوش' },
      ],
      characters: [
        { id: 'lion', name: 'شیر', title: 'شجاع', description: 'نترس', imageId: null, traitId: 'brave' },
        { id: 'owl', name: 'جغد', title: 'دانا', description: 'کنجکاو', imageId: null, traitId: 'smart' },
      ],
      defaultCharacterId: 'lion',
    };
    // Option b of every question is clever.
    for (const step of input.definition.steps) {
      for (const question of step.questions) {
        if (question.kind === 'single') question.options[1].traits = { smart: 2 };
      }
    }
    const created = await call('POST', '/admin/engagement/activities', admin, input);
    expect(created.statusCode, created.body).toBe(201);
    const id = created.json().data.id as string;
    await call('POST', `/admin/engagement/activities/${id}/status`, admin, { action: 'publish' });

    const user = await signIn('', nextPhone());
    const detail = (await call('GET', `/me/activities/${id}`, user)).json().data;
    expect(JSON.stringify(detail.steps)).not.toContain('traits');
    expect(detail.journey.result).toBeNull();

    await answer(user, id, 'q1', 'b');
    await answer(user, id, 'q2', 'b');
    await aDayPasses(id);
    await answer(user, id, 'q3', 'b');
    const last = (await answer(user, id, 'q4', null)).json().data;
    expect(last.journeyCompleted).toBe(true);
    expect(last.journey.result).toMatchObject({ character: { id: 'owl', name: 'جغد' }, traits: [{ id: 'brave', score: 0 }, { id: 'smart', score: 6 }] });

    // The admin renames the owl and makes everyone brave: a new version. The kept result does not move.
    const edited = journeyInput();
    edited.definition.journey!.result = { ...settings.result, characters: settings.result.characters.map((c) => (c.id === 'owl' ? { ...c, name: 'جغد پیر' } : c)), defaultCharacterId: 'lion' };
    edited.definition.steps = input.definition.steps;
    const updated = await call('PUT', `/admin/engagement/activities/${id}`, admin, { ...edited, startsAt: input.startsAt });
    expect(updated.statusCode, updated.body).toBe(200);
    const again = (await call('GET', `/me/activities/${id}`, user)).json().data;
    expect(again.journey.result.character).toMatchObject({ id: 'owl', name: 'جغد' });
  });

  it('previews a journey for an admin only: every day open, nothing recorded', async () => {
    const id = await publishJourney();
    const preview = await call('GET', `/admin/engagement/activities/${id}/preview`, admin);
    expect(preview.statusCode, preview.body).toBe(200);
    const { activity, definition } = preview.json().data;
    expect(activity.journey.days.map((d: { status: string }) => d.status)).toEqual(['available', 'available']);
    expect(activity.steps).toHaveLength(2);
    expect(definition.journey.unlockMode).toBe('calendar_day');

    const user = await signIn('', nextPhone());
    expect((await call('GET', `/admin/engagement/activities/${id}/preview`, user)).statusCode).toBe(401);
    const rows = await getPool().query(`SELECT 1 FROM v2_engagement_participations WHERE activity_id = $1`, [id]);
    expect(rows.rowCount).toBe(0);
  });

  it('stores each answer as its own row, written once', async () => {
    const id = await publishJourney();
    const phone = nextPhone();
    const user = await signIn('', phone);
    await Promise.all([answer(user, id, 'q1', 'a'), answer(user, id, 'q1', 'a'), answer(user, id, 'q2', 'b')]);

    const { rows } = await getPool().query<{ question_id: string; day_id: string; value: unknown }>(
      `SELECT ja.question_id, ja.day_id, ja.value FROM v2_journey_answers ja JOIN v2_users u ON u.id = ja.user_id
        WHERE ja.activity_id = $1 AND u.phone = $2 ORDER BY ja.question_id`,
      [id, phone]
    );
    expect(rows).toEqual([
      { question_id: 'q1', day_id: 'day1', value: 'a' },
      { question_id: 'q2', day_id: 'day1', value: 'b' },
    ]);
    // Nothing is copied into the general responses table.
    const copies = await getPool().query(`SELECT 1 FROM v2_engagement_responses WHERE activity_id = $1`, [id]);
    expect(copies.rowCount).toBe(0);
  });

  it('refuses a journey without its settings, a start, or a day title', async () => {
    const input = journeyInput();
    const bad = await call('POST', '/admin/engagement/activities', admin, {
      ...input,
      startsAt: null,
      definition: { ...input.definition, journey: null, steps: [{ ...input.definition.steps[0], title: '' }] },
    });
    expect(bad.statusCode).toBe(400);
    const fields = Object.keys(bad.json().error.details.fields);
    expect(fields).toEqual(expect.arrayContaining(['definition.journey', 'definition.steps.0.title', 'startsAt']));
  });
});
