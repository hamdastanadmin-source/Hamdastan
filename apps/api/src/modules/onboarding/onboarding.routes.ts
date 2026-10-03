import type { FastifyPluginAsync } from 'fastify';

import { authenticate } from '../../middleware';

import { onboardingController } from './onboarding.controller';

/**
 * HTTP surface of the Onboarding module — پرسش‌نامه آنبوردینگ (stage 2).
 *
 * Mounted at `${API_PREFIX}/me/onboarding`: these are the current user's own
 * answers, beside stage 1's `/me/onboarding/interests` in the Users module.
 * `authenticate` is per route, as everywhere — see `users.routes.ts`.
 */
export const onboardingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/questionnaire', { preHandler: authenticate }, onboardingController.questionnaire);
  app.put(
    '/questionnaire/answers/:questionId',
    { preHandler: authenticate },
    onboardingController.saveAnswer
  );
  app.post('/questionnaire/complete', { preHandler: authenticate }, onboardingController.complete);
  app.post('/events', { preHandler: authenticate }, onboardingController.recordEvent);
};
