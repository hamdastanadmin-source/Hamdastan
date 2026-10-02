import type { FastifyPluginAsync } from 'fastify';

import { authenticate } from '../../middleware';

import { usersController } from './users.controller';

/**
 * HTTP surface of the Users module — حساب کاربری و مسیر بعدی کاربر.
 *
 * Mounted at the bare `${API_PREFIX}` rather than under `/users`, because
 * every route here is about *the* current user: `/me` reads better than
 * `/users/me` and is the path the spec names. Routes about other people's
 * accounts would go under `/users/` from this same file.
 *
 * `authenticate` is registered per route rather than as a hook on the plugin,
 * so a public route added here later cannot inherit protection it never asked
 * for — or, worse, lose it silently.
 */
export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', { preHandler: authenticate }, usersController.me);
  app.put('/me/basic-info', { preHandler: authenticate }, usersController.updateBasicInfo);
  app.post('/me/onboarding/complete', { preHandler: authenticate }, usersController.completeOnboarding);
  app.get('/me/onboarding/interests', { preHandler: authenticate }, usersController.onboardingInterests);
  app.put('/me/onboarding/interests', { preHandler: authenticate }, usersController.saveOnboardingInterests);
};
