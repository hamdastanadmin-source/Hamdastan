import type { FastifyPluginAsync } from 'fastify';

import { authenticateAdmin, rateLimits, requireAdminPermission } from '../../middleware';

import { adminController } from './admin.controller';

/**
 * HTTP surface of the Admin module — ورود به پنل مدیریت و مدیریت کاربران.
 *
 * Mounted at `${API_PREFIX}/admin`. The three `/auth` routes are public by
 * design; every other route registers its guard per route — `authenticateAdmin`
 * for `/me`, `requireAdminPermission(…)` for everything that does something —
 * so a route added later cannot inherit, or lose, protection silently.
 */
export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/otp/request', adminController.requestOtp);
  app.post('/auth/otp/verify', { config: { rateLimit: rateLimits.otpVerify } }, adminController.verifyOtp);
  app.post('/auth/logout', adminController.logout);

  // Any signed-in admin: who am I (with my role, which the panel reads).
  app.get('/me', { preHandler: authenticateAdmin }, adminController.me);

  // The allow-list itself.
  const admins = { preHandler: requireAdminPermission('admins.manage') };
  app.get('/users', admins, adminController.listUsers);
  app.post('/users', admins, adminController.createUser);
  app.patch('/users/:id', admins, adminController.updateUser);
  app.delete('/users/:id', admins, adminController.deleteUser);

  // A product account's sessions: find by number, list, end one or all.
  const sessions = { preHandler: requireAdminPermission('sessions.manage') };
  app.post('/app-users/sessions/lookup', sessions, adminController.lookupAppUser);
  app.get('/app-users/:userId/sessions', sessions, adminController.appUserSessions);
  app.delete('/app-users/:userId/sessions/:sessionId', sessions, adminController.revokeAppUserSession);
  app.delete('/app-users/:userId/sessions', sessions, adminController.revokeAllAppUserSessions);
};
