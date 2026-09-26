import { createHash, randomBytes } from 'node:crypto';

import { adminRolePermissions, hasAdminPermission } from '@hamdastan/shared/rbac';
import type { AdminPrincipal } from '@hamdastan/types';
import { normalizeUsername, type AdminLoginInput } from '@hamdastan/validation';

import { env } from '../../config';
import { isPastDate } from '../../shared/dates';
import {
  AuthenticationFailedError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../shared/errors';
import { hashPassword, verifyPassword } from '../../shared/password';
import { adminUsersService } from '../admin-users/admin-users.service';
import type { AdminUserRecord } from '../admin-users/admin-users.types';
import { adminAuthRepository } from './admin-auth.repository';
import type { AdminAuthorization, IssuedAdminSession } from './admin-auth.types';

/**
 * Business logic for admin authentication — ورود مدیران با نام کاربری و رمز عبور.
 *
 * Every access decision in the admin panel is made here. The panel hides what
 * an admin cannot use, but that is presentation: nothing is granted because a
 * client asked nicely, and `authorize` re-checks all of it on every request.
 *
 * The rules that live here and nowhere else:
 *
 *   - an admin signs in with a username and a password; there is no
 *     self-registration and no password reset the admin can trigger themselves
 *   - a password is verified against a hash, in constant time
 *   - consecutive wrong passwords lock the account for a while
 *   - a suspended account, an account whose access date has passed, and an
 *     account whose temporary password has expired are all refused
 *   - while `mustChangePassword` is set, the only things that work are the
 *     session lookup and choosing a new password
 *   - a permission is checked against the role catalogue on every request
 *
 * It knows nothing about HTTP — the controller owns the cookie — and nothing
 * about storage.
 */

const SESSION_TOKEN_BYTES = 32;

/** Sessions are stored by hash, so a stolen table is not a set of cookies. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The signed-in admin as the panel sees them, permissions resolved. */
function toPrincipal(user: AdminUserRecord): AdminPrincipal {
  return {
    ...adminUsersService.toView(user),
    permissions: adminRolePermissions(user.roleCode),
  };
}

function sessionLifetimeMs(): number {
  return env.ADMIN_SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;
}

async function issueSession(user: AdminUserRecord): Promise<IssuedAdminSession> {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionLifetimeMs());

  await adminAuthRepository().createSession({
    tokenHash: hashToken(token),
    adminUserId: user.id,
    createdAt: now,
    // Stamped from the record as it stands now, so a session issued by a
    // password change carries the version that change produced.
    credentialsVersion: user.credentialsVersion,
    expiresAt,
  });

  return { admin: toPrincipal(user), token, expiresAt };
}

/**
 * The checks every authenticated request repeats, in the order a client needs
 * to hear them.
 *
 * Suspension and expiry come before the password-change requirement because
 * they are terminal: telling a suspended admin to change their password would
 * send them to a screen that cannot help them.
 */
function assertAccountUsable(user: AdminUserRecord): void {
  if (user.status !== 'ACTIVE') {
    throw new ForbiddenError('این حساب غیرفعال شده است', 'ADMIN_ACCOUNT_SUSPENDED');
  }

  if (isPastDate(user.accessExpiresAt)) {
    throw new ForbiddenError('اعتبار دسترسی شما به پایان رسیده است', 'ADMIN_ACCESS_EXPIRED');
  }
}

/** A generated password that was never used in time is dead, not renewable. */
function assertTemporaryPasswordLive(user: AdminUserRecord, now: Date): void {
  if (
    user.mustChangePassword &&
    user.temporaryPasswordExpiresAt &&
    user.temporaryPasswordExpiresAt <= now
  ) {
    throw new ForbiddenError(
      'رمز عبور موقت شما منقضی شده است. از مدیر سیستم رمز جدید بخواهید.',
      'ADMIN_TEMPORARY_PASSWORD_EXPIRED'
    );
  }
}

