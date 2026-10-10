import { OTP, SESSION } from '@hamdastan/config';
import type {
  OtpRequestResponse,
  OtpVerifyResponse,
  SessionResponse,
} from '@hamdastan/types';

import { env } from '../../config';
import type { SmsSender } from '../../integrations';
import { AppError, NotFoundError, UnauthorizedError } from '../../shared/errors';
import {
  generateNumericCode,
  generateToken,
  hashOtp,
  hashesMatch,
  sha256,
} from '../../shared/crypto';
import { toSession, usersService, type UserRecord } from '../users';

import { authRepository } from './auth.repository';
import type {
  ClientInfo,
  PurgeCounts,
  RetentionPolicy,
  SessionRecord,
  SessionTokens,
  TokenHashes,
} from './auth.types';

/**
 * Business logic for the Auth module — proving that someone owns a phone
 * number, and turning that proof into a session.
 *
 * Two rules shape everything below:
 *
 *   1. **The account is created the moment a code verifies**, not when the
 *      profile form is submitted. Somebody who abandons the form half-way
 *      still has a verified number on file, and comes back to the same
 *      account rather than starting again.
 *   2. **The client is told where to go; it never works it out.** Every
 *      response carries `nextStep` from `usersService`, so a half-finished
 *      account cannot be walked past by editing a URL.
 *
 * SMS delivery is a port (`SmsSender`), bound once at boot. This file does
 * not know that the provider is Kaveh-Negar, and does not change on the day
 * it becomes one.
 */

let smsSender: SmsSender | null = null;

/** Binds the SMS adapter. Called once, at boot, from `server.ts`. */
export function setSmsSender(sender: SmsSender | null): void {
  smsSender = sender;
}

/**
 * The bound sender. Unbound means there is no provider that may be used —
 * in production, `SMS_PROVIDER=console` — and sign-in fails closed: no code
 * is issued, stored or counted.
 */
function sender(): SmsSender {
  if (!smsSender) {
    throw new AppError(503, 'SMS_UNAVAILABLE', 'ارسال پیامک فعلاً ممکن نیست، کمی بعد دوباره امتحان کن');
  }
  return smsSender;
}

const seconds = (n: number) => n * 1000;

/** Rounded up, so a UI counting down never shows 0 while the server still refuses. */
function secondsUntil(when: Date, now: Date): number {
  return Math.max(0, Math.ceil((when.getTime() - now.getTime()) / 1000));
}

class RateLimitedError extends AppError {
  constructor(retryAfter: number) {
    super(429, 'OTP_RATE_LIMITED', 'درخواست‌ها زیاد بود، کمی بعد دوباره امتحان کن', {
      retryAfter,
    });
  }
}

/**
 * Refuses a number that has entered too many wrong codes lately — across
 * codes, so asking for a fresh one does not reset the count. Returns quietly
 * otherwise.
 */
async function assertNotLocked(phone: string, now: Date): Promise<void> {
  const window = await authRepository().findFailures(phone);
  if (!window || window.failures < env.OTP_MAX_FAILURES) return;

  const endsAt = new Date(window.windowStartedAt.getTime() + seconds(env.OTP_FAILURE_WINDOW_SECONDS));
  if (endsAt > now) throw lockedError(secondsUntil(endsAt, now));
}

function lockedError(retryAfter?: number): AppError {
  return new AppError(
    429,
    'OTP_LOCKED',
    'تعداد تلاش‌ها زیاد بود، کمی بعد کد جدید بگیر',
    retryAfter === undefined ? undefined : { retryAfter }
  );
}

/**
 * Mints a fresh pair and the hashes that go with it. Neither outlives
 * `capAt`, the session's absolute end.
 */
function issueTokens(now: Date, capAt?: Date): { tokens: SessionTokens; hashes: TokenHashes } {
  const capped = (at: Date) => (capAt && capAt < at ? capAt : at);
  const tokens: SessionTokens = {
    accessToken: generateToken(),
    accessExpiresAt: capped(new Date(now.getTime() + seconds(SESSION.ACCESS_TOKEN_TTL_SECONDS))),
    refreshToken: generateToken(),
    refreshExpiresAt: capped(new Date(now.getTime() + seconds(env.session.idleSeconds))),
  };

  return {
    tokens,
    hashes: {
      accessTokenHash: sha256(tokens.accessToken),
      accessExpiresAt: tokens.accessExpiresAt,
      refreshTokenHash: sha256(tokens.refreshToken),
      refreshExpiresAt: tokens.refreshExpiresAt,
    },
  };
}

