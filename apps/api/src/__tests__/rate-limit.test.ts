import type { FastifyInstance, InjectOptions } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_PREFIX, SESSION } from '@hamdastan/config';

import { measure, slidingWindowStore } from '../middleware/rate-limit-store';

/**
 * Rate limiting, and the trusted-proxy rule every per-address limit rests on.
 *
 * `config/env.ts` is read once per module graph, so each scenario sets its
 * environment and builds a fresh app from a reset module registry. Most of
 * this needs no database: the limit is checked before a handler would reach
 * one. The per-user case signs in, and skips without TEST_DATABASE_URL.
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

const apps: FastifyInstance[] = [];
const baseline = { ...process.env };

async function load(overrides: Record<string, string>): Promise<FastifyInstance> {
  vi.resetModules();
  Object.assign(process.env, {
    RATE_LIMIT_ENABLED: 'true',
    TRUST_PROXY: '',
    ...overrides,
  });
  const { buildApp } = await import('../app');
  const app = await buildApp();
  await app.ready();
  apps.push(app);
  return app;
}

afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
  // Back to exactly what setup.ts left, so no override leaks into the next case.
  for (const key of Object.keys(process.env)) if (!(key in baseline)) delete process.env[key];
  Object.assign(process.env, baseline);
});

const logout = (app: FastifyInstance, extra: Omit<InjectOptions, 'method' | 'url'> = {}) =>
  app.inject({ method: 'POST', url: `${API_PREFIX}/auth/logout`, ...extra });

describe('the sliding-window store', () => {
  const MINUTE = 60_000;

  it('weights the previous window by how much of it still overlaps', () => {
    // Halfway through a window, after 10 requests last window and 2 in this one.
    const result = measure({ windowStart: 0, previous: 10, current: 2 }, MINUTE / 2, MINUTE, 10);
    expect(result.current).toBe(7); // 10 × 0.5 + 2
  });

  it('does not admit twice the limit across a window boundary', () => {
    const Store = slidingWindowStore(100);
    const store = new Store();
    const now = vi.spyOn(Date, 'now');
    const results: number[] = [];
    const incr = () =>
      store.incr('k', (_error, result) => results.push(result.current), MINUTE, 5);

    now.mockReturnValue(MINUTE - 1); // the last millisecond of a window
    for (let i = 0; i < 5; i += 1) incr();
    now.mockReturnValue(MINUTE + 1); // the first of the next
    incr();
    now.mockRestore();

    // A fixed window would have reset to 1 here.
    expect(results.at(-1)).toBeGreaterThan(5);
  });

  it('says how long until one more request fits', () => {
    // Over the limit in the current window: wait for the next, and then some.
    const result = measure({ windowStart: 0, previous: 0, current: 6 }, 10_000, MINUTE, 5);
    expect(result.ttl).toBeGreaterThan(MINUTE - 10_000);
  });

  it('forgets the least recently used key beyond its capacity', () => {
    const Store = slidingWindowStore(2);
    const store = new Store();
    const seen: number[] = [];
    const incr = (key: string) => store.incr(key, (_e, r) => seen.push(r.current), MINUTE, 100);
    incr('a');
    incr('b');
    incr('c'); // evicts a
    incr('a');
    expect(seen.at(-1)).toBe(1);
  });
});

describe('rate limits', () => {
  it('answer 429 with Retry-After and the API envelope once the budget is spent', async () => {
    const app = await load({ RATE_LIMIT_ANONYMOUS_PER_MINUTE: '3' });

    for (let i = 0; i < 3; i += 1) expect((await logout(app)).statusCode).toBe(200);

    const refused = await logout(app);
    expect(refused.statusCode).toBe(429);
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    expect(refused.headers['x-ratelimit-limit']).toBe('3');
    expect(refused.json()).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED', details: { retryAfter: expect.any(Number) } },
    });
  });

  it('never limit the health probe', async () => {
    const app = await load({ RATE_LIMIT_ANONYMOUS_PER_MINUTE: '1' });
    for (let i = 0; i < 5; i += 1) {
      expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    }
  });

  it('are off entirely with RATE_LIMIT_ENABLED=false', async () => {
    const app = await load({ RATE_LIMIT_ENABLED: 'false', RATE_LIMIT_ANONYMOUS_PER_MINUTE: '1' });
    for (let i = 0; i < 3; i += 1) expect((await logout(app)).statusCode).toBe(200);
  });

  it('count refresh per token, so one client racing itself does not limit another', async () => {
    const app = await load({ RATE_LIMIT_REFRESH_PER_MINUTE: '2' });
    const refresh = (token: string) =>
      app.inject({
        method: 'POST',
        url: `${API_PREFIX}/auth/refresh`,
        cookies: { [SESSION.REFRESH_COOKIE]: token },
      });

    // No database here, so a token that gets past the limit is a 501 — the
    // point is only which request is refused before reaching it.
    expect((await refresh('token-a')).statusCode).not.toBe(429);
    expect((await refresh('token-a')).statusCode).not.toBe(429);
    expect((await refresh('token-a')).statusCode).toBe(429);
    expect((await refresh('token-b')).statusCode).not.toBe(429);
  });

  it('cap code verification per address', async () => {
    const app = await load({ RATE_LIMIT_OTP_VERIFY_PER_15_MINUTES: '2' });
    const verify = (phone: string) =>
      app.inject({
        method: 'POST',
        url: `${API_PREFIX}/auth/otp/verify`,
        payload: { phone, code: '123456' },
      });

    // Different numbers, one address: the per-address cap still applies.
    expect((await verify('09990000001')).statusCode).not.toBe(429);
    expect((await verify('09990000002')).statusCode).not.toBe(429);
    const refused = await verify('09990000003');
    expect(refused.statusCode).toBe(429);
    expect(refused.headers['retry-after']).toBeDefined();
  });
});

describe('the request id', () => {
  it("adopts nginx's id, refuses a malformed one, and echoes it", async () => {
    const app = await load({});
    const ok = await logout(app, { headers: { 'x-request-id': '0123456789abcdef0123456789abcdef' } });
    expect(ok.headers['x-request-id']).toBe('0123456789abcdef0123456789abcdef');

    const forged = await logout(app, { headers: { 'x-request-id': 'bad id; drop table' } });
    expect(forged.headers['x-request-id']).not.toBe('bad id; drop table');
    expect(forged.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('the client address', () => {
  it('ignores X-Forwarded-For when no proxy is trusted', async () => {
    const app = await load({ RATE_LIMIT_ANONYMOUS_PER_MINUTE: '2', TRUST_PROXY: '' });
    const spoofed = (n: number) => logout(app, { headers: { 'x-forwarded-for': `198.51.100.${n}` } });

    expect((await spoofed(1)).statusCode).toBe(200);
    expect((await spoofed(2)).statusCode).toBe(200);
    // A new forged address every time, and still one budget: the socket's.
    expect((await spoofed(3)).statusCode).toBe(429);
  });

  it('believes X-Forwarded-For from the trusted proxy, and only from it', async () => {
    const app = await load({ RATE_LIMIT_ANONYMOUS_PER_MINUTE: '1', TRUST_PROXY: '10.250.250.2' });
    const via = (remoteAddress: string, client: string) =>
      logout(app, { remoteAddress, headers: { 'x-forwarded-for': client } });

    // Through nginx: each real client has its own budget.
    expect((await via('10.250.250.2', '203.0.113.1')).statusCode).toBe(200);
    expect((await via('10.250.250.2', '203.0.113.2')).statusCode).toBe(200);
    expect((await via('10.250.250.2', '203.0.113.1')).statusCode).toBe(429);

    // From anywhere else — the web container, say — the header is not
    // believed, so forging it buys nothing.
    expect((await via('10.0.0.7', '203.0.113.50')).statusCode).toBe(200);
    expect((await via('10.0.0.7', '203.0.113.51')).statusCode).toBe(429);
  });

  it('refuses a TRUST_PROXY that would trust everyone', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as never);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.resetModules();
    process.env.TRUST_PROXY = 'true';
    await expect(import('../config/env')).rejects.toThrow('exit 1');

    exit.mockRestore();
    error.mockRestore();
  });
});

describe.skipIf(!hasDatabase)('per-account limits', () => {
  it('give each signed-in user a budget of their own behind one address', async () => {
    const app = await load({ RATE_LIMIT_USER_READ_PER_MINUTE: '2' });
    const data = await import('../data');
    const auth = await import('../modules/auth');
    const users = await import('../modules/users');

    await data.runMigrations();
    users.setUsersRepository(users.sqlUsersRepository);
    auth.setAuthRepository(auth.sqlAuthRepository);
    auth.setSmsSender({ name: 'test', async sendOtp() {} });

    async function signIn(phone: string) {
      const requested = await app.inject({ method: 'POST', url: `${API_PREFIX}/auth/otp/request`, payload: { phone } });
      expect(requested.statusCode, requested.body).toBe(200);
      const code = requested.json().data.debugCode as string;
      const verified = await app.inject({ method: 'POST', url: `${API_PREFIX}/auth/otp/verify`, payload: { phone, code } });
      return Object.fromEntries(verified.cookies.map(({ name, value }) => [name, value]));
    }
    const me = (cookies: Record<string, string>) =>
      app.inject({ method: 'GET', url: `${API_PREFIX}/me`, cookies });

    const stamp = String(Date.now() % 100_000).padStart(5, '0');
    const alice = await signIn(`099981${stamp}`);
    const bob = await signIn(`099982${stamp}`);

    expect((await me(alice)).statusCode).toBe(200);
    expect((await me(alice)).statusCode).toBe(200);
    expect((await me(alice)).statusCode).toBe(429);
    // Same address, different person: unaffected.
    expect((await me(bob)).statusCode).toBe(200);

    await data.closePool();
  });
});
