import type { FastifyPluginAsync } from 'fastify';

import { authController } from './auth.controller';

/**
 * HTTP surface of the Auth module — ورود، خروج و نشست کاربر.
 *
 * Mounted at `${API_PREFIX}/auth` by `app.ts`. Every route here is public by
 * design: they are the ones a visitor with no session has to be able to call.
 *
 * Bodies are validated by the controller rather than by Fastify's `schema`
 * option, because the shared schemas in `@hamdastan/validation` normalise as
 * well as validate — `۰۹۱۲…` and `+98912…` have to become one phone number
 * on the way in, and JSON Schema has no transform step. See
 * `shared/validate.ts`.
 */
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/otp/request', authController.requestOtp);
  app.post('/otp/verify', authController.verifyOtp);
  app.post('/refresh', authController.refresh);
  app.post('/logout', authController.logout);
};
