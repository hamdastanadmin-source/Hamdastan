import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * An expired access token in the middle of a long screen: the client renews
 * the session once and sends the request again — and requests that fail
 * together share that one renewal, because a refresh token is single-use.
 */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const UNAUTHORIZED = { ok: false, error: { code: 'UNAUTHORIZED', message: 'برای این درخواست باید وارد شوید' } };

describe('apiClient on a 401', () => {
  let refreshCalls: number;
  let sessionValid: boolean;
  let refreshWorks: boolean;
  let refreshReachable: boolean;
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refreshCalls = 0;
    sessionValid = false;
    refreshWorks = true;
    refreshReachable = true;
    assign = vi.fn();
    vi.resetModules();
    vi.stubGlobal('window', { location: { assign } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/auth/refresh')) {
          refreshCalls += 1;
          if (!refreshReachable) throw new TypeError('fetch failed');
          // Slow enough that two failed calls are both waiting on it.
          await new Promise((resolve) => setTimeout(resolve, 10));
          if (!refreshWorks) return json(401, UNAUTHORIZED);
          sessionValid = true;
          return json(200, { ok: true, data: {} });
        }
        return sessionValid ? json(200, { ok: true, data: url }) : json(401, UNAUTHORIZED);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const load = async () => (await import('@/services/api-client')).apiClient;

  it('renews the session once and retries', async () => {
    const apiClient = await load();
    await expect(apiClient.put('/me/onboarding/questionnaire/answers/Q8', {})).resolves.toMatch(/Q8$/);
    expect(refreshCalls).toBe(1);
  });

  it('shares one renewal between calls that fail together', async () => {
    const apiClient = await load();
    await Promise.all([
      apiClient.put('/me/onboarding/questionnaire/answers/Q8', {}),
      apiClient.post('/me/onboarding/events', {}),
    ]);
    expect(refreshCalls).toBe(1);
  });

  it('sends a dead session to sign in, without looping', async () => {
    refreshWorks = false;
    const apiClient = await load();
    await expect(apiClient.get('/me')).rejects.toMatchObject({ status: 401 });
    expect(refreshCalls).toBe(1);
    expect(assign).toHaveBeenCalledWith('/welcome');
  });

  it('does not sign anyone out when the API cannot be reached', async () => {
    refreshReachable = false;
    const apiClient = await load();
    await expect(apiClient.get('/me')).rejects.toMatchObject({ status: 401 });
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not renew for sign-in calls', async () => {
    const apiClient = await load();
    await expect(apiClient.post('/auth/otp/verify', {})).rejects.toMatchObject({ status: 401 });
    expect(refreshCalls).toBe(0);
  });
});
