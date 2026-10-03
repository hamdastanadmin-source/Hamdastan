import { OTP, SESSION } from '@hamdastan/config';
import type {
  OtpRequestResponse,
  OtpVerifyResponse,
  SessionResponse,
} from '@hamdastan/types';

import { env } from '../../config';
import type { SmsSender } from '../../integrations';
import { AppError, UnauthorizedError } from '../../shared/errors';
import {
  generateNumericCode,
  generateToken,
  hashOtp,
  hashesMatch,
  sha256,
} from '../../shared/crypto';
import { toSession, usersService } from '../users';

import { authRepository } from './auth.repository';
import type { ResolvedSession, SessionTokens, TokenHashes } from './auth.types';

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
export function setSmsSender(sender: SmsSender): void {
  smsSender = sender;
}

function sender(): SmsSender {
  if (!smsSender) {
    throw new AppError(501, 'SMS_NOT_CONFIGURED', 'سرویس پیامک پیکربندی نشده است');
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
    super(429, 'OTP_RATE_LIMITED', 'تعداد درخواست‌ها زیاد است، کمی بعد دوباره تلاش کن', {
      retryAfter,
    });
  }
}

/** Mints a fresh pair and the hashes that go with it. */
function issueTokens(now: Date): { tokens: SessionTokens; hashes: TokenHashes } {
  const tokens: SessionTokens = {
    accessToken: generateToken(),
    accessExpiresAt: new Date(now.getTime() + seconds(SESSION.ACCESS_TOKEN_TTL_SECONDS)),
    refreshToken: generateToken(),
    refreshExpiresAt: new Date(now.getTime() + seconds(SESSION.REFRESH_TOKEN_TTL_SECONDS)),
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
  async requestOtp(phone: string, ip: string | null): Promise<OtpRequestResponse> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - seconds(OTP.RATE_WINDOW_SECONDS));
    const repository = authRepository();

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
      codeHash: hashOtp(phone, code),
      expiresAt: new Date(now.getTime() + seconds(OTP.TTL_SECONDS)),
      resendAvailableAt,
      attempts: 0,
    });
    await repository.recordSend(phone, ip);
    await sender().sendOtp(phone, code);

    return {
      resendIn: OTP.RESEND_AFTER_SECONDS,
      // Spread rather than a null, so with the switch off the field does not
      // exist in the JSON at all.
      ...(env.OTP_DEBUG_DISPLAY ? { debugCode: code } : {}),
    };
  },

  /**
   * Checks a code and, if it holds, signs the person in — creating the
   * account first when the number is new.
   *
   * A correct code is consumed whatever happens next, and five wrong ones
   * burn it. Either way the next attempt needs a new code, which is what
   * makes a six-digit secret safe to send over SMS.
   */
  async verifyOtp(
    phone: string,
    code: string
  ): Promise<{ session: OtpVerifyResponse; tokens: SessionTokens }> {
    const now = new Date();
    const repository = authRepository();
    const challenge = await repository.findChallenge(phone);

    if (!challenge) {
      throw new AppError(400, 'OTP_NOT_FOUND', 'کدی برای این شماره صادر نشده');
    }
    if (challenge.expiresAt <= now) {
      await repository.deleteChallenge(phone);
      throw new AppError(400, 'OTP_EXPIRED', 'کد منقضی شده، دوباره درخواست بده');
    }
    if (challenge.attempts >= OTP.MAX_ATTEMPTS) {
      await repository.deleteChallenge(phone);
      throw new AppError(429, 'OTP_LOCKED', 'تعداد تلاش‌ها زیاد بود، کد جدید بگیر');
    }

    if (!hashesMatch(challenge.codeHash, hashOtp(phone, code))) {
      const attempts = await repository.recordFailedAttempt(phone);
      if (attempts >= OTP.MAX_ATTEMPTS) {
        await repository.deleteChallenge(phone);
        throw new AppError(429, 'OTP_LOCKED', 'تعداد تلاش‌ها زیاد بود، کد جدید بگیر');
      }
      throw new AppError(400, 'OTP_INVALID', 'کد اشتباهه، دوباره امتحان کن', {
        attemptsLeft: OTP.MAX_ATTEMPTS - attempts,
      });
    }

    await repository.deleteChallenge(phone);

    const { user, isNew } = await usersService.ensureByPhone(phone);
    const { tokens, hashes } = issueTokens(now);
    await repository.createSession(user.id, hashes);

    return { session: { ...toSession(user), isNew }, tokens };
  },

  /** Resolves an access token to its session, or nothing. */
  async resolveAccessToken(accessToken: string): Promise<ResolvedSession | null> {
    return authRepository().findUserByAccessToken(sha256(accessToken), new Date());
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
      SESSION.REFRESH_REUSE_GRACE_SECONDS
    );
    if (!resolved) throw new UnauthorizedError('نشست شما منقضی شده، دوباره وارد شو');

    const user = await usersService.getById(resolved.userId);
    return { session: toSession(user), tokens };
  },

  /** Ends the session the refresh token belongs to. */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await authRepository().revokeSessionByRefreshToken(sha256(refreshToken));
  },
};