/**
 * Which flow a code belongs to. `user` is the product's sign-in; `admin` is
 * the admin panel's, which shares the challenge row and the rate limits but
 * hashes the code under its own scope (see `hashOtp`).
 */
export type OtpPurpose = 'user' | 'admin';

const otpScope = (purpose: OtpPurpose) => (purpose === 'user' ? undefined : purpose);

/**
 * Checks a code and consumes it. Throws for a missing, expired, locked or
 * wrong code; returns only when the number is proven.
 *
 * A correct code is consumed whatever happens next, and five wrong ones burn
 * it. Either way the next attempt needs a new code, which is what makes a
 * six-digit secret safe to send over SMS.
 */
async function consumeOtp(phone: string, code: string, purpose: OtpPurpose): Promise<void> {
  const now = new Date();
  const repository = authRepository();
  await assertNotLocked(phone, now);
  const challenge = await repository.findChallenge(phone);

  if (!challenge) {
    throw new AppError(400, 'OTP_NOT_FOUND', 'برای این شماره کدی فرستاده نشده، کد جدید بگیر');
  }
  if (challenge.expiresAt <= now) {
    await repository.deleteChallenge(phone);
    throw new AppError(400, 'OTP_EXPIRED', 'کد منقضی شده، کد جدید بگیر');
  }
  if (challenge.attempts >= OTP.MAX_ATTEMPTS) {
    await repository.deleteChallenge(phone);
    throw lockedError();
  }

  if (!hashesMatch(challenge.codeHash, hashOtp(phone, code, otpScope(purpose)))) {
    const attempts = await repository.recordFailedAttempt(phone);
    const window = await repository.recordFailure(phone, now, env.OTP_FAILURE_WINDOW_SECONDS);

    if (window.failures >= env.OTP_MAX_FAILURES) {
      await repository.deleteChallenge(phone);
      const endsAt = new Date(window.windowStartedAt.getTime() + seconds(env.OTP_FAILURE_WINDOW_SECONDS));
      throw lockedError(secondsUntil(endsAt, now));
    }
    if (attempts >= OTP.MAX_ATTEMPTS) {
      await repository.deleteChallenge(phone);
      throw lockedError();
    }
    throw new AppError(400, 'OTP_INVALID', 'کد اشتباهه، دوباره امتحان کن', {
      attemptsLeft: Math.min(OTP.MAX_ATTEMPTS - attempts, env.OTP_MAX_FAILURES - window.failures),
    });
  }

  await repository.deleteChallenge(phone);
  await repository.clearFailures(phone);
}

