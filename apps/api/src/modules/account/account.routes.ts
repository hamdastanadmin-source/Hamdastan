import type { FastifyPluginAsync } from 'fastify';

import { authenticate } from '../../middleware';

import { accountController } from './account.controller';

/**
 * HTTP surface of the Account module — حساب من: هویت، پیشرفت و تنظیمات.
 *
 * Mounted at `${API_PREFIX}/me`: everything here is about the current user.
 * `authenticate` is per route, as everywhere — see `users.routes.ts`.
 */
export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get('/account', { preHandler: authenticate }, accountController.overview);
  app.patch('/profile', { preHandler: authenticate }, accountController.updateProfile);
  app.put('/avatar', { preHandler: authenticate }, accountController.saveAvatar);
  app.put('/settings', { preHandler: authenticate }, accountController.saveSettings);
};
