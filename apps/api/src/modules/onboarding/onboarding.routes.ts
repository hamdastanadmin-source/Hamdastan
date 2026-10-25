import type { FastifyPluginAsync } from 'fastify';

import { authenticate, requireAdminPermission as can } from '../../middleware';

import { onboardingController as c } from './onboarding.controller';

/**
 * HTTP surface of the Onboarding module.
 *
 *   `/me/onboarding`        the current user's stage 1 (interests) and
 *                           stage 2 (the questionnaire) — `authenticate`
 *   `/admin/onboarding`     the panel's editors for both catalogs —
 *                           `requireAdminPermission(…)`, per route
 *
 * `authenticate` is per route, as everywhere — see `users.routes.ts`.
 * `/me/onboarding/complete` (ending onboarding) stays with the Users module,
 * which owns the account's step.
 */
export const onboardingRoutes: FastifyPluginAsync = async (app) => {
  const user = { preHandler: authenticate };

  app.get('/interests', user, c.interests);
  app.put('/interests', user, c.saveInterests);
  app.get('/questionnaire', user, c.questionnaire);
  app.put('/questionnaire/answers/:questionId', user, c.saveAnswer);
  app.post('/questionnaire/complete', user, c.complete);
  app.post('/events', user, c.recordEvent);
};

export const onboardingAdminRoutes: FastifyPluginAsync = async (app) => {
  // Each route names the permission it needs; the role table decides who has it.
  const guard = (permission: Parameters<typeof can>[0]) => ({ preHandler: can(permission) });

  app.get('/interest-categories', guard('onboarding.read'), c.adminInterestCategories);
  app.post('/interest-categories', guard('onboarding.write'), c.createInterestCategory);
  app.post('/interest-categories/import', guard('onboarding.write'), c.importInterests);
  app.put('/interest-categories/order', guard('onboarding.write'), c.reorderInterestCategories);
  app.put('/interest-categories/:id', guard('onboarding.write'), c.updateInterestCategory);
  app.delete('/interest-categories/:id', guard('onboarding.write'), c.removeInterestCategory);

  app.get('/questions', guard('onboarding.read'), c.adminQuestions);
  app.post('/questions', guard('onboarding.write'), c.createQuestion);
  app.post('/questions/import', guard('onboarding.write'), c.importQuestions);
  app.put('/questions/order', guard('onboarding.write'), c.reorderQuestions);
  app.put('/questions/:id', guard('onboarding.write'), c.updateQuestion);
  app.delete('/questions/:id', guard('onboarding.write'), c.removeQuestion);
};
