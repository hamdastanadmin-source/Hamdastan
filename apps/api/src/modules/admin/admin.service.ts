import { ADMIN_SESSION } from '@hamdastan/config';
import type {
  AdminSessionResponse,
  AdminUser,
  AppUserSessions,
  OtpRequestResponse,
  Paginated,
} from '@hamdastan/types';

import { env } from '../../config';
import { AppError, NotFoundError } from '../../shared/errors';
import { generateToken, sha256 } from '../../shared/crypto';
import { authService } from '../auth';
import { usersService, type UserRecord } from '../users';

import { adminRepository } from './admin.repository';
import type { AdminFields, AdminListQuery, AdminRecord } from './admin.types';

/**
 * Business logic for the Admin module — who may use the admin panel, and
 * managing that list.
 *
 * Sign-in reuses the product's one-time codes (scoped to `admin`, so neither
 * flow's code opens the other) and then asks one more question the product
 * never asks: is this number on the allow-list, and active? There is no
 * public registration — a number gets in only because an admin added it.
 */

export function toAdminUser(record: AdminRecord): AdminUser {
  return {
    id: record.id,
    firstName: record.firstName,
    lastName: record.lastName,
    phone: record.phone,
    status: record.status,
    role: record.role,
    lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

/** The audit trail is the structured log; this is the slice of it a service needs. */
type AuditLog = { info(details: object, message: string): void };

async function appUserSessions(user: UserRecord): Promise<AppUserSessions> {
  const sessions = await authService.listSessions(user.id);
  return {
    user: {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      suspended: user.status === 'SUSPENDED',
    },
    sessions: sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt?.toISOString() ?? null,
      expiresAt: session.expiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt?.toISOString() ?? null,
      userAgent: session.userAgent,
      ip: session.ip,
    })),
  };
}

export const adminService = {
  /**
   * Sends a code to any well-formed number, exactly as the product does. The
   * allow-list is checked after the code verifies, so this answer cannot be
   * used to learn which numbers are admins.
   */
  requestOtp(phone: string, ip: string | null): Promise<OtpRequestResponse> {
    return authService.requestOtp(phone, ip, 'admin');
  },

  /**
   * Proves the number, then lets it in only if it belongs to an active
   * admin. A proven number that is not one gets a 403 and no session.
   */
  async verifyOtp(
    phone: string,
    code: string
  ): Promise<{ session: AdminSessionResponse; token: string; expiresAt: Date }> {
    await authService.consumeOtp(phone, code, 'admin');

    const admin = await adminRepository().findByPhone(phone);
    if (!admin || admin.status !== 'active') {
      throw new AppError(403, 'ADMIN_ACCESS_DENIED', 'این شماره اجازه‌ی ورود به پنل مدیریت رو نداره');
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + ADMIN_SESSION.TTL_SECONDS * 1000);
    await adminRepository().createSession(admin.id, sha256(token), expiresAt);

    return { session: { admin: toAdminUser(admin) }, token, expiresAt };
  },

  /**
   * The admin a session token belongs to, or null. Read on every request,
   * with the status, so a deactivated admin is out on their next request
   * even if a session somehow survived the revoke.
   */
  async resolveAdmin(token: string): Promise<AdminRecord | null> {
    const admin = await adminRepository().findBySessionToken(
      sha256(token),
      new Date(),
      env.session.adminIdleSeconds
    );
    return admin?.status === 'active' ? admin : null;
  },

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await adminRepository().revokeSession(sha256(token));
  },

  // ─── Managing a product account's sessions ─────────────────────────────

  /** One product account, by number, with its live sessions. */
  async findAppUserSessions(phone: string): Promise<AppUserSessions> {
    const user = await usersService.findByPhone(phone);
    if (!user) throw new NotFoundError('حسابی با این شماره پیدا نشد');
    return appUserSessions(user);
  },

  async appUserSessions(userId: string): Promise<AppUserSessions> {
    const user = await usersService.findAnyById(userId);
    if (!user) throw new NotFoundError('حساب کاربری پیدا نشد');
    return appUserSessions(user);
  },

  /**
   * Ends one session. Logged with who did it: the session row keeps only
   * that an admin ended it.
   */
  async revokeAppUserSession(actor: AdminRecord, userId: string, sessionId: string, log: AuditLog) {
    await authService.revokeSession(userId, sessionId);
    log.info({ audit: { action: 'session.revoke', adminId: actor.id, userId, sessionId } }, 'admin ended a session');
  },

  async revokeAllAppUserSessions(actor: AdminRecord, userId: string, log: AuditLog) {
    const revoked = await authService.revokeAllSessions(userId);
    log.info({ audit: { action: 'session.revoke_all', adminId: actor.id, userId, revoked } }, 'admin ended all sessions');
    return { revoked };
  },

  /** The cleanup job's share: admin sessions long ended. */
  purgeEnded(retentionDays: number): Promise<number> {
    return adminRepository().purgeEnded(new Date(), retentionDays);
  },

  // ─── Managing the list ─────────────────────────────────────────────────

  async list(query: AdminListQuery): Promise<Paginated<AdminUser>> {
    const { items, total } = await adminRepository().list(query);
    return { items: items.map(toAdminUser), page: query.page, pageSize: query.pageSize, total };
  },

  async create(fields: AdminFields): Promise<AdminUser> {
    return toAdminUser(await adminRepository().create(fields));
  },

  /**
   * An admin cannot deactivate themselves. Every acting admin is active, so
   * this alone guarantees the panel always keeps at least one admin who can
   * get back in.
   */
  async update(actor: AdminRecord, id: string, fields: Partial<AdminFields>): Promise<AdminUser> {
    if (id === actor.id && fields.status === 'inactive') {
      throw new AppError(400, 'ADMIN_SELF_DEACTIVATION', 'نمی‌تونی حساب خودت رو غیرفعال کنی');
    }
    // Only a system admin can reach this, and none can demote, deactivate or
    // delete themselves — so whoever is acting stays a system admin, and the
    // panel can never be left without one.
    if (id === actor.id && fields.role !== undefined && fields.role !== actor.role) {
      throw new AppError(400, 'ADMIN_SELF_ROLE_CHANGE', 'نمی‌تونی نقش خودت رو تغییر بدی');
    }

    const updated = await adminRepository().update(id, fields);
    if (!updated) throw new NotFoundError('کاربر پیدا نشد');
    return toAdminUser(updated);
  },

  /**
   * Removes an admin for good, and with them every session they hold. The
   * same rule as deactivation: never yourself, so an admin always remains.
   */
  async delete(actor: AdminRecord, id: string): Promise<void> {
    if (id === actor.id) {
      throw new AppError(400, 'ADMIN_SELF_DELETION', 'نمی‌تونی حساب خودت رو حذف کنی');
    }
    if (!(await adminRepository().delete(id))) throw new NotFoundError('کاربر پیدا نشد');
  },
};
