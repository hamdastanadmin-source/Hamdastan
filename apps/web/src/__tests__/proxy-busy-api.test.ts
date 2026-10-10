import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION } from '@hamdastan/config';

/**
 * A rate-limited or unavailable API says nothing about the session. The
 * proxy must not refresh on it (a refresh token is single-use) and must not
 * sign the visitor out because of it — only a 401 means the session is over.
 */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const FAIL = (code: string) => ({ ok: false, error: { code, message: code } });
const COOKIE = `${SESSION.ACCESS_COOKIE}=a; ${SESSION.REFRESH_COOKIE}=r`;

describe('proxy with a busy API', () => {
  let meStatus: number;
  let refreshStatus: number;
  let refreshCalls: number;

  beforeEach(() => {
    refreshCalls = 0;
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/auth/refresh')) {
          refreshCalls += 1;
          return json(refreshStatus, FAIL('REFRESH'));
        }
        return json(meStatus, FAIL('ME'));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const run = async () => {
    const { proxy } = await import('@/proxy');
    return proxy(new NextRequest('http://localhost/profile', { headers: { cookie: COOKIE } }));
  };

  const clearsCookies = (response: Response) =>
    (response.headers.get('set-cookie') ?? '').includes(`${SESSION.REFRESH_COOKIE}=;`);

  it.each([429, 503])('does not refresh, or sign out, when /me answers %i', async (status) => {
    meStatus = status;
    const response = await run();
    expect(refreshCalls).toBe(0);
    expect(response.status).not.toBe(307);
    expect(clearsCookies(response)).toBe(false);
  });

  it.each([429, 503])('keeps the session when the refresh itself answers %i', async (status) => {
    meStatus = 401;
    refreshStatus = status;
    const response = await run();
    expect(refreshCalls).toBe(1);
    expect(response.headers.get('location')).toBeNull();
    expect(clearsCookies(response)).toBe(false);
  });

  it('signs out only when the refresh is refused with a 401', async () => {
    meStatus = 401;
    refreshStatus = 401;
    const response = await run();
    expect(response.headers.get('location')).toMatch(/\/welcome$/);
  });
});
