import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OTP_CODE_LENGTH } from '@hamdastan/validation';

import { mockSmsProvider } from '../../../integrations/sms';
import { AppError } from '../../../shared/errors';
import { createInMemoryAuthRepository, setAuthRepository } from '../auth.repository';
import { authService } from '../auth.service';
import { OTHER_PHONE, PHONE, PROFILE, sentCode, WRONG_CODE } from './fixtures';

/**
 * The rules of the sign-in flow, exercised through the service — the layer
 * that owns them. Storage is the in-memory port implementation, and the code
 * is read back from the mock provider's outbox, which is the only thing here
 * that a real client could not do.
 */

/** From vitest.config.ts, so the numbers below are not guesses. */
const TTL_SECONDS = 120;
const MAX_ATTEMPTS = 5;
const MAX_SENDS = 5;

const NOW = new Date('2026-01-01T10:00:00.000Z');

/** Walks a brand-new number all the way to a verified user. */
async function createVerifiedUser(phone = PHONE) {
  await authService.register({ phone, ...PROFILE });
  return authService.verifyOtp(phone, sentCode(phone));
}

/** Asserts the thrown error is an AppError carrying this code. */
async function expectFailure(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => {
      throw new Error(`expected a rejection with code ${code}`);
    },
    (caught: unknown) => caught
  );

  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mockSmsProvider.clear();
  setAuthRepository(createInMemoryAuthRepository());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checkPhone', () => {
  it('reports an unknown number as not registered', async () => {
    await expect(authService.checkPhone(PHONE)).resolves.toEqual({ registered: false });
  });

  it('reports a verified number as registered', async () => {
    await createVerifiedUser();

    await expect(authService.checkPhone(PHONE)).resolves.toEqual({ registered: true });
  });
});

