import type { FastifyPluginAsync } from 'fastify';

import { adminAuthController } from './admin-auth.controller';

/**
 * HTTP surface of the admin-auth module — ورود مدیران به پنل مدیریت.
 *
 * Mounted at `${API_PREFIX}/admin/auth` by `app.ts`. Deliberately separate from
 * `/auth`, which is the product's passwordless sign-in: the two share no code,
 * no cookie and no user store, and neither can sign anybody into the other.
 *
 *   POST /login            username + password; creates the session
 *   POST /change-password  the forced change; rotates the session
 *   GET  /session          who the cookie belongs to, and what they may do
 *   POST /logout           invalidate it
 *
 * There is no registration route and there never will be: an admin account is
 * created by another admin, through `/admin/users`.
 *
 * These four need no permission guard — `/login` is the door, and the other
 * three act on the caller's own session, which the controller reads from the
 * cookie. Every route that touches somebody *else* is guarded; see
 * `admin-users.routes.ts`.
 *
 * Bodies are validated in the controller against `admin-auth.schema.ts`.
 */
export const adminAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', adminAuthController.login);
  app.post('/change-password', adminAuthController.changePassword);
  app.get('/session', adminAuthController.session);
  app.post('/logout', adminAuthController.logout);
};
