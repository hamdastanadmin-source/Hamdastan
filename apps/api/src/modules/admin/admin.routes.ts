import type { FastifyPluginAsync } from 'fastify';

import { authenticateAdmin } from '../../middleware';

import { adminController } from './admin.controller';

/**
 * HTTP surface of the Admin module — ورود به پنل مدیریت و مدیریت کاربران.
 *
 * Mounted at `${API_PREFIX}/admin`. The three `/auth` routes are public by
 * design; every other route registers `authenticateAdmin`, per route, so a
 * route added later cannot inherit — or lose — protection silently.
 */
export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/otp/request', adminController.requestOtp);
  app.post('/auth/otp/verify', adminController.verifyOtp);
  app.post('/auth/logout', adminController.logout);

  app.get('/me', { preHandler: authenticateAdmin }, adminController.me);
  app.get('/users', { preHandler: authenticateAdmin }, adminController.listUsers);
  app.post('/users', { preHandler: authenticateAdmin }, adminController.createUser);
  app.patch('/users/:id', { preHandler: authenticateAdmin }, adminController.updateUser);
  app.delete('/users/:id', { preHandler: authenticateAdmin }, adminController.deleteUser);
};
