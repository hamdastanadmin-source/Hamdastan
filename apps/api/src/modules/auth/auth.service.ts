import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

import type {
  AuthUser,
  CheckPhoneResponse,
  OtpChallenge,
  OtpPurpose,
} from '@hamdastan/types';
import { OTP_CODE_LENGTH, type RegisterInput } from '@hamdastan/validation';

import { env } from '../../config';
import { OtpDeliveryError, otpProvider } from '../../integrations';
import {
  BadRequestError,
  ForbiddenError,
  TooManyRequestsError,
  UpstreamUnavailableError,
} from '../../shared/errors';
import { authRepository } from './auth.repository';
import type {
  IssuedSession,
  OtpChallengeRecord,
  RegistrationDraft,
  UserRecord,
} from './auth.types';

/**
 * Business logic for the Auth module — ورود با شماره موبایل و کد یک‌بارمصرف.
 *
 * The rules that live here and nowhere else:
 *
 *   - a code is generated in this process, by `randomInt`, and never accepted
 *     from a client
 *   - only its hash is stored, so a leaked store cannot be replayed
 *   - a code lives for `OTP_TTL_SECONDS`, is single-use, and is invalidated by
 *     the next send, by a successful verification, and by the user editing
 *     their number
 *   - wrong guesses are counted and the challenge locks
 *   - a resend is refused until the countdown ends, and refused outright past
 *     the per-window limit
 *   - a user row is created only after the code is verified, so an
 *     unverified user cannot exist
 *
 * It knows nothing about HTTP (the controller's job), nothing about storage
 * (the repository's job) and nothing about SMS vendors (the provider's job).
 */

const SESSION_TOKEN_BYTES = 32;

/** Exclusive upper bound for a code, so `randomInt` covers every six-digit string. */
const OTP_UPPER_BOUND = 10 ** OTP_CODE_LENGTH;

function ttlMs(): number {
  return env.OTP_TTL_SECONDS * 1000;
}

function generateCode(): string {
  // randomInt is the CSPRNG; Math.random would make codes guessable.
  return String(randomInt(0, OTP_UPPER_BOUND)).padStart(OTP_CODE_LENGTH, '0');
}

/** Bound to the phone number, so a hash cannot be replayed on another number. */
function hashCode(phone: string, code: string): string {
  return createHash('sha256').update(`${phone}:${code}`).digest('hex');
}

function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function secondsUntil(date: Date, from = new Date()): number {
  return Math.max(0, Math.ceil((date.getTime() - from.getTime()) / 1000));
}

function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    birthDate: user.birthDate,
    gender: user.gender,
    role: user.role,
    isActive: user.status === 'ACTIVE',
  };
}

/**
 * Everything the client may know about a challenge, and nothing more.
 *
 * `code` is passed in by the call that just generated it rather than read back
 * from the record, because the record does not have it — that is what keeps the
 * development echo from ever becoming a stored plaintext code. A challenge
 * loaded from storage therefore cannot echo one, which is correct: only the
 * response that issues a code can show it.
 */
function toChallengeView(challenge: OtpChallengeRecord, code?: string): OtpChallenge {
  return {
    phone: challenge.phone,
    purpose: challenge.purpose,
    expiresAt: challenge.expiresAt.toISOString(),
    resendAvailableAt: challenge.resendAvailableAt.toISOString(),
    attemptsRemaining: Math.max(0, env.OTP_MAX_ATTEMPTS - challenge.attempts),
    ...(env.showDevOtp && code ? { devCode: code } : {}),
  };
}

/**
 * Generates a code, has it delivered, and stores its hash.
 *
 * Shared by the first send, a resend and registration, so the cooldown and the
 * send limit cannot be bypassed by taking a different route to a code. Nothing
 * is persisted until delivery succeeds, so a failed SMS leaves the user free
 * to try again immediately.
 */
