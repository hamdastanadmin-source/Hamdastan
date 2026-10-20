import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX } from '@hamdastan/config';
import type { ActivityInput, ActivitySubmission, Leaderboard, PlayerActivity } from '@hamdastan/types';
import { activityInputSchema } from '@hamdastan/validation';

import { buildApp } from '../app';
import { closePool, getPool, runMigrations } from '../data';
import type { SmsSender } from '../integrations';
import { setAdminRepository, sqlAdminRepository } from '../modules/admin';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
import { setEngagementRepository, sqlEngagementRepository } from '../modules/engagement';
import { setProgressRepository, sqlProgressRepository } from '../modules/progress';
import { setUsersRepository, sqlUsersRepository } from '../modules/users';

/**
 * Trivia and competitions end to end, against a migrated database: a
 * competition is one try inside a fixed window, ranked by score and then by
 * the time from «شروع» to submitting; the leaderboard names people by
 * handle, never by number; an answer's explanation and the answer key stay
 * on the server until the answers may be revealed — after a knowledge
 * assessment's last submission, or once a competition has ended.
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
  return `0996${String(Date.now() % 100_000).padStart(5, '0')}${String(phoneCounter).padStart(2, '0')}`;
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

async function ok<T>(response: LightMyRequestResponse, status = 200): Promise<T> {
  expect(response.statusCode, response.body).toBe(status);
  return response.json().data as T;
}

const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();

/** Two single-choice questions: «a» is right for both. */
const quiz = (type: 'competition' | 'assessment', overrides: Partial<ActivityInput> = {}): ActivityInput => ({
  type,
  title: type === 'competition' ? 'مسابقه‌ی هاگوارتز' : 'آزمون هاگوارتز',
  summary: '',
  instructions: '',
  definition: {
    steps: [
      {
        id: 's1',
        title: '',
        description: '',
        questions: ['q1', 'q2'].map((id) => ({
          id,
          kind: 'single' as const,
          title: `سؤال ${id}`,
          required: true,
          explanation: `چون ${id} این‌طور است`,
          options: [
            { id: 'a', label: 'درست', correct: true },
            { id: 'b', label: 'نادرست', correct: false },
          ],
        })),
      },
    ],
    estimatedMinutes: 2,
    maxSubmissions: 3,
    anonymous: false,
    review: 'auto',
    assessment: { mode: 'knowledge', dimensions: [], passingScore: null, showResult: true, revealAnswers: true },
    journey: null,
    xp: { enabled: true, amount: 10, showBeforeStart: true, maxAwards: 3, requirePass: false },
  },
  audience: { kind: 'all' },
  startsAt: type === 'competition' ? hours(-1) : null,
  endsAt: type === 'competition' ? hours(2) : null,
  worldIds: [],
  ...overrides,
});

async function published(input: ActivityInput): Promise<{ id: string }> {
  const created = await ok<{ id: string }>(await call('POST', '/admin/engagement/activities', admin, input), 201);
  await ok(await call('POST', `/admin/engagement/activities/${created.id}/status`, admin, { action: 'publish' }));
  return created;
}

async function play(cookies: Cookies, id: string, answers: Record<string, string>, pauseMs = 0): Promise<ActivitySubmission> {
  const activity = await ok<PlayerActivity>(await call('GET', `/me/activities/${id}`, cookies));
  await ok(await call('POST', `/me/activities/${id}/start`, cookies));
  if (pauseMs) await new Promise((resolve) => setTimeout(resolve, pauseMs));
  return ok(await call('POST', `/me/activities/${id}/submit`, cookies, { versionId: activity.versionId, answers }));
}

describe('competition rules', () => {
  it('is one try inside a window, scored as knowledge', () => {
    const parsed = activityInputSchema.parse(quiz('competition'));
    expect(parsed.definition.maxSubmissions).toBe(1);
    expect(parsed.definition.xp.maxAwards).toBe(1);
    expect(parsed.definition.assessment?.mode).toBe('knowledge');
    const open = activityInputSchema.safeParse(quiz('competition', { startsAt: null, endsAt: null }));
    expect(open.success).toBe(false);
    expect(open.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['startsAt', 'endsAt']);
  });
});

