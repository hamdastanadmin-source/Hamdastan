import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { API_PREFIX, SESSION_COOKIE_NAME } from '@hamdastan/config';

import { buildApp } from '../../../app';
import { mockOtpProvider } from '../../../integrations/otp';
import { PHONE, PROFILE, sentCode, WRONG_CODE } from './fixtures';

/**
 * The HTTP surface: status codes, the response envelope, validation of the
 * request body, and the session cookie. The rules themselves are covered in
 * `auth.service.test.ts` — these tests only check that they are reachable and
 * reported correctly over the wire.
 */

const BASE = `${API_PREFIX}/auth`;

let app: FastifyInstance;

/** The `session=…` cookie value from a reply, if it set one. */
function sessionCookie(headers: Record<string, unknown>): string | undefined {
  const raw = headers['set-cookie'];
  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .filter((value): value is string => typeof value === 'string')
    .find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`));
}

function register(payload: Record<string, unknown> = { phone: PHONE, ...PROFILE }) {
  return app.inject({ method: 'POST', url: `${BASE}/register`, payload });
}

async function registerAndVerify() {
  await register();

  return app.inject({
    method: 'POST',
    url: `${BASE}/otp/verify`,
    payload: { phone: PHONE, code: sentCode() },
  });
}

beforeEach(async () => {
  mockOtpProvider.clear();
  // A fresh app rebinds the in-memory store, so no test inherits another's users.
  app = await buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('POST /auth/check-phone', () => {
  it('answers for an unknown number', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${BASE}/check-phone`,
      payload: { phone: PHONE },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, data: { registered: false } });
  });

  it('accepts the shapes a user actually types, and normalises them', async () => {
    await registerAndVerify();

    for (const spelling of ['+989123456789', '۰۹۱۲۳۴۵۶۷۸۹', '0912 345 6789']) {
      const response = await app.inject({
        method: 'POST',
        url: `${BASE}/check-phone`,
        payload: { phone: spelling },
      });

      expect(response.json(), spelling).toEqual({
        ok: true,
        data: { registered: true },
      });
    }
  });

  it('rejects a number that is not a mobile number', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${BASE}/check-phone`,
      payload: { phone: '12345' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/register', () => {
  it('returns a challenge and sets no session cookie', async () => {
    const response = await register();

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({ phone: PHONE, purpose: 'REGISTER' });
    // A pending registration is not a session.
    expect(sessionCookie(response.headers)).toBeUndefined();
  });

  it('reports every invalid field at once', async () => {
    const response = await register({
      phone: PHONE,
      firstName: 'ا',
      lastName: '',
      birthDate: '',
      gender: 'X',
    });

    expect(response.statusCode).toBe(400);
    const { details } = response.json().error;
    expect(Object.keys(details.properties)).toEqual(
      expect.arrayContaining(['firstName', 'lastName', 'birthDate', 'gender'])
    );
  });
});

describe('the birth date the form sends', () => {
  it('accepts the earliest date the year dropdown offers', async () => {
    // 1 Farvardin 1320, the first year in the list.
    const response = await register({ phone: PHONE, ...PROFILE, birthDate: '1941-03-21' });

    expect(response.statusCode).toBe(201);
  });

  it('refuses a date before it', async () => {
    const response = await register({ phone: PHONE, ...PROFILE, birthDate: '1941-03-20' });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses a date in the future', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    const response = await register({ phone: PHONE, ...PROFILE, birthDate: tomorrow });

    expect(response.statusCode).toBe(400);
  });

  it('refuses a day the calendar does not have', async () => {
    const response = await register({ phone: PHONE, ...PROFILE, birthDate: '1990-02-31' });

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /auth/otp/verify', () => {
  it('signs the new user in and sets an httpOnly session cookie', async () => {
    const response = await registerAndVerify();

    expect(response.statusCode).toBe(200);
    expect(response.json().data.user).toMatchObject({
      phone: PHONE,
      fullName: 'امید بهشتی',
      role: 'USER',
    });

    const cookie = sessionCookie(response.headers);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });

  it('never puts the session token in the body', async () => {
    const response = await registerAndVerify();

    expect(response.json().data).not.toHaveProperty('token');
    expect(Object.keys(response.json().data)).toEqual(['user']);
  });

  it('reports a wrong code as 400 with the auth error code', async () => {
    await register();

    const response = await app.inject({
      method: 'POST',
      url: `${BASE}/otp/verify`,
      payload: { phone: PHONE, code: WRONG_CODE },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({ code: 'OTP_INVALID' });
  });

  it('reports a resend inside the cooldown as 429', async () => {
    await register();

    const response = await app.inject({
      method: 'POST',
      url: `${BASE}/otp/send`,
      payload: { phone: PHONE },
    });

    expect(response.statusCode).toBe(429);
    expect(response.json().error.code).toBe('OTP_RESEND_COOLDOWN');
    expect(response.json().error.details.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe('GET /auth/session', () => {
  it('resolves the cookie to the signed-in user', async () => {
    const verified = await registerAndVerify();
    const cookie = sessionCookie(verified.headers) ?? '';

    const response = await app.inject({
      method: 'GET',
      url: `${BASE}/session`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.user.phone).toBe(PHONE);
  });

  it('is 401 without a cookie', async () => {
    const response = await app.inject({ method: 'GET', url: `${BASE}/session` });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('is 401 for a token that was never issued', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${BASE}/session`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=deadbeef` },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('clears the cookie and stops the session resolving', async () => {
    const verified = await registerAndVerify();
    const cookie = sessionCookie(verified.headers) ?? '';

    const loggedOut = await app.inject({
      method: 'POST',
      url: `${BASE}/logout`,
      headers: { cookie },
    });

    expect(loggedOut.statusCode).toBe(200);
    expect(sessionCookie(loggedOut.headers)).toContain(`${SESSION_COOKIE_NAME}=;`);

    const after = await app.inject({
      method: 'GET',
      url: `${BASE}/session`,
      headers: { cookie },
    });
    expect(after.statusCode).toBe(401);
  });

  it('succeeds without a session, so signing out twice is not an error', async () => {
    const response = await app.inject({ method: 'POST', url: `${BASE}/logout` });

    expect(response.statusCode).toBe(200);
  });
});

describe('POST /auth/otp/cancel', () => {
  it('invalidates the challenge behind the number', async () => {
    await register();
    const code = sentCode();

    await app.inject({
      method: 'POST',
      url: `${BASE}/otp/cancel`,
      payload: { phone: PHONE },
    });

    const response = await app.inject({
      method: 'POST',
      url: `${BASE}/otp/verify`,
      payload: { phone: PHONE, code },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('OTP_NOT_FOUND');
  });
});
