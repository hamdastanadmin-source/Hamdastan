import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX, OTP, SESSION } from '@hamdastan/config';

import { buildApp } from '../app';
import { closePool, diffSchema, getPool, readSchema, readSnapshot, runMigrations } from '../data';
import type { SmsSender } from '../integrations';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
import { setOnboardingRepository, sqlOnboardingRepository } from '../modules/onboarding';
import { setProgressRepository, sqlProgressRepository } from '../modules/progress';
import { setUsersRepository, sqlUsersRepository } from '../modules/users';

/**
 * The sign-in flow against a real PostgreSQL, from an empty schema.
 *
 * This is the test that catches the repository and the migrations
 * disagreeing — a column the SQL writes that no migration creates — which no
 * mocked repository can. It needs `TEST_DATABASE_URL` (a database whose name
 * ends in `_test`; see `setup.ts`) and skips with that reason without one.
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

type Cookies = Record<string, string>;

/** The numbers the console sender would have texted, by phone. */
const sent = new Map<string, string>();
const recordingSender: SmsSender = {
  name: 'test',
  async sendOtp(phone, code) {
    sent.set(phone, code);
  },
};

let app: FastifyInstance;
let phoneCounter = 0;

/** 0999 is a range no operator issues; the counter keeps tests apart. */
function nextPhone(): string {
  phoneCounter += 1;
  return `0999${String(Date.now() % 1_000_000).padStart(6, '0')}${phoneCounter % 10}`;
}

function cookiesFrom(response: LightMyRequestResponse): Cookies {
  return Object.fromEntries(response.cookies.map(({ name, value }) => [name, value]));
}

async function post(url: string, body?: unknown, cookies: Cookies = {}) {
  return app.inject({ method: 'POST', url: `${API_PREFIX}${url}`, payload: body as object, cookies });
}

async function put(url: string, body: unknown, cookies: Cookies) {
  return app.inject({ method: 'PUT', url: `${API_PREFIX}${url}`, payload: body as object, cookies });
}

async function get(url: string, cookies: Cookies = {}) {
  return app.inject({ method: 'GET', url: `${API_PREFIX}${url}`, cookies });
}

/** Requests a code and verifies it — the whole of sign-in. */
async function signIn(phone: string) {
  const requested = await post('/auth/otp/request', { phone });
  expect(requested.statusCode, requested.body).toBe(200);

  const code = requested.json().data.debugCode as string;
  const verified = await post('/auth/otp/verify', { phone, code });
  expect(verified.statusCode, verified.body).toBe(200);

  return { body: verified.json().data, cookies: cookiesFrom(verified) };
}

/** One complete set of answers, by question id. */
const FULL_ANSWERS: Record<string, unknown> = {
  Q1: { ranked: ['SOCIAL', 'FUN'] },
  Q2: { option: 'INITIATES' },
  Q3: { options: ['INITIATOR'] },
  Q4: { value: 8 },
  Q5: { option: 'MINUTES' },
  Q6: { options: ['DEEP'] },
  Q7: { option: 'DEBATES' },
  Q8: { value: 7 },
  Q9: { value: 4 },
  Q10: { option: 'FLEXIBLE' },
  Q11: { value: 5 },
  Q12: { option: 'FRIENDLY_COMPETITION' },
  Q13: { option: 'NEW' },
  Q14: { option: 'GOES_ALONG' },
  Q15: { options: ['EVENING', 'WEEKEND'] },
  Q16: { value: 6 },
  Q17: { value: 9 },
  Q18: { option: 'MIXED' },
  Q19: { option: 'MEDIUM' },
  Q20: { options: ['HIGH_CP'] },
};

/** Answers every question and finishes the questionnaire. */
async function answerQuestionnaire(cookies: Cookies) {
  for (const [questionId, answer] of Object.entries(FULL_ANSWERS)) {
    const saved = await put(`/me/onboarding/questionnaire/answers/${questionId}`, { answer }, cookies);
    expect(saved.statusCode, saved.body).toBe(200);
  }
  const completed = await post('/me/onboarding/questionnaire/complete', undefined, cookies);
  expect(completed.statusCode, completed.body).toBe(200);
  expect(completed.json().data.result.title).toBeTruthy();
}

