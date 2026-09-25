import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@hamdastan/shared';

/**
 * The web app's half of authentication.
 *
 * Users, codes and sessions all live in `apps/api`, and its own rules are
 * tested there. What is left on this side is the adapter that turns a session
 * cookie into a user, and the helpers that turn a backend answer into
 * something renderable — so that is what these cover.
 */

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
}));

const session = vi.fn();
vi.mock('../services/auth.api', () => ({
  authApi: {
    session: (...args: unknown[]) => session(...args),
  },
}));

const USER = {
  id: 'user-1',
  phone: '09123456789',
  firstName: 'امید',
  lastName: 'بهشتی',
  fullName: 'امید بهشتی',
  birthDate: '1990-05-20',
  gender: 'MALE' as const,
  role: 'USER' as const,
  isActive: true,
};

async function importSessionService() {
  // Re-imported per test so React's request-scoped cache starts empty.
  vi.resetModules();
  return import('../services/session.service');
}

function unauthorized() {
  return new HttpError(401, { code: 'UNAUTHORIZED', message: 'برای این درخواست باید وارد شوید' });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue(undefined);
});

describe('getSession', () => {
  it('returns null without asking the backend when there is no cookie', async () => {
    const { getSession } = await importSessionService();

    await expect(getSession()).resolves.toBeNull();
    expect(session).not.toHaveBeenCalled();
  });

  it('forwards the cookie token and returns the user the backend resolves', async () => {
    cookieStore.get.mockReturnValue({ value: 'token-abc' });
    session.mockResolvedValue({ user: USER });

    const { getSession } = await importSessionService();

    await expect(getSession()).resolves.toEqual(USER);
    expect(session).toHaveBeenCalledWith('token-abc');
  });

  it('returns null for a cookie the backend rejects', async () => {
    cookieStore.get.mockReturnValue({ value: 'stale-token' });
    session.mockRejectedValue(unauthorized());

    const { getSession } = await importSessionService();

    await expect(getSession()).resolves.toBeNull();
  });

  it('treats an unreachable backend as signed out rather than crashing the page', async () => {
    cookieStore.get.mockReturnValue({ value: 'token-abc' });
    session.mockRejectedValue(new TypeError('fetch failed'));

    const { getSession } = await importSessionService();

    await expect(getSession()).resolves.toBeNull();
  });

  it('never hands back a token — only the user', async () => {
    cookieStore.get.mockReturnValue({ value: 'token-abc' });
    session.mockResolvedValue({ user: USER });

    const { getSession } = await importSessionService();
    const user = await getSession();

    expect(user).not.toHaveProperty('token');
  });
});

describe('requireAuth', () => {
  it('returns the user when there is a session', async () => {
    cookieStore.get.mockReturnValue({ value: 'token-abc' });
    session.mockResolvedValue({ user: USER });

    const { requireAuth } = await importSessionService();

    await expect(requireAuth()).resolves.toEqual(USER);
  });

  it('sends an anonymous visitor to the login page', async () => {
    const { requireAuth } = await importSessionService();

    // The test setup makes next/navigation's redirect throw, as it does in Next.
    await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT:/login');
  });
});

describe('requireAdmin', () => {
  it('lets an admin through', async () => {
    cookieStore.get.mockReturnValue({ value: 'token-abc' });
    session.mockResolvedValue({ user: { ...USER, role: 'ADMIN' } });

    const { requireAdmin } = await importSessionService();

    await expect(requireAdmin()).resolves.toMatchObject({ role: 'ADMIN' });
  });

  it('bounces an ordinary user home instead of showing them the page', async () => {
    cookieStore.get.mockReturnValue({ value: 'token-abc' });
    session.mockResolvedValue({ user: USER });

    const { requireAdmin } = await importSessionService();

    await expect(requireAdmin()).rejects.toThrow('NEXT_REDIRECT:/');
  });
});
