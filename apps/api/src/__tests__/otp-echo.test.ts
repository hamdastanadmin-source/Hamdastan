import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_PREFIX } from '@hamdastan/config';

/**
 * One-time codes in production fail closed: never echoed to a caller, never
 * written to a log, and with no real SMS provider not issued at all.
 */

const baseline = { ...process.env };

async function load(overrides: Record<string, string>) {
  vi.resetModules();
  Object.assign(process.env, overrides);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return import('../config/env');
}

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in baseline)) delete process.env[key];
  Object.assign(process.env, baseline);
  vi.restoreAllMocks();
});

describe('the one-time-code echo', () => {
  it('is never available in production, whatever the switch says', async () => {
    const { env } = await load({ NODE_ENV: 'production', OTP_DEBUG_DISPLAY: 'true' });
    expect(env.otpEchoAllowed).toBe(false);
  });

  it('is available in development only with the switch on', async () => {
    expect((await load({ NODE_ENV: 'development', OTP_DEBUG_DISPLAY: 'true' })).env.otpEchoAllowed).toBe(true);
    expect((await load({ NODE_ENV: 'development', OTP_DEBUG_DISPLAY: 'false' })).env.otpEchoAllowed).toBe(false);
  });

  it('is announced at boot as ignored, when set in production', async () => {
    await load({ NODE_ENV: 'production', OTP_DEBUG_DISPLAY: 'true', SMS_PROVIDER: 'console' });
    const logged = vi.mocked(console.error).mock.calls.flat().join(' ');
    expect(logged).toContain('OTP_DEBUG_DISPLAY is ignored in production');
    expect(logged).toContain('sign-in is refused');
  });

  it('masks the code in the console sender when told to', async () => {
    const { createConsoleSmsSender } = await import('../integrations');
    const info = vi.fn();
    await createConsoleSmsSender({ info } as never, { revealCode: false }).sendOtp('09121234567', '480913');
    expect(JSON.stringify(info.mock.calls)).not.toContain('480913');
  });
});

describe('a production API with no SMS provider', () => {
  it('refuses to issue a code (503), writes nothing, and never returns one', async () => {
    await load({ NODE_ENV: 'production', OTP_DEBUG_DISPLAY: 'true', SMS_PROVIDER: 'console', DATABASE_URL: '' });
    const { buildApp } = await import('../app');
    const auth = await import('../modules/auth');
    // What server.ts binds in production for `console`: nothing.
    auth.setSmsSender(null);
    // A repository that fails the test if anything reaches it.
    const touched: string[] = [];
    auth.setAuthRepository(
      new Proxy({} as never, {
        get: (_target, name) => () => {
          touched.push(String(name));
          throw new Error(`repository reached: ${String(name)}`);
        },
      })
    );

    const app = await buildApp();
    for (const url of ['/auth/otp/request', '/admin/auth/otp/request']) {
      const response = await app.inject({ method: 'POST', url: `${API_PREFIX}${url}`, payload: { phone: '09121234567' } });
      expect(response.statusCode, url).toBe(503);
      expect(response.json().error.code).toBe('SMS_UNAVAILABLE');
      expect(response.body).not.toContain('debugCode');
    }
    expect(touched).toEqual([]);
    await app.close();
  });
});
