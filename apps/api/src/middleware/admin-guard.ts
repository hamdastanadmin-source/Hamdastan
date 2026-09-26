import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';

import { ADMIN_SESSION_COOKIE_NAME } from '@hamdastan/config';
import type { AdminPermission, AdminPrincipal } from '@hamdastan/types';

import { adminAuthService } from '../modules/admin-auth/admin-auth.service';

/**
 * The guard on every admin route that touches somebody other than the caller.
 *
 * Authorisation is cross-cutting request handling, so it lives in `middleware/`
 * rather than in a module: a route declares the permission it needs, and the
 * decision is made in one place by `adminAuthService.authorize`, which checks
 * all five things — authenticated, active, in date, past the forced password
 * change, and permitted.
 *
 * This is the half that matters. The panel hides a menu an admin has no
 * permission for, but that is a convenience; if the request is made anyway, it
 * is refused here.
 */

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `requireAdmin`. Present only on a guarded route. */
    admin?: AdminPrincipal;
  }
}

export function requireAdmin(
  permission?: AdminPermission
): preHandlerAsyncHookHandler {
  return async function guard(request: FastifyRequest) {
    request.admin = await adminAuthService.authorize(
      request.cookies[ADMIN_SESSION_COOKIE_NAME],
      // `allowPasswordChangePending` is left off on purpose: an account still
      // on a temporary password can reach nothing through this guard.
      permission ? { permission } : {}
    );
  };
}