async function issueChallenge(input: {
  phone: string;
  purpose: OtpPurpose;
  registration?: RegistrationDraft;
  existing: OtpChallengeRecord | null;
}): Promise<OtpChallenge> {
  const { phone, purpose, registration, existing } = input;
  const now = new Date();

  if (existing && now < existing.resendAvailableAt) {
    const retryAfterSeconds = secondsUntil(existing.resendAvailableAt, now);
    throw new TooManyRequestsError(
      'OTP_RESEND_COOLDOWN',
      `تا درخواست کد جدید ${retryAfterSeconds} ثانیه باقی مانده است`,
      { retryAfterSeconds }
    );
  }

  const windowMs = env.OTP_SEND_WINDOW_MINUTES * 60 * 1000;
  const windowOpen =
    existing !== null && now.getTime() - existing.windowStartedAt.getTime() < windowMs;
  const sendCount = windowOpen ? existing.sendCount + 1 : 1;

  if (windowOpen && sendCount > env.OTP_MAX_SENDS) {
    const retryAfterSeconds = secondsUntil(
      new Date(existing.windowStartedAt.getTime() + windowMs),
      now
    );
    throw new TooManyRequestsError(
      'OTP_RESEND_LIMIT',
      'تعداد درخواست کد برای این شماره بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.',
      { retryAfterSeconds }
    );
  }

  const code = generateCode();

  try {
    await otpProvider().send({
      phone,
      code,
      expiresInSeconds: env.OTP_TTL_SECONDS,
    });
  } catch (error) {
    if (error instanceof OtpDeliveryError) {
      throw new UpstreamUnavailableError(
        'OTP_DELIVERY_FAILED',
        'ارسال کد تأیید ممکن نشد. کمی بعد دوباره تلاش کنید.'
      );
    }
    throw error;
  }

  const expiresAt = new Date(now.getTime() + ttlMs());
  const challenge: OtpChallengeRecord = {
    id: existing?.id ?? randomUUID(),
    phone,
    purpose,
    codeHash: hashCode(phone, code),
    ...(registration ? { registration } : {}),
    issuedAt: now,
    expiresAt,
    // Resend opens when the countdown the user is watching runs out.
    resendAvailableAt: expiresAt,
    // A new code gets a clean slate of attempts; the previous one is now dead.
    attempts: 0,
    sendCount,
    windowStartedAt: windowOpen ? existing.windowStartedAt : now,
  };

  await authRepository().saveChallenge(challenge);

  return toChallengeView(challenge, code);
}

async function createSessionFor(user: UserRecord): Promise<IssuedSession> {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(
    Date.now() + env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  );

  await authRepository().createSession({
    token,
    userId: user.id,
    createdAt: new Date(),
    expiresAt,
  });

  return { user: toAuthUser(user), token, expiresAt };
}

/**
 * Turns a verified draft into a user.
 *
 * Private, and only reached from `verifyOtp`, which is what makes
 * `phoneVerifiedAt` truthful: there is no other path that writes a user row.
 */
async function completeRegistration(
  challenge: OtpChallengeRecord
): Promise<UserRecord> {
  const repository = authRepository();

  if (!challenge.registration) {
    throw new BadRequestError(
      'PHONE_NOT_REGISTERED',
      'اطلاعات ثبت‌نام یافت نشد. دوباره ثبت‌نام کنید.'
    );
  }

  // Two devices racing through the same registration: the first one won, and
  // the second should simply be signed in as that user.
  const existing = await repository.findUserByPhone(challenge.phone);
  if (existing) return existing;

  return repository.createUser({
    phone: challenge.phone,
    ...challenge.registration,
    role: 'USER',
    status: 'ACTIVE',
    phoneVerifiedAt: new Date(),
  });
}

