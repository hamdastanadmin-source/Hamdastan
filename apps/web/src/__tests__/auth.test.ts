import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Covers the auth skeleton in `src/lib/auth.ts`. When that module is swapped
 * for a real user store these tests should keep passing unchanged — they only
 * exercise the exported contract, not the in-memory implementation.
 */

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
}));

async function importAuth() {
  // Re-imported per test so the module-level session map starts empty and
  // SKIP_AUTH is read fresh from the environment.
  vi.resetModules();
  delete (globalThis as { __hamdastanSessions?: unknown }).__hamdastanSessions;
  return import('@/features/auth/services/session.service');
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue(undefined);
  vi.stubEnv('SKIP_AUTH', 'false');
});

describe('login', () => {
  it('accepts a valid credential pair and sets a session cookie', async () => {
    const { login } = await importAuth();

    const result = await login('admin', 'admin123');

    expect(result).toEqual({ success: true });
    expect(cookieStore.set).toHaveBeenCalledOnce();

    const [name, token, options] = cookieStore.set.mock.calls[0];
    expect(name).toBe('session');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
  });

  it('rejects a wrong password without setting a cookie', async () => {
    const { login } = await importAuth();

    const result = await login('admin', 'wrong-password');

    expect(result.success).toBe(false);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it('gives the same error for an unknown user, so usernames do not leak', async () => {
    const { login } = await importAuth();

    const unknownUser = await login('nobody', 'admin123');
    const wrongPassword = await login('admin', 'wrong-password');

    expect(unknownUser.error).toBe(wrongPassword.error);
  });
});

describe('getSession', () => {
  it('returns null when no session cookie is present', async () => {
    const { getSession } = await importAuth();

    await expect(getSession()).resolves.toBeNull();
  });

  it('returns null for a token that was never issued', async () => {
    const { getSession } = await importAuth();
    cookieStore.get.mockReturnValue({ value: 'not-a-real-token' });

    await expect(getSession()).resolves.toBeNull();
  });

  it('resolves the user for a token issued by login, without the password', async () => {
    const { login, getSession } = await importAuth();

    await login('analyst', 'analyst123');
    const [, token] = cookieStore.set.mock.calls[0];
    cookieStore.get.mockReturnValue({ value: token });

    const user = await getSession();

    expect(user).toEqual({
      id: 'mock-analyst-id',
      username: 'analyst',
      fullName: 'کاربر تحلیل‌گر',
      role: 'ANALYST',
      isActive: true,
    });
    expect(user).not.toHaveProperty('password');
  });

  it('returns the mock admin without a cookie when SKIP_AUTH is on', async () => {
    vi.stubEnv('SKIP_AUTH', 'true');
    const { getSession } = await importAuth();

    await expect(getSession()).resolves.toMatchObject({
      username: 'admin',
      role: 'ADMIN',
    });
  });
});

describe('logout', () => {
  it('invalidates the session so the token no longer resolves', async () => {
    const { login, logout, getSession } = await importAuth();

    await login('admin', 'admin123');
    const [, token] = cookieStore.set.mock.calls[0];
    cookieStore.get.mockReturnValue({ value: token });

    await logout();
    expect(cookieStore.delete).toHaveBeenCalledWith('session');

    // The cookie is gone client-side, but the server must also have dropped
    // the token — otherwise a replayed cookie would still authenticate.
    await expect(getSession()).resolves.toBeNull();
  });
});
