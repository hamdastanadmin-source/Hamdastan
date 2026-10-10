import type { FastifyRequest } from 'fastify';

import { ADMIN_SESSION } from '@hamdastan/config';
import { ADMIN_ROLE_PERMISSIONS, type AdminPermission } from '@hamdastan/types';

import { adminService, type AdminRecord } from '../modules/admin';
import { AppError, UnauthorizedError } from '../shared/errors';

/**
 * The preHandler that turns the admin session cookie into `request.admin`.
 *
 * This — not the admin panel — is the access control. The panel's redirects
 * are a convenience; a request that skips them still meets this check, which
 * reads the admin's status on every call, so deactivating someone ends their
 * access on their very next request.
 */

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `authenticateAdmin`. Present on every route that registers it. */
    admin?: AdminRecord;
  }
}

export async function authenticateAdmin(request: FastifyRequest): Promise<void> {
  const token = request.cookies[ADMIN_SESSION.COOKIE];
  if (!token) throw new UnauthorizedError();

  const admin = await adminService.resolveAdmin(token);
  if (!admin) throw new UnauthorizedError('نشستت تموم شده، دوباره وارد شو');
  request.admin = admin;
}

/** The authenticated admin, for handlers that registered `authenticateAdmin`. */
export function currentAdmin(request: FastifyRequest): AdminRecord {
  if (!request.admin) throw new UnauthorizedError();
  return request.admin;
}

/**
 * The preHandlers for a route that needs `permission`: the session, then the
 * role's grant. A route lists the permission it needs — never a role name —
 * and the table in `@hamdastan/types` decides; the panel hiding a button is
 * a courtesy, this is the control.
 *
 *   app.post('/xp/:id/revoke', { preHandler: requireAdminPermission('xp.revoke') }, …)
 */
export function requireAdminPermission(permission: AdminPermission) {
  return [
    authenticateAdmin,
    async function checkPermission(request: FastifyRequest): Promise<void> {
      const admin = currentAdmin(request);
      if (!ADMIN_ROLE_PERMISSIONS[admin.role].includes(permission)) {
        request.log.warn(
          { audit: { action: 'permission.denied', adminId: admin.id, permission } },
          'admin permission denied'
        );
        throw new AppError(403, 'ADMIN_PERMISSION_DENIED', 'دسترسی به این بخش رو نداری');
      }
    },
  ];
}