describe.skipIf(!hasDatabase)('sign-in against a migrated database', () => {
  beforeAll(async () => {
    // From nothing, so the schema under test is exactly what the migrations
    // produce — not what an earlier run or a hand edit left behind.
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();

    setUsersRepository(sqlUsersRepository);
    setAuthRepository(sqlAuthRepository);
    setOnboardingRepository(sqlOnboardingRepository);
    setProgressRepository(sqlProgressRepository);
    setSmsSender(recordingSender);

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
  });

  describe('migrations', () => {
    it('are a no-op the second time', async () => {
      const outcome = await runMigrations();
      expect(outcome.applied).toEqual([]);
      expect(outcome.alreadyApplied.length).toBeGreaterThan(0);
    });

    it('build exactly the schema in database/schema/snapshot.txt', async () => {
      const snapshot = await readSnapshot();
      expect(snapshot, 'no snapshot — run `npm run db:snapshot`').not.toBeNull();
      const drift = diffSchema(snapshot!, await readSchema(getPool()));
      expect(
        drift,
        'The migrations no longer build the snapshot. If a migration was added on ' +
          'purpose, run `npm run db:snapshot` and commit database/schema/snapshot.txt.'
      ).toEqual({ missing: [], unexpected: [] });
    });

    it('report a database changed by hand as drift', async () => {
      const pool = getPool();
      await pool.query('ALTER TABLE v2_users ADD COLUMN zz_hand_made text');
      try {
        const { drift } = await runMigrations();
        expect(drift?.unexpected.join('\n')).toMatch(/v2_users\.zz_hand_made/);
      } finally {
        await pool.query('ALTER TABLE v2_users DROP COLUMN zz_hand_made');
      }
    });

    it('refuse an applied file whose contents have changed', async () => {
      const pool = getPool();
      const { rows } = await pool.query<{ name: string; checksum: string }>(
        'SELECT name, checksum FROM v2_migrations ORDER BY name LIMIT 1'
      );
      const [first] = rows;

      await pool.query('UPDATE v2_migrations SET checksum = $1 WHERE name = $2', [
        '0'.repeat(64),
        first!.name,
      ]);
      try {
        await expect(runMigrations()).rejects.toThrow(/already applied, but the file has changed/);
      } finally {
        await pool.query('UPDATE v2_migrations SET checksum = $1 WHERE name = $2', [
          first!.checksum,
          first!.name,
        ]);
      }
    });
  });

  describe('a new number', () => {
    it('creates the account at verification and sends it to basic info', async () => {
      const phone = nextPhone();
      const { body, cookies } = await signIn(phone);

      expect(body.isNew).toBe(true);
      expect(body.nextStep).toBe('basic_info');
      expect(body.user.phone).toBe(phone);
      expect(cookies[SESSION.ACCESS_COOKIE]).toBeTruthy();
      expect(cookies[SESSION.REFRESH_COOKIE]).toBeTruthy();

      const { rows } = await getPool().query<{ last_login_at: Date | null }>(
        'SELECT last_login_at FROM v2_users WHERE phone = $1',
        [phone]
      );
      expect(rows[0]?.last_login_at).toBeInstanceOf(Date);
    });

    it('walks basic info, interests and onboarding to home', async () => {
      const { cookies } = await signIn(nextPhone());

      const me = await get('/me', cookies);
      expect(me.statusCode).toBe(200);
      expect(me.json().data.nextStep).toBe('basic_info');

      // Interests are refused before the profile exists.
      const early = await put('/me/onboarding/interests', { interestIds: ['concert', 'gallery', 'workshop'] }, cookies);
      expect(early.statusCode).toBe(403);

      const basic = await put(
        '/me/basic-info',
        {
          firstName: 'سارا',
          lastName: 'احمدی',
          birthDate: { year: 1375, month: 6, day: 15 },
          gender: 'female',
        },
        cookies
      );
      expect(basic.statusCode, basic.body).toBe(200);
      expect(basic.json().data.nextStep).toBe('onboarding');
      expect(basic.json().data.user.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const interests = await put(
        '/me/onboarding/interests',
        { interestIds: ['concert', 'gallery', 'workshop'] },
        cookies
      );
      expect(interests.statusCode, interests.body).toBe(200);
      expect(interests.json().data.selectedCategories).toEqual(['music', 'art', 'learning']);

      const read = await get('/me/onboarding/interests', cookies);
      expect(read.json().data.selectedInterests).toEqual(['concert', 'gallery', 'workshop']);

      // The questionnaire can be put off: stage 1 is enough to finish.
      const done = await post('/me/onboarding/complete', undefined, cookies);
      expect(done.statusCode, done.body).toBe(200);
      expect(done.json().data.nextStep).toBe('home');
    });

    it('refuses to finish onboarding before the interests are saved', async () => {
      const { cookies } = await signIn(nextPhone());
      await put(
        '/me/basic-info',
        { firstName: 'رضا', lastName: 'نوری', birthDate: { year: 1371, month: 2, day: 2 }, gender: 'male' },
        cookies
      );
      const early = await post('/me/onboarding/complete', undefined, cookies);
      expect(early.statusCode).toBe(403);
    });

    it('stores the questionnaire as raw answers and a profile derived from them', async () => {
      const { cookies } = await signIn(nextPhone());
      await put(
        '/me/basic-info',
        { firstName: 'مینا', lastName: 'کریمی', birthDate: { year: 1372, month: 3, day: 3 }, gender: 'female' },
        cookies
      );

      // Stage 2 follows stage 1.
      const early = await put('/me/onboarding/questionnaire/answers/Q2', { answer: { option: 'INITIATES' } }, cookies);
      expect(early.statusCode).toBe(403);

      await put('/me/onboarding/interests', { interestIds: ['concert', 'gallery', 'workshop'] }, cookies);

      // An answer of the wrong shape, or past a question's cap, is refused.
      const wrong = await put('/me/onboarding/questionnaire/answers/Q4', { answer: { option: 'X' } }, cookies);
      expect(wrong.statusCode).toBe(400);
      const tooMany = await put(
        '/me/onboarding/questionnaire/answers/Q3',
        { answer: { options: ['INITIATOR', 'LISTENER', 'ANALYST'] } },
        cookies
      );
      expect(tooMany.statusCode).toBe(400);

      const first = await put('/me/onboarding/questionnaire/answers/Q2', { answer: { option: 'INITIATES' } }, cookies);
      expect(first.statusCode, first.body).toBe(200);
      expect(first.json().data.resumeQuestionId).toBe('Q4');

      // Finishing early is refused.
      const early2 = await post('/me/onboarding/questionnaire/complete', undefined, cookies);
      expect(early2.statusCode).toBe(400);

      await answerQuestionnaire(cookies);

      // Editing an answer replaces it: one row, and the score of the new answer only.
      await put('/me/onboarding/questionnaire/answers/Q2', { answer: { option: 'LISTENER' } }, cookies);
      const userId = (await get('/me', cookies)).json().data.user.id as string;
      const rows = await getPool().query(
        'SELECT question_id, presentation_index FROM v2_questionnaire_answers WHERE user_id = $1',
        [userId]
      );
      expect(rows.rowCount).toBe(20);
      expect(rows.rows.find((r) => r.question_id === 'Q2')?.presentation_index).toBe(1);

      const profile = await getPool().query(
        `SELECT si::float, cp::float, preferred_group_size, available_weekend, conflict_sensitivities,
                primary_role, questionnaire_completed, raw_score_contributions
           FROM v2_social_profiles WHERE user_id = $1`,
        [userId]
      );
      const row = profile.rows[0];
      expect(row.si).toBe(1);
      expect(row.raw_score_contributions.Q2).toEqual({ SI: 0, SE: 0, LISTENING: 4 });
      expect(row.cp).toBe(5.35);
      expect(row.preferred_group_size).toBe('MEDIUM');
      expect(row.available_weekend).toBe(true);
      expect(row.conflict_sensitivities).toEqual(['HIGH_CP']);
      expect(row.primary_role).toBeTruthy();
      expect(row.questionnaire_completed).toBe(true);

      const stage = await getPool().query('SELECT onboarding_stage FROM v2_users WHERE id = $1', [userId]);
      expect(stage.rows[0].onboarding_stage).toBe(2);

      const event = await post('/me/onboarding/events', { event: 'quiz_question_viewed', questionId: 'Q3' }, cookies);
      expect(event.statusCode, event.body).toBe(200);
      const stored = await getPool().query(
        'SELECT presentation_index FROM v2_onboarding_events WHERE user_id = $1',
        [userId]
      );
      expect(stored.rows[0].presentation_index).toBe(5);
    });

    it('accepts every gender the form offers', async () => {
      for (const gender of ['male', 'female']) {
        const { cookies } = await signIn(nextPhone());
        const response = await put(
          '/me/basic-info',
          { firstName: 'امید', lastName: 'بهشتی', birthDate: { year: 1349, month: 5, day: 5 }, gender },
          cookies
        );
        expect(response.statusCode, response.body).toBe(200);
        expect(response.json().data.user.gender).toBe(gender);
      }

      const { cookies } = await signIn(nextPhone());
      const other = await put(
        '/me/basic-info',
        { firstName: 'امید', lastName: 'بهشتی', birthDate: { year: 1349, month: 5, day: 5 }, gender: 'other' },
        cookies
      );
      expect(other.statusCode).toBe(400);
    });

    it('rejects interests from fewer than three categories', async () => {
      const { cookies } = await signIn(nextPhone());
      await put(
        '/me/basic-info',
        { firstName: 'علی', lastName: 'رضایی', birthDate: { year: 1370, month: 1, day: 1 }, gender: 'male' },
        cookies
      );

      const response = await put('/me/onboarding/interests', { interestIds: ['concert', 'rock'] }, cookies);
      expect(response.statusCode).toBe(400);
    });
  });

  describe('the account area', () => {
    /** Signed in, basic info and interests saved, onboarding finished without the questionnaire. */
    async function homeUser(firstName = 'نگار') {
      const { cookies } = await signIn(nextPhone());
      await put(
        '/me/basic-info',
        { firstName, lastName: 'صالحی', birthDate: { year: 1374, month: 4, day: 4 }, gender: 'female' },
        cookies
      );
      await put('/me/onboarding/interests', { interestIds: ['concert', 'gallery', 'workshop'] }, cookies);
      await post('/me/onboarding/complete', undefined, cookies);
      return cookies;
    }

    const patch = (url: string, body: unknown, cookies: Cookies) =>
      app.inject({ method: 'PATCH', url: `${API_PREFIX}${url}`, payload: body as object, cookies });

    it('starts at level 1 with every mission open and no social profile', async () => {
      const cookies = await homeUser();
      const account = await get('/me/account', cookies);
      expect(account.statusCode, account.body).toBe(200);

      const data = account.json().data;
      expect(data.progress).toMatchObject({ xpTotal: 0, level: 1, levelStartXp: 0, nextLevelXp: 100 });
      expect(data.socialProfile).toBeNull();
      expect(data.profile.displayName).toBe('نگار');
      expect(data.missions.map((m: { status: string }) => m.status)).toEqual([
        'available',
        'available',
        'available',
      ]);
    });

    it('grants the questionnaire reward once, however often it is finished', async () => {
      const cookies = await homeUser();
      await answerQuestionnaire(cookies);

      const again = await post('/me/onboarding/questionnaire/complete', undefined, cookies);
      expect(again.json().data.xpAwarded).toBe(0);

      const data = (await get('/me/account', cookies)).json().data;
      expect(data.progress.xpTotal).toBe(50);
      expect(data.progress.recent).toHaveLength(1);
      expect(data.socialProfile.title).toBeTruthy();
      expect(data.missions.find((m: { id: string }) => m.id === 'personality_test').status).toBe('completed');
    });

    it('completes the profile mission on a username and a city, and keeps usernames unique', async () => {
      const cookies = await homeUser();

      const partial = await patch('/me/profile', { username: 'Neg.Sal' }, cookies);
      expect(partial.statusCode, partial.body).toBe(200);
      expect(partial.json().data.account.profile.username).toBe('neg.sal');
      expect(partial.json().data.xpAwarded).toBe(0);

      const complete = await patch('/me/profile', { city: 'شیراز', bio: '' }, cookies);
      expect(complete.json().data.xpAwarded).toBe(20);
      expect(complete.json().data.account.profile.bio).toBeNull();

      const twice = await patch('/me/profile', { city: 'تهران' }, cookies);
      expect(twice.json().data.xpAwarded).toBe(0);

      const other = await homeUser('مریم');
      const taken = await patch('/me/profile', { username: 'NEG.SAL' }, other);
      expect(taken.statusCode).toBe(409);

      const invalid = await patch('/me/profile', { username: '1abc' }, other);
      expect(invalid.statusCode).toBe(400);
    });

    it('stores social handles, from a handle or a pasted link, and clears them', async () => {
      const cookies = await homeUser();

      const saved = await patch(
        '/me/profile',
        { instagram: 'https://www.instagram.com/Neg.Sal/', telegram: '@Neg_Sal', linkedin: 'neg-sal' },
        cookies
      );
      expect(saved.statusCode, saved.body).toBe(200);
      expect(saved.json().data.account.profile).toMatchObject({
        instagram: 'neg.sal',
        telegram: 'neg_sal',
        linkedin: 'neg-sal',
      });

      const cleared = await patch('/me/profile', { telegram: '' }, cookies);
      expect(cleared.json().data.account.profile.telegram).toBeNull();

      const invalid = await patch('/me/profile', { telegram: 'ab' }, cookies);
      expect(invalid.statusCode).toBe(400);
    });

    it('saves an avatar from the catalog and rewards the first one', async () => {
      const cookies = await homeUser();
      const avatar = { base: 'base-3', top: 'hoodie', bottom: 'jeans', shoes: 'boots', accessory: 'cap' };

      const saved = await put('/me/avatar', avatar, cookies);
      expect(saved.statusCode, saved.body).toBe(200);
      expect(saved.json().data.account.profile.avatar).toEqual(avatar);
      expect(saved.json().data.xpAwarded).toBe(20);

      const resaved = await put('/me/avatar', { ...avatar, accessory: 'none' }, cookies);
      expect(resaved.json().data.xpAwarded).toBe(0);

      const unknown = await put('/me/avatar', { ...avatar, top: 'crown' }, cookies);
      expect(unknown.statusCode).toBe(400);
    });

    it('stores settings', async () => {
      const cookies = await homeUser();
      const saved = await put('/me/settings', { notifications: false, showSocialProfile: true }, cookies);
      expect(saved.statusCode, saved.body).toBe(200);
      expect(saved.json().data.account.settings).toEqual({ notifications: false, showSocialProfile: true });
    });
  });

  describe('a returning number', () => {
    it('signs into the same account', async () => {
      const phone = nextPhone();
      const first = await signIn(phone);
      sent.delete(phone);

      // The resend cooldown belongs to the challenge, which verification consumed.
      const second = await signIn(phone);
      expect(second.body.isNew).toBe(false);
      expect(second.body.user.id).toBe(first.body.user.id);
    });
  });

  describe('one-time codes', () => {
    it('are refused when asked for again inside the cooldown', async () => {
      const phone = nextPhone();
      expect((await post('/auth/otp/request', { phone })).statusCode).toBe(200);

      const again = await post('/auth/otp/request', { phone });
      expect(again.statusCode).toBe(429);
      expect(again.json().error.code).toBe('OTP_RATE_LIMITED');
    });

    it('count wrong attempts down, then burn the code', async () => {
      const phone = nextPhone();
      const requested = await post('/auth/otp/request', { phone });
      const code = requested.json().data.debugCode as string;
      const wrong = code === '000000' ? '111111' : '000000';

      for (let attempt = 1; attempt < OTP.MAX_ATTEMPTS; attempt += 1) {
        const response = await post('/auth/otp/verify', { phone, code: wrong });
        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe('OTP_INVALID');
      }

      const last = await post('/auth/otp/verify', { phone, code: wrong });
      expect(last.statusCode).toBe(429);
      expect(last.json().error.code).toBe('OTP_LOCKED');

      // The right code no longer works either.
      const late = await post('/auth/otp/verify', { phone, code });
      expect(late.statusCode).toBe(400);
      expect(late.json().error.code).toBe('OTP_NOT_FOUND');
    });

    it('verify without a request is a 400, not a 500', async () => {
      const response = await post('/auth/otp/verify', { phone: nextPhone(), code: '123456' });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('OTP_NOT_FOUND');
    });
  });

  describe('sessions', () => {
    it('rotate the refresh token, and a replay ends the session', async () => {
      const { cookies } = await signIn(nextPhone());

      const refreshed = await post('/auth/refresh', undefined, cookies);
      expect(refreshed.statusCode, refreshed.body).toBe(200);
      const next = cookiesFrom(refreshed);
      expect(next[SESSION.REFRESH_COOKIE]).not.toBe(cookies[SESSION.REFRESH_COOKIE]);

      // Presented again after the grace window: a replay.
      await getPool().query(
        `UPDATE v2_refresh_tokens SET used_at = now() - make_interval(secs => $1 + 1)
          WHERE used_at IS NOT NULL`,
        [SESSION.REFRESH_REUSE_GRACE_SECONDS]
      );
      const replay = await post('/auth/refresh', undefined, cookies);
      expect(replay.statusCode).toBe(401);

      // The replay revoked the whole session, including the newer token.
      const after = await post('/auth/refresh', undefined, next);
      expect(after.statusCode).toBe(401);
    });

    it('survive one navigation refreshing several times at once', async () => {
      const { cookies } = await signIn(nextPhone());

      // The page and its prefetches, each through the proxy with one cookie.
      const [a, b, c] = await Promise.all([
        post('/auth/refresh', undefined, cookies),
        post('/auth/refresh', undefined, cookies),
        post('/auth/refresh', undefined, cookies),
      ]);
      for (const response of [a, b, c]) expect(response.statusCode, response.body).toBe(200);

      // Every pair handed out works: whichever cookie the browser keeps.
      for (const response of [a, b, c]) {
        const me = await get('/me', cookiesFrom(response));
        expect(me.statusCode).toBe(200);
        const again = await post('/auth/refresh', undefined, cookiesFrom(response));
        expect(again.statusCode).toBe(200);
      }
    });

    it('end at logout', async () => {
      const { cookies } = await signIn(nextPhone());

      const out = await post('/auth/logout', undefined, cookies);
      expect(out.statusCode).toBe(200);

      const refresh = await post('/auth/refresh', undefined, cookies);
      expect(refresh.statusCode).toBe(401);
    });

    it('are required for /me', async () => {
      expect((await get('/me')).statusCode).toBe(401);
    });
  });
});

describe.skipIf(hasDatabase)('sign-in against a migrated database', () => {
  it.skip('needs TEST_DATABASE_URL — e.g. postgresql://localhost/hamdastan_test (createdb hamdastan_test)', () => {});
});
