import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX, SESSION } from '@hamdastan/config';

import { buildApp } from '../app';

/**
 * Cross-site request forgery: a page on another site must not be able to
 * change anything with the visitor's cookies. Needs no database — every
 * forged request is refused before a handler, and the allowed ones are
 * judged only by not being refused for CSRF.
 */

let app: FastifyInstance;
const ALLOWED = 'http://localhost:3000'; // in CORS_ORIGINS by default
const cookies = { [SESSION.ACCESS_COOKIE]: 'a', [SESSION.REFRESH_COOKIE]: 'r' };

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const post = (url: string, headers: Record<string, string>, payload?: string) =>
  app.inject({ method: 'POST', url: `${API_PREFIX}${url}`, headers, cookies, payload });

describe('CSRF', () => {
  it.each(['/auth/logout', '/auth/refresh', '/me/onboarding/complete', '/admin/auth/logout'])(
    'refuses %s from a foreign origin, cookies and all',
    async (url) => {
      const response = await post(url, { origin: 'https://evil.example' });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('CSRF_REJECTED');
    }
  );

  it('refuses a request the browser labels cross-site, even without an Origin', async () => {
    const response = await post('/auth/logout', { 'sec-fetch-site': 'cross-site' });
    expect(response.statusCode).toBe(403);
  });

  it('refuses an opaque origin (a sandboxed page)', async () => {
    expect((await post('/auth/logout', { origin: 'null' })).statusCode).toBe(403);
  });

  it('refuses a form-style body: text/plain and urlencoded are not JSON', async () => {
    const plain = await post('/me/activities/x/submit', { origin: ALLOWED, 'content-type': 'text/plain' }, '{"versionId":"x"}');
    expect(plain.statusCode).toBe(415);
    const form = await post('/auth/otp/request', { origin: ALLOWED, 'content-type': 'application/x-www-form-urlencoded' }, 'phone=09121234567');
    expect(form.statusCode).toBe(415);
  });

  it('refuses the same writes for PUT, PATCH and DELETE', async () => {
    for (const method of ['PUT', 'PATCH', 'DELETE'] as const) {
      const response = await app.inject({
        method,
        url: `${API_PREFIX}/me/profile`,
        headers: { origin: 'https://evil.example' },
        cookies,
      });
      expect(response.statusCode, method).toBe(403);
    }
  });

  it('lets the product, the panel and server-side calls through', async () => {
    for (const headers of <Record<string, string>[]>[
      { origin: ALLOWED, 'sec-fetch-site': 'same-site' },
      { origin: 'http://localhost:3001' },
      {}, // the Next server, which sends no Origin
    ]) {
      const response = await post('/auth/logout', headers);
      // Past the check; with no database the handler itself may answer 501.
      expect(response.statusCode, JSON.stringify(headers)).not.toBe(403);
      expect(response.body).not.toContain('CSRF_REJECTED');
    }
  });

  it('leaves HSTS to nginx — the API sends none of its own', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('does not touch reads', async () => {
    const response = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://evil.example' } });
    expect(response.statusCode).toBe(200);
  });

  it('gives a foreign origin no CORS grant to read a response', async () => {
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: `${API_PREFIX}/me`,
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });
});