describe('registration', () => {
  it('sends a code without creating a user', async () => {
    const challenge = await authService.register({ phone: PHONE, ...PROFILE });

    expect(challenge.purpose).toBe('REGISTER');
    expect(sentCode()).toMatch(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`));
    // Submitting the form is not enough to exist.
    await expect(authService.checkPhone(PHONE)).resolves.toEqual({ registered: false });
  });

  it('creates the user only once the code is verified', async () => {
    const { user } = await createVerifiedUser();

    expect(user).toMatchObject({
      phone: PHONE,
      firstName: 'امید',
      lastName: 'بهشتی',
      fullName: 'امید بهشتی',
      birthDate: '1990-05-20',
      gender: 'MALE',
      role: 'USER',
      isActive: true,
    });
    expect(user.id).toBeTruthy();
  });

  it('refuses to register a number that already has an account', async () => {
    await createVerifiedUser();

    await expectFailure(
      authService.register({ phone: PHONE, ...PROFILE }),
      'PHONE_ALREADY_REGISTERED'
    );
  });
});

describe('sendOtp', () => {
  it('issues a sign-in code for a registered number', async () => {
    await createVerifiedUser();
    vi.advanceTimersByTime(TTL_SECONDS * 1000);

    const challenge = await authService.sendOtp(PHONE);

    expect(challenge.purpose).toBe('LOGIN');
    expect(challenge.attemptsRemaining).toBe(MAX_ATTEMPTS);
  });

  it('refuses an unknown number instead of sending a code into the void', async () => {
    await expectFailure(authService.sendOtp(PHONE), 'PHONE_NOT_REGISTERED');
  });

  it('carries the registration draft forward when a new user resends', async () => {
    await authService.register({ phone: PHONE, ...PROFILE });
    vi.advanceTimersByTime(TTL_SECONDS * 1000);

    const resent = await authService.sendOtp(PHONE);

    expect(resent.purpose).toBe('REGISTER');
    // The draft survived, so verifying the new code still creates the user.
    const { user } = await authService.verifyOtp(PHONE, sentCode());
    expect(user.fullName).toBe('امید بهشتی');
  });

  it('never returns the code when the development echo is off', async () => {
    const challenge = await authService.register({ phone: PHONE, ...PROFILE });

    expect(challenge.devCode).toBeUndefined();
    expect(JSON.stringify(challenge)).not.toContain(sentCode());
  });

  it('expires the code two minutes after it was issued', async () => {
    const challenge = await authService.register({ phone: PHONE, ...PROFILE });

    expect(new Date(challenge.expiresAt).getTime() - NOW.getTime()).toBe(
      TTL_SECONDS * 1000
    );
  });
});

describe('resend', () => {
  it('refuses a resend while the countdown is still running', async () => {
    await authService.register({ phone: PHONE, ...PROFILE });
    vi.advanceTimersByTime(30 * 1000);

    await expectFailure(authService.sendOtp(PHONE), 'OTP_RESEND_COOLDOWN');
  });

  it('allows a resend once the countdown ends, and invalidates the old code', async () => {
    await authService.register({ phone: PHONE, ...PROFILE });
    const firstCode = sentCode();

    vi.advanceTimersByTime(TTL_SECONDS * 1000);
    await authService.sendOtp(PHONE);
    const secondCode = sentCode();

    expect(secondCode).not.toBe(firstCode);
    await expectFailure(authService.verifyOtp(PHONE, firstCode), 'OTP_INVALID');
    await expect(authService.verifyOtp(PHONE, secondCode)).resolves.toMatchObject({
      user: { phone: PHONE },
    });
  });

  it('gives a resent code a fresh set of attempts', async () => {
    await authService.register({ phone: PHONE, ...PROFILE });
    await expectFailure(authService.verifyOtp(PHONE, WRONG_CODE), 'OTP_INVALID');

    vi.advanceTimersByTime(TTL_SECONDS * 1000);
    const resent = await authService.sendOtp(PHONE);

    expect(resent.attemptsRemaining).toBe(MAX_ATTEMPTS);
  });

  it('stops sending once the per-window limit is reached', async () => {
    await authService.register({ phone: PHONE, ...PROFILE });

    for (let sent = 1; sent < MAX_SENDS; sent += 1) {
      vi.advanceTimersByTime(TTL_SECONDS * 1000);
      await authService.sendOtp(PHONE);
    }

    vi.advanceTimersByTime(TTL_SECONDS * 1000);
    await expectFailure(authService.sendOtp(PHONE), 'OTP_RESEND_LIMIT');
  });
});

describe('verifyOtp', () => {
  it('counts a wrong code and says how many tries are left', async () => {
    await authService.register({ phone: PHONE, ...PROFILE });

    await expect(authService.verifyOtp(PHONE, WRONG_CODE)).rejects.toMatchObject({
      code: 'OTP_INVALID',
      details: { attemptsRemaining: MAX_ATTEMPTS - 1 },
    });
  });

  it('locks the challenge after too many wrong codes, even for the right one', async () => {
    await authService.register({ phone: PHONE, ...PROFILE });
    const code = sentCode();

    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      await expectFailure(authService.verifyOtp(PHONE, WRONG_CODE), 'OTP_INVALID');
    }
    await expectFailure(authService.verifyOtp(PHONE, WRONG_CODE), 'OTP_TOO_MANY_ATTEMPTS');

    await expectFailure(authService.verifyOtp(PHONE, code), 'OTP_TOO_MANY_ATTEMPTS');
  });

  it('rejects a code that has expired', async () => {
    await authService.register({ phone: PHONE, ...PROFILE });
    const code = sentCode();

    vi.advanceTimersByTime(TTL_SECONDS * 1000 + 1);

    await expectFailure(authService.verifyOtp(PHONE, code), 'OTP_EXPIRED');
  });

  it('will not accept the same code twice', async () => {
    await createVerifiedUser();
    const usedCode = sentCode();

    await expectFailure(authService.verifyOtp(PHONE, usedCode), 'OTP_NOT_FOUND');
  });

  it('rejects a code issued for a different number', async () => {
    await createVerifiedUser(OTHER_PHONE);
    await authService.register({ phone: PHONE, ...PROFILE });

    await expectFailure(
      authService.verifyOtp(PHONE, sentCode(OTHER_PHONE)),
      'OTP_INVALID'
    );
  });

  it('reports a number with no live challenge rather than guessing', async () => {
    await expectFailure(authService.verifyOtp(PHONE, WRONG_CODE), 'OTP_NOT_FOUND');
  });
});

describe('cancelChallenge', () => {
  it('kills the code in flight, which is what editing the number does', async () => {
    await authService.register({ phone: PHONE, ...PROFILE });
    const code = sentCode();

    await authService.cancelChallenge(PHONE);

    await expectFailure(authService.verifyOtp(PHONE, code), 'OTP_NOT_FOUND');
  });

  it('frees the number to start again immediately, with no cooldown', async () => {
    await authService.register({ phone: PHONE, ...PROFILE });
    await authService.cancelChallenge(PHONE);

    const fresh = await authService.register({ phone: PHONE, ...PROFILE });

    expect(fresh.purpose).toBe('REGISTER');
  });
});

describe('sessions', () => {
  it('resolves the token it issued back to the user', async () => {
    const { token, user } = await createVerifiedUser();

    await expect(authService.getSessionUser(token)).resolves.toEqual(user);
  });

  it('does not resolve a token it never issued', async () => {
    await expect(authService.getSessionUser('not-a-real-token')).resolves.toBeNull();
  });

  it('stops resolving a token once it expires', async () => {
    const { token } = await createVerifiedUser();

    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

    await expect(authService.getSessionUser(token)).resolves.toBeNull();
  });

  it('invalidates the token on logout, so a replayed cookie is worthless', async () => {
    const { token } = await createVerifiedUser();

    await authService.logout(token);

    await expect(authService.getSessionUser(token)).resolves.toBeNull();
  });

  it('signs an existing user in on a second device without touching the first', async () => {
    const first = await createVerifiedUser();

    vi.advanceTimersByTime(TTL_SECONDS * 1000);
    await authService.sendOtp(PHONE);
    const second = await authService.verifyOtp(PHONE, sentCode());

    expect(second.token).not.toBe(first.token);
    expect(second.user.id).toBe(first.user.id);
    await expect(authService.getSessionUser(first.token)).resolves.toEqual(first.user);
  });
});