export const adminAuthService = {
  /**
   * The only door into the panel.
   *
   * The password is checked before the account's status or expiry, so a wrong
   * password tells an attacker nothing about whether the account exists or what
   * state it is in.
   */
  async login({ username, password }: AdminLoginInput): Promise<IssuedAdminSession> {
    const repository = adminAuthRepository();
    const now = new Date();
    const user = await repository.findUserByUsernameKey(normalizeUsername(username));

    // The same answer for an unknown username and a wrong password: which of
    // the two it was is not the client's business.
    const rejectCredentials = (): never => {
      throw new AuthenticationFailedError(
        'ADMIN_INVALID_CREDENTIALS',
        'نام کاربری یا رمز عبور نادرست است'
      );
    };

    if (!user) {
      // Still costs a hash, so a missing account does not answer faster than a
      // wrong password and become detectable by timing.
      await hashPassword(password);
      return rejectCredentials();
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000);
      throw new TooManyRequestsError(
        'ADMIN_TOO_MANY_ATTEMPTS',
        'به دلیل تلاش‌های ناموفق، ورود این حساب موقتاً مسدود است. کمی بعد دوباره تلاش کنید.',
        { retryAfterSeconds }
      );
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      const attempts = await repository.recordFailedLogin(user.id);
      if (attempts >= env.ADMIN_LOGIN_MAX_ATTEMPTS) {
        await repository.lockUser(
          user.id,
          new Date(now.getTime() + env.ADMIN_LOGIN_LOCK_MINUTES * 60 * 1000)
        );
      }
      return rejectCredentials();
    }

    assertAccountUsable(user);
    assertTemporaryPasswordLive(user, now);

    await repository.recordSuccessfulLogin(user.id, now);

    return issueSession({ ...user, lastLoginAt: now });
  },

  /**
   * Resolves a session cookie to its account, or refuses it.
   *
   * A session dies with its expiry, and also the moment the account's password
   * is written by anybody: the write bumps `credentialsVersion` and the session
   * still carries the old one. That is how a reset signs every device out
   * without a session table sweep.
   */
  async authenticate(token: string): Promise<AdminUserRecord> {
    const repository = adminAuthRepository();
    const tokenHash = hashToken(token);
    const session = await repository.findSessionByTokenHash(tokenHash);

    if (!session) throw new UnauthorizedError('برای ورود به پنل مدیریت وارد شوید');

    if (session.expiresAt <= new Date()) {
      await repository.deleteSessionByTokenHash(tokenHash);
      throw new UnauthorizedError('نشست شما منقضی شده است. دوباره وارد شوید.');
    }

    const user = await repository.findUserById(session.adminUserId);
    if (!user) {
      await repository.deleteSessionByTokenHash(tokenHash);
      throw new UnauthorizedError('برای ورود به پنل مدیریت وارد شوید');
    }

    if (session.credentialsVersion !== user.credentialsVersion) {
      await repository.deleteSessionByTokenHash(tokenHash);
      throw new UnauthorizedError('رمز عبور این حساب تغییر کرده است. دوباره وارد شوید.');
    }

    return user;
  },

  /**
   * What every guarded route calls: authenticated, active, in date, past the
   * forced password change, and permitted.
   */
  async authorize(
    token: string | undefined,
    { permission, allowPasswordChangePending = false }: AdminAuthorization = {}
  ): Promise<AdminPrincipal> {
    if (!token) throw new UnauthorizedError('برای ورود به پنل مدیریت وارد شوید');

    const user = await this.authenticate(token);

    assertAccountUsable(user);
    assertTemporaryPasswordLive(user, new Date());

    if (user.mustChangePassword && !allowPasswordChangePending) {
      throw new ForbiddenError(
        'برای ادامه باید ابتدا رمز عبور خود را تغییر دهید',
        'ADMIN_PASSWORD_CHANGE_REQUIRED'
      );
    }

    const principal = toPrincipal(user);

    if (permission && !hasAdminPermission(principal.permissions, permission)) {
      throw new ForbiddenError('دسترسی به این بخش را ندارید', 'ADMIN_FORBIDDEN');
    }

    return principal;
  },

  /** Who the session cookie belongs to. Answers while a change is still owed. */
  async session(token: string | undefined): Promise<AdminPrincipal> {
    return this.authorize(token, { allowPasswordChangePending: true });
  },

  /**
   * The admin chooses their own password.
   *
   * The policy is enforced by the schema in the controller and again by nothing
   * else — there is one definition of a strong password, in
   * `@hamdastan/validation`, and the backend is where it is decisive.
   *
   * The session is rotated rather than kept: writing the password invalidates
   * every session issued under the previous version, which would otherwise
   * include the one this request arrived on. A fresh token also means a
   * password change ends any session somebody else was holding.
   */
  async changePassword(token: string, newPassword: string): Promise<IssuedAdminSession> {
    const repository = adminAuthRepository();
    const user = await this.authenticate(token);

    assertAccountUsable(user);

    const updated = await repository.setUserPassword(user.id, {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
      passwordChangedAt: new Date(),
    });

    if (!updated) throw new UnauthorizedError('این حساب دیگر وجود ندارد');

    await repository.deleteSessionByTokenHash(hashToken(token));

    return issueSession(updated);
  },

  /** Invalidates the session server-side, so a replayed cookie is worthless. */
  async logout(token: string): Promise<void> {
    await adminAuthRepository().deleteSessionByTokenHash(hashToken(token));
  },
};