describe.skipIf(!hasDatabase)('trivia and competitions against a migrated database', () => {
  beforeAll(async () => {
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();
    setUsersRepository(sqlUsersRepository);
    setAuthRepository(sqlAuthRepository);
    setAdminRepository(sqlAdminRepository);
    setProgressRepository(sqlProgressRepository);
    setEngagementRepository(sqlEngagementRepository);
    setSmsSender(silentSender);
    app = await buildApp();
    await app.ready();
    admin = await signIn('/admin', MAIN_ADMIN_PHONE);
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
  });

  it('ranks by score, then by time taken, and names nobody by number', async () => {
    const competition = await published(quiz('competition'));
    const [fast, slow, wrong] = [await signIn('', nextPhone()), await signIn('', nextPhone()), await signIn('', nextPhone())];

    const first = await play(fast, competition.id, { q1: 'a', q2: 'a' });
    expect(first.result?.score).toBe(100);
    expect(first.rank).toMatchObject({ rank: 1, me: true, score: 100 });
    // Still open: nobody may learn the answers yet.
    expect(first.answerReview).toBeNull();

    await play(slow, competition.id, { q1: 'a', q2: 'a' }, 1200);
    await play(wrong, competition.id, { q1: 'b', q2: 'a' });

    // One try: a second submission is refused.
    const { versionId } = await ok<PlayerActivity>(await call('GET', `/me/activities/${competition.id}`, fast));
    const again = await call('POST', `/me/activities/${competition.id}/submit`, fast, { versionId, answers: { q1: 'a', q2: 'a' } });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('ACTIVITY_LIMIT_REACHED');

    const board = await ok<Leaderboard>(await call('GET', `/me/activities/${competition.id}/leaderboard`, slow));
    expect(board.total).toBe(3);
    expect(board.final).toBe(false);
    expect(board.entries.map((entry) => [entry.rank, entry.score, entry.me])).toEqual([
      [1, 100, false],
      [2, 100, true],
      [3, 50, false],
    ]);
    expect(board.me?.rank).toBe(2);
    expect(board.entries[1].durationMs).toBeGreaterThanOrEqual(1000);
    expect(board.entries.every((entry) => !/\d{10}/.test(entry.name))).toBe(true);

    const adminBoard = await ok<{ rank: number; fullName: string }[]>(await call('GET', `/admin/engagement/activities/${competition.id}/leaderboard`, admin));
    expect(adminBoard.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it('keeps the answer key and explanations on the server until a competition ends', async () => {
    const competition = await published(quiz('competition'));
    const player = await signIn('', nextPhone());
    await play(player, competition.id, { q1: 'a', q2: 'b' });

    const during = await ok<PlayerActivity>(await call('GET', `/me/activities/${competition.id}`, player));
    expect(during.answerReview).toBeNull();
    expect(JSON.stringify(during.steps)).not.toContain('explanation');
    expect(JSON.stringify(during.steps)).not.toContain('correct');

    // The window closes: the ranking is final and the answers are revealed.
    const detail = await ok<{ definition: ActivityInput['definition'] }>(await call('GET', `/admin/engagement/activities/${competition.id}`, admin));
    await ok(
      await call('PUT', `/admin/engagement/activities/${competition.id}`, admin, {
        ...quiz('competition'),
        definition: detail.definition,
        startsAt: hours(-3),
        endsAt: hours(-1),
      })
    );
    const after = await ok<PlayerActivity>(await call('GET', `/me/activities/${competition.id}`, player));
    expect(after.answerReview).toEqual([
      { questionId: 'q1', correct: true, correctOptionIds: ['a'], explanation: 'چون q1 این‌طور است' },
      { questionId: 'q2', correct: false, correctOptionIds: ['a'], explanation: 'چون q2 این‌طور است' },
    ]);
    expect((await ok<Leaderboard>(await call('GET', `/me/activities/${competition.id}/leaderboard`, player))).final).toBe(true);
  });

  it('reveals a knowledge assessment’s answers only after the last submission allowed', async () => {
    const assessment = await published(quiz('assessment', { definition: { ...quiz('assessment').definition, maxSubmissions: 2 } }));
    const player = await signIn('', nextPhone());

    const firstTry = await play(player, assessment.id, { q1: 'b', q2: 'b' });
    expect(firstTry.answerReview).toBeNull();
    const lastTry = await play(player, assessment.id, { q1: 'a', q2: 'b' });
    expect(lastTry.answerReview?.map((item) => item.correct)).toEqual([true, false]);

    // A competition's leaderboard only: an assessment has none.
    expect((await call('GET', `/me/activities/${assessment.id}/leaderboard`, player)).statusCode).toBe(404);
  });
});
