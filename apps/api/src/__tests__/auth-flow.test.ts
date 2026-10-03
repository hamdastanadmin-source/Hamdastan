import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX, OTP, SESSION } from '@hamdastan/config';

import { buildApp } from '../app';
import { closePool, getPool, runMigrations } from '../data';
import type { SmsSender } from '../integrations';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
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

describe.skipIf(!hasDatabase)('sign-in against a migrated database', () => {
  beforeAll(async () => {
    // From nothing, so the schema under test is exactly what the migrations
    // produce — not what an earlier run or a hand edit left behind.
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();

    setUsersRepository(sqlUsersRepository);
    setAuthRepository(sqlAuthRepository);
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

      const done = await post('/me/onboarding/complete', undefined, cookies);
      expect(done.statusCode, done.body).toBe(200);
      expect(done.json().data.nextStep).toBe('home');
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

      const replay = await post('/auth/refresh', undefined, cookies);
      expect(replay.statusCode).toBe(401);

      // The replay revoked the whole session, including the newer token.
      const after = await post('/auth/refresh', undefined, next);
      expect(after.statusCode).toBe(401);
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