export const authService = {
  /**
   * Issues a one-time code for a number.
   *
   * Three gates, in this order: the per-number cooldown (a resend asked for
   * too early), the per-number window, and the per-address window. The
   * address limit is last because it is the coarse one — a shared office IP
   * should not be what tells a first-time user they are rate limited.
   *
   * The send is logged *before* the SMS goes out. A provider that times out
   * after accepting the message would otherwise leave the limit uncounted,
   * which is the side to be wrong on.
   */
  async requestOtp(
    phone: string,
    ip: string | null,
    purpose: OtpPurpose = 'user'
  ): Promise<OtpRequestResponse> {
    // First, before anything is written: with no provider there is nothing
    // to send, so no challenge, no cooldown and no counted send.
    const sms = sender();
    const now = new Date();
    const windowStart = new Date(now.getTime() - seconds(OTP.RATE_WINDOW_SECONDS));
    const repository = authRepository();

    // A locked number gets no new code: it could not use one.
    await assertNotLocked(phone, now);

    const live = await repository.findChallenge(phone);
    if (live && live.resendAvailableAt > now) {
      throw new RateLimitedError(secondsUntil(live.resendAvailableAt, now));
    }

    const byPhone = await repository.countSendsForPhone(phone, windowStart);
    if (byPhone >= (env.OTP_MAX_SENDS_PER_PHONE ?? OTP.MAX_SENDS_PER_PHONE)) {
      throw new RateLimitedError(OTP.RATE_WINDOW_SECONDS);
    }

    if (ip) {
      const byIp = await repository.countSendsForIp(ip, windowStart);
      if (byIp >= (env.OTP_MAX_SENDS_PER_IP ?? OTP.MAX_SENDS_PER_IP)) {
        throw new RateLimitedError(OTP.RATE_WINDOW_SECONDS);
      }
    }

    const code = generateNumericCode(OTP.LENGTH);
    const resendAvailableAt = new Date(now.getTime() + seconds(OTP.RESEND_AFTER_SECONDS));

    await repository.saveChallenge({
      phone,
      // The hash is bound to the number, so a code seen for one number
      // cannot be presented for another.
      codeHash: hashOtp(phone, code, otpScope(purpose)),
      expiresAt: new Date(now.getTime() + seconds(OTP.TTL_SECONDS)),
      resendAvailableAt,
      attempts: 0,
    });
    await repository.recordSend(phone, ip);
    await sms.sendOtp(phone, code);

    return {
      resendIn: OTP.RESEND_AFTER_SECONDS,
      // Spread rather than a null, so with the switch off the field does not
      // exist in the JSON at all.
      ...(env.otpEchoAllowed ? { debugCode: code } : {}),
    };
  },

  /**
   * Checks and consumes a code without opening a session. For a flow with a
   * session of its own — the admin panel — which decides what a proven
   * number is entitled to.
   */
  consumeOtp,

  /**
   * Checks a code and, if it holds, signs the person in — creating the
   * account first when the number is new.
   */
  async verifyOtp(
    phone: string,
    code: string,
    client: ClientInfo
  ): Promise<{ session: OtpVerifyResponse; tokens: SessionTokens }> {
    await consumeOtp(phone, code, 'user');

    const { user, isNew } = await usersService.ensureByPhone(phone);
    const now = new Date();
    const absoluteExpiresAt = new Date(now.getTime() + seconds(env.session.absoluteSeconds));
    const { tokens, hashes } = issueTokens(now, absoluteExpiresAt);
    await authRepository().createSession(user.id, hashes, client, absoluteExpiresAt);

    return { session: { ...toSession(user), isNew }, tokens };
  },

  /**
   * The user a live access token belongs to, or nothing. Throws for a
   * suspended account. Read together with the user row: this runs before
   * every protected request.
   */
  async resolveUser(accessToken: string): Promise<UserRecord | null> {
    return usersService.findByAccessToken(sha256(accessToken), new Date());
  },

  /**
   * Spends a refresh token and issues the next pair.
   *
   * Rotation is the point: a token is valid exactly once, so a copy stolen
   * from a device is either used before the real client refreshes — in which
   * case the real client's next refresh is a replay and kills the session —
   * or after, in which case it is already spent. Either way the theft ends
   * the session rather than quietly outliving it.
   *
   * The one exception is `REFRESH_REUSE_GRACE_SECONDS`: a token reused within
   * seconds of being spent is one client's concurrent requests, not a thief,
   * and gets a fresh pair instead of ending the session.
   */
  async refresh(
    refreshToken: string
  ): Promise<{ session: SessionResponse; tokens: SessionTokens }> {
    const now = new Date();
    const { tokens, hashes } = issueTokens(now);

    const resolved = await authRepository().rotateRefreshToken(
      sha256(refreshToken),
      now,
      hashes,
      {
        reuseGraceSeconds: SESSION.REFRESH_REUSE_GRACE_SECONDS,
        absoluteSeconds: env.session.absoluteSeconds,
      }
    );
    if (!resolved) throw new UnauthorizedError('نشستت تموم شده، دوباره وارد شو');

    // The repository stored the pair capped at the session's absolute end;
    // the cookies must not claim to last longer than the rows do.
    const cap = resolved.absoluteExpiresAt;
    if (tokens.accessExpiresAt > cap) tokens.accessExpiresAt = cap;
    if (tokens.refreshExpiresAt > cap) tokens.refreshExpiresAt = cap;

    const user = await usersService.getById(resolved.userId);
    return { session: toSession(user), tokens };
  },

  /** Ends the session the refresh token belongs to. */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await authRepository().revokeSessionByRefreshToken(sha256(refreshToken));
  },

  // ─── Managing a person's sessions ──────────────────────────────
  // For the admin panel, which decides who may call these. Revoking a
  // session ends its access token on the very next request: every request
  // reads the session's state with the token.

  listSessions(userId: string): Promise<SessionRecord[]> {
    return authRepository().listActiveSessions(userId, new Date());
  },

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const revoked = await authRepository().revokeSession(userId, sessionId, 'admin');
    if (!revoked) throw new NotFoundError('این نشست پیدا نشد یا قبلاً بسته شده');
  },

  revokeAllSessions(userId: string): Promise<number> {
    return authRepository().revokeAllSessions(userId, 'admin');
  },

  /** The cleanup job's share: expired tokens, codes, and long-ended sessions. */
  purgeExpired(retention: RetentionPolicy): Promise<PurgeCounts> {
    return authRepository().purgeExpired(new Date(), retention);
  },
};
