import { adminRoleName } from '@hamdastan/shared/rbac';
import { logger } from '@hamdastan/shared/logger';
import type {
  AdminUser,
  CreateAdminUserResponse,
  Paginated,
  ResetAdminPasswordResponse,
} from '@hamdastan/types';
import {
  normalizeUsername,
  TEMPORARY_PASSWORD_LENGTH,
  type AdminUsersQueryInput,
  type CreateAdminUserInput,
  type UpdateAdminUserInput,
} from '@hamdastan/validation';

import { env } from '../../config';
import { SmsDeliveryError, smsProvider } from '../../integrations';
import { isPastDate } from '../../shared/dates';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { generateNumericPassword, hashPassword } from '../../shared/password';
import { adminUsersRepository } from './admin-users.repository';
import type { AdminUserRecord } from './admin-users.types';

/**
 * Business logic for admin-user management — «مدیریت کاربران».
 *
 * The rules that live here and nowhere else:
 *
 *   - an admin account is created by another admin; nobody registers
 *   - a username is unique, case-insensitively
 *   - a new account gets a six-digit temporary password generated *here*, by
 *     the CSPRNG, and stored only as a hash
 *   - that password is sent by SMS and is otherwise unrecoverable: there is no
 *     operation that reveals or re-sends it, only one that replaces it
 *   - a reset invalidates the previous password, forces a change, and signs out
 *     whatever sessions the account had
 *   - every account carries an expiry date; the backend is the clock
 *
 * It knows nothing about HTTP (the controller's job), nothing about storage
 * (the repository's job) and nothing about SMS vendors (the provider's job).
 */

/** What the panel shows for one account. No hash, no counters, no lock. */
function toAdminUserView(user: AdminUserRecord): AdminUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    username: user.username,
    mobile: user.mobile,
    roleCode: user.roleCode,
    roleName: adminRoleName(user.roleCode),
    status: user.status,
    accessExpiresAt: user.accessExpiresAt,
    // Decided here rather than in the browser: the client's clock is not the
    // one that grants access, so it should not be the one that reports it.
    accessExpired: isPastDate(user.accessExpiresAt),
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function temporaryPasswordExpiry(now: Date): Date {
  return new Date(now.getTime() + env.ADMIN_TEMP_PASSWORD_TTL_HOURS * 60 * 60 * 1000);
}

/**
 * Sends an admin their credentials.
 *
 * Delivery failure is reported rather than thrown: the account exists either
 * way, and the answer to a message that did not arrive is a reset — not an
 * account that half-exists because an SMS gateway was down. The caller passes
 * the result on as `smsDelivered`.
 */
async function sendCredentials(user: AdminUserRecord, password: string): Promise<boolean> {
  const text =
    `پنل مدیریت هم‌داستان\n` +
    `نام کاربری: ${user.username}\n` +
    `رمز عبور موقت: ${password}\n` +
    `این رمز یک‌بارمصرف است؛ در اولین ورود باید آن را تغییر دهید.`;

  try {
    await smsProvider().send({ phone: user.mobile, text, purpose: 'ADMIN_CREDENTIALS' });
    return true;
  } catch (error) {
    if (error instanceof SmsDeliveryError) {
      logger.error(
        { err: error, adminUserId: user.id },
        'admin credentials could not be delivered — the account was created and needs a reset'
      );
      return false;
    }
    throw error;
  }
}

/**
 * Generates a temporary password, stores its hash and sends it.
 *
 * Shared by creation and reset, so the two cannot drift: both force a change,
 * both set the same expiry, and both wipe whatever the previous password was.
 */
async function issueTemporaryPassword(
  user: AdminUserRecord
): Promise<CreateAdminUserResponse> {
  const password = generateNumericPassword(TEMPORARY_PASSWORD_LENGTH);

  // The write bumps the account's credentials version, so whatever sessions it
  // had stop resolving: a reset signs the account out everywhere.
  const updated = await adminUsersRepository().setPassword(user.id, {
    passwordHash: await hashPassword(password),
    mustChangePassword: true,
    temporaryPasswordExpiresAt: temporaryPasswordExpiry(new Date()),
    // Nobody has chosen this password, so it does not count as a change.
    passwordChangedAt: null,
  });

  if (!updated) throw new NotFoundError('این کاربر یافت نشد');

  const smsDelivered = await sendCredentials(updated, password);

  return {
    user: toAdminUserView(updated),
    // The one place a password is ever in a response, and only outside
    // production — `env.showDevCredentials` cannot be true there.
    ...(env.showDevCredentials ? { temporaryPassword: password } : {}),
    smsDelivered,
  };
}

export const adminUsersService = {
  /** The list behind «مدیریت کاربران», searched and paged by the backend. */
  async list(query: AdminUsersQueryInput): Promise<Paginated<AdminUser>> {
    const { items, total } = await adminUsersRepository().list({
      ...(query.search ? { search: query.search } : {}),
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      items: items.map(toAdminUserView),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  },

  async getById(id: string): Promise<AdminUser> {
    const user = await adminUsersRepository().findById(id);
    if (!user) throw new NotFoundError('این کاربر یافت نشد');
    return toAdminUserView(user);
  },

  /**
   * Creates an account and sends it its first password.
   *
   * The password is generated after the record is written, through the same
   * path a reset takes, so there is exactly one implementation of "this account
   * now has a temporary password".
   */
  async create(input: CreateAdminUserInput): Promise<CreateAdminUserResponse> {
    const repository = adminUsersRepository();
    const usernameKey = normalizeUsername(input.username);

    if (await repository.findByUsernameKey(usernameKey)) {
      throw new ConflictError('این نام کاربری قبلاً استفاده شده است');
    }

    const created = await repository.create({
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      usernameKey,
      mobile: input.mobile,
      // Replaced immediately below. A record never exists with a usable
      // password nobody generated — the placeholder matches nothing, because
      // `verifyPassword` refuses anything that is not a hash it wrote.
      passwordHash: '',
      mustChangePassword: true,
      temporaryPasswordExpiresAt: null,
      status: 'ACTIVE',
      roleCode: input.roleCode,
      accessExpiresAt: input.accessExpiresAt,
    });

    return issueTemporaryPassword(created);
  },

  /** Edits an account: their details, their role, their expiry, their status. */
  async update(id: string, patch: UpdateAdminUserInput): Promise<AdminUser> {
    const updated = await adminUsersRepository().update(id, patch);
    if (!updated) throw new NotFoundError('این کاربر یافت نشد');
    return toAdminUserView(updated);
  },

  /**
   * Replaces an account's password with a new temporary one.
   *
   * This is the only answer to "they lost their password": the previous one
   * cannot be read back, so it is not re-sent — it is invalidated and a new one
   * goes out. Sending credentials again to somebody who never received the SMS
   * is the same operation, for the same reason.
   */
  async resetTemporaryPassword(id: string): Promise<ResetAdminPasswordResponse> {
    const user = await adminUsersRepository().findById(id);
    if (!user) throw new NotFoundError('این کاربر یافت نشد');

    return issueTemporaryPassword(user);
  },

  /** Exported for `admin-auth`, which reports the same account to the panel. */
  toView: toAdminUserView,
};