export const authService = {
  /**
   * Step one of the flow: does this number belong to somebody?
   *
   * It deliberately answers plainly. The product has to branch on it — sign in
   * or register — so hiding it would only move the same signal into a
   * difference between two screens.
   */
  async checkPhone(phone: string): Promise<CheckPhoneResponse> {
    const user = await authRepository().findUserByPhone(phone);
    return { registered: user !== null };
  },

  /**
   * Sends a code, and is also the resend: calling it again replaces the
   * previous code, subject to the cooldown.
   *
   * The purpose is derived here, never taken from the client — a registered
   * number gets a sign-in code, a number partway through registration gets its
   * draft carried forward, and an unknown number is told to register.
   */
  async sendOtp(phone: string): Promise<OtpChallenge> {
    const repository = authRepository();
    const [user, existing] = await Promise.all([
      repository.findUserByPhone(phone),
      repository.findChallengeByPhone(phone),
    ]);

    if (user) {
      if (user.status !== 'ACTIVE') {
        throw new ForbiddenError('این حساب غیرفعال است', 'ACCOUNT_SUSPENDED');
      }

      return issueChallenge({ phone, purpose: 'LOGIN', existing });
    }

    if (existing?.purpose === 'REGISTER' && existing.registration) {
      return issueChallenge({
        phone,
        purpose: 'REGISTER',
        registration: existing.registration,
        existing,
      });
    }

    throw new BadRequestError(
      'PHONE_NOT_REGISTERED',
      'این شماره ثبت‌نام نشده است. ابتدا ثبت‌نام کنید.'
    );
  },

  /**
   * Takes the registration form and issues a code against it.
   *
   * No user is created here. The profile is held as a draft on the challenge,
   * so submitting this form is not by itself enough to exist in the system.
   */
  async register(input: RegisterInput): Promise<OtpChallenge> {
    const repository = authRepository();
    const { phone, ...registration } = input;

    const [user, existing] = await Promise.all([
      repository.findUserByPhone(phone),
      repository.findChallengeByPhone(phone),
    ]);

    if (user) {
      throw new BadRequestError(
        'PHONE_ALREADY_REGISTERED',
        'این شماره قبلاً ثبت‌نام شده است. وارد شوید.'
      );
    }

    return issueChallenge({ phone, purpose: 'REGISTER', registration, existing });
  },

  /**
   * The only door into the product.
   *
   * A code that is wrong, expired, already used or out of attempts fails here,
   * whatever the client believes. On success the challenge is destroyed before
   * the session is made, so one code buys exactly one sign-in.
   */
  async verifyOtp(phone: string, code: string): Promise<IssuedSession> {
    const repository = authRepository();
    const challenge = await repository.findChallengeByPhone(phone);
    const now = new Date();

    if (!challenge) {
      throw new BadRequestError(
        'OTP_NOT_FOUND',
        'کدی برای این شماره صادر نشده است. دوباره درخواست کنید.'
      );
    }

    if (challenge.expiresAt <= now) {
      throw new BadRequestError(
        'OTP_EXPIRED',
        'این کد منقضی شده است. کد جدید درخواست کنید.'
      );
    }

    if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
      throw new TooManyRequestsError(
        'OTP_TOO_MANY_ATTEMPTS',
        'تعداد تلاش‌های نادرست بیش از حد مجاز است. کد جدید درخواست کنید.'
      );
    }

    if (!hashesMatch(hashCode(phone, code), challenge.codeHash)) {
      const attempts = await repository.recordFailedAttempt(phone);
      const attemptsRemaining = env.OTP_MAX_ATTEMPTS - attempts;

      if (attemptsRemaining <= 0) {
        throw new TooManyRequestsError(
          'OTP_TOO_MANY_ATTEMPTS',
          'تعداد تلاش‌های نادرست بیش از حد مجاز است. کد جدید درخواست کنید.'
        );
      }

      throw new BadRequestError('OTP_INVALID', 'کد وارد‌شده نادرست است.', {
        attemptsRemaining,
      });
    }

    // Single use: gone before a session exists, so it cannot be replayed even
    // if the rest of this method fails.
    await repository.deleteChallengeByPhone(phone);

    const user =
      challenge.purpose === 'REGISTER'
        ? await completeRegistration(challenge)
        : await repository.findUserByPhone(phone);

    if (!user) {
      throw new BadRequestError(
        'PHONE_NOT_REGISTERED',
        'این شماره ثبت‌نام نشده است. ابتدا ثبت‌نام کنید.'
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenError('این حساب غیرفعال است', 'ACCOUNT_SUSPENDED');
    }

    return createSessionFor(user);
  },

  /**
   * Drops the live challenge — what "ویرایش شماره" does.
   *
   * The code in the user's messages stops working the moment they go back to
   * change their number, rather than staying valid for the rest of its two
   * minutes.
   */
  async cancelChallenge(phone: string): Promise<void> {
    await authRepository().deleteChallengeByPhone(phone);
  },

  /** Resolves a session cookie to its user, or null if it is no longer good. */
  async getSessionUser(token: string): Promise<AuthUser | null> {
    const repository = authRepository();
    const session = await repository.findSessionByToken(token);
    if (!session) return null;

    if (session.expiresAt <= new Date()) {
      await repository.deleteSessionByToken(token);
      return null;
    }

    const user = await repository.findUserById(session.userId);
    if (!user || user.status !== 'ACTIVE') return null;

    return toAuthUser(user);
  },

  /** Invalidates the session server-side, so a replayed cookie is worthless. */
  async logout(token: string): Promise<void> {
    await authRepository().deleteSessionByToken(token);
  },
};
