import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION } from '@hamdastan/config';

import { SESSION_HANDOFF_HEADER, decodeSessionHandoff } from '@/lib';

/**
 * The proxy reads the session once and hands it to the render, so the root
 * layout does not ask `GET /me` again. Only the proxy may set the handoff,
 * and after a refresh the render must see the rotated cookies, not the
 * spent ones.
 */

const SESSION_BODY = {
  user: { id: 'u1', phone: '09120000000', firstName: 'سارا', lastName: 'احمدی', birthDate: '1996-09-05', gender: 'female', displayName: 'سارا', role: 'USER' },
  nextStep: 'home',
};

const json = (status: number, body: unknown, setCookie: string[] = []) => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  for (const cookie of setCookie) headers.append('set-cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
};

const UNAUTHORIZED = { ok: false, error: { code: 'UNAUTHORIZED', message: '' } };

/** What the page will render with, as the proxy's response describes it. */
const forwarded = (response: Response, name: string) =>
  response.headers.get(`x-middleware-request-${name}`);

describe('proxy session handoff', () => {
  let accessValid: boolean;
  let meCalls: number;

  beforeEach(() => {
    accessValid = true;
    meCalls = 0;
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/auth/refresh')) {
          return json(200, { ok: true, data: SESSION_BODY }, [
            `${SESSION.ACCESS_COOKIE}=fresh-access; Path=/; HttpOnly`,
            `${SESSION.REFRESH_COOKIE}=fresh-refresh; Path=/; HttpOnly`,
          ]);
        }
        meCalls += 1;
        return accessValid ? json(200, { ok: true, data: SESSION_BODY }) : json(401, UNAUTHORIZED);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const run = async (path: string, headers: Record<string, string>) => {
    const { proxy } = await import('@/proxy');
    return proxy(new NextRequest(`http://localhost${path}`, { headers }));
  };

  it('hands the session it read on to the page', async () => {
    const response = await run('/profile', {
      cookie: `${SESSION.ACCESS_COOKIE}=a; ${SESSION.REFRESH_COOKIE}=r`,
    });
    expect(meCalls).toBe(1);
    expect(decodeSessionHandoff(forwarded(response, SESSION_HANDOFF_HEADER))).toEqual(SESSION_BODY);
  });

  it('drops a handoff the browser sent, with or without a session', async () => {
    const forged = encodeURIComponent(JSON.stringify({ ...SESSION_BODY, user: { ...SESSION_BODY.user, role: 'ADMIN' } }));

    const signedOut = await run('/welcome', { [SESSION_HANDOFF_HEADER]: forged });
    expect(forwarded(signedOut, SESSION_HANDOFF_HEADER)).toBeNull();
    expect(signedOut.headers.get('x-middleware-override-headers')).not.toContain(SESSION_HANDOFF_HEADER);

    const signedIn = await run('/profile', {
      cookie: `${SESSION.ACCESS_COOKIE}=a`,
      [SESSION_HANDOFF_HEADER]: forged,
    });
    expect(decodeSessionHandoff(forwarded(signedIn, SESSION_HANDOFF_HEADER))?.user.role).toBe('USER');
  });

  it('renders with the rotated cookies after a refresh', async () => {
    accessValid = false;
    const response = await run('/profile', {
      cookie: `${SESSION.ACCESS_COOKIE}=spent; ${SESSION.REFRESH_COOKIE}=old; theme=dark`,
    });

    const cookie = forwarded(response, 'cookie') ?? '';
    expect(cookie).toContain(`${SESSION.ACCESS_COOKIE}=fresh-access`);
    expect(cookie).toContain(`${SESSION.REFRESH_COOKIE}=fresh-refresh`);
    expect(cookie).toContain('theme=dark');
    expect(cookie).not.toContain('spent');
    // The browser is given them too.
    expect(response.headers.getSetCookie().join()).toContain('fresh-access');
  });
});
