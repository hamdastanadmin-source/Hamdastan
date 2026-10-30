import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION } from '@hamdastan/config';

/**
 * An invitation is a link to a journey or an event. Someone who must first
 * sign in, or finish their profile and onboarding, is brought back to it
 * afterwards — once, from home or the door, and only ever to an activity's
 * or an event's own address.
 */

const JOURNEY = '/activities/8f14e45f-ceea-467a-9f2b-1c3d5e7f9a0b';
const signedIn = `${SESSION.ACCESS_COOKIE}=a; ${SESSION.REFRESH_COOKIE}=r`;

const session = (nextStep: string) => ({
  user: { id: 'u1', phone: '09120000000', firstName: 'سارا', lastName: 'احمدی', birthDate: '1996-09-05', gender: 'female', displayName: 'سارا', role: 'USER' },
  nextStep,
});

let step = 'home';

beforeEach(() => {
  step = 'home';
  vi.resetModules();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ ok: true, data: session(step) }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  );
});

afterEach(() => vi.unstubAllGlobals());

async function run(path: string, cookie = '') {
  const { proxy } = await import('@/proxy');
  return proxy(new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie } : {} }));
}

const location = (response: Response) => new URL(response.headers.get('location') ?? 'http://localhost/').pathname;
const returnCookie = (response: Response) => response.headers.getSetCookie().find((c) => c.startsWith('hd_return_to='));

describe('the way back from an invitation', () => {
  it('remembers the journey when a stranger is sent to the door', async () => {
    const response = await run(JOURNEY);
    expect(location(response)).toBe('/landing');
    expect(decodeURIComponent(returnCookie(response) ?? '')).toContain(`hd_return_to=${JOURNEY}`);
    expect(returnCookie(response)).toContain('HttpOnly');
  });

  it('remembers it for an account sent to finish onboarding', async () => {
    step = 'onboarding';
    const response = await run(JOURNEY, signedIn);
    expect(location(response)).toBe('/onboarding');
    expect(returnCookie(response)).toBeDefined();
  });

  it('brings a finished account from home to the journey, once', async () => {
    const response = await run('/', `${signedIn}; hd_return_to=${JOURNEY}`);
    expect(location(response)).toBe(JOURNEY);
    expect(returnCookie(response)).toMatch(/hd_return_to=;|Max-Age=0|Expires=Thu, 01 Jan 1970/);
  });

  it('does not take someone off a page they chose', async () => {
    const response = await run('/profile', `${signedIn}; hd_return_to=${JOURNEY}`);
    expect(response.headers.get('location')).toBeNull();
  });

  it('remembers an event’s page the same way', async () => {
    const response = await run('/events/hogwarts-music-night');
    expect(location(response)).toBe('/landing');
    expect(decodeURIComponent(returnCookie(response) ?? '')).toContain('hd_return_to=/events/hogwarts-music-night');
  });

  it('remembers a world’s and an article’s page the same way', async () => {
    for (const path of ['/worlds/hogwarts', '/articles/news-1a2b3c4d']) {
      const response = await run(path);
      expect(location(response)).toBe('/landing');
      expect(decodeURIComponent(returnCookie(response) ?? '')).toContain(`hd_return_to=${path}`);
    }
  });

  it('never remembers or follows anything but an activity’s, event’s, world’s or article’s address', async () => {
    expect(returnCookie(await run('/profile'))).toBeUndefined();
    expect(returnCookie(await run('/events/../profile'))).toBeUndefined();
    expect(returnCookie(await run('/worlds/hogwarts/../../profile'))).toBeUndefined();
    const response = await run('/', `${signedIn}; hd_return_to=https://evil.example`);
    expect(response.headers.get('location')).toBeNull();
  });
});
