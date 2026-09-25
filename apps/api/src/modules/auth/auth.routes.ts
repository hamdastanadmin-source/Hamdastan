import type { FastifyPluginAsync } from 'fastify';

import { authController } from './auth.controller';

/**
 * HTTP surface of the Auth module — ورود با شماره موبایل، کد یک‌بارمصرف و نشست.
 *
 * Mounted at `${API_PREFIX}/auth` by `app.ts`. The flow is walked in this
 * order:
 *
 *   POST /check-phone   is this number registered?
 *   POST /register      new user: hold the profile, send a code
 *   POST /otp/send      send a code — and, called again, the resend
 *   POST /otp/verify    the only step that creates a session
 *   POST /otp/cancel    "ویرایش شماره": kill the code in flight
 *   GET  /session       who the session cookie belongs to
 *   POST /logout        invalidate it
 *
 * Bodies are validated in the controller against `auth.schema.ts` — see the
 * note there.
 */
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/check-phone', authController.checkPhone);
  app.post('/register', authController.register);
  app.post('/otp/send', authController.sendOtp);
  app.post('/otp/verify', authController.verifyOtp);
  app.post('/otp/cancel', authController.cancelOtp);
  app.get('/session', authController.session);
  app.post('/logout', authController.logout);
};
