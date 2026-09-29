import type { FastifyReply, FastifyRequest } from 'fastify';

import { SESSION } from '@hamdastan/config';

import { clearSessionCookies, setSessionCookies } from '../../shared/cookies';
import { ok } from '../../shared/response';
import { parseBody } from '../../shared/validate';

import { authSchemas } from './auth.schema';
import { authService } from './auth.service';

/**
 * HTTP adapter for the Auth module.
 *
 * It does three things and decides none of them: parse the body with the
 * shared schema, call the service, and move the tokens the service returns
 * into cookies. The cookie is an HTTP detail, which is why the service hands
 * back tokens and never a `Set-Cookie`.
 */
export const authController = {
  async requestOtp(request: FastifyRequest, reply: FastifyReply) {
    const { phone } = parseBody(authSchemas.otpRequest.body, request.body);
    const result = await authService.requestOtp(phone, request.ip || null);
    return reply.send(ok(result));
  },

  async verifyOtp(request: FastifyRequest, reply: FastifyReply) {
    const { phone, code } = parseBody(authSchemas.otpVerify.body, request.body);
    const { session, tokens } = await authService.verifyOtp(phone, code);
    setSessionCookies(reply, tokens);
    return reply.send(ok(session));
  },

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies[SESSION.REFRESH_COOKIE];
    if (!token) {
      // Clearing on the way out matters: a stale access cookie beside a
      // missing refresh cookie is what would otherwise keep the front-end
      // middleware trying to refresh on every navigation.
      clearSessionCookies(reply);
      return reply.status(401).send({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'نشستی برای تمدید وجود ندارد' },
      });
    }

    const { session, tokens } = await authService.refresh(token);
    setSessionCookies(reply, tokens);
    return reply.send(ok(session));
  },

  async logout(request: FastifyRequest, reply: FastifyReply) {
    await authService.logout(request.cookies[SESSION.REFRESH_COOKIE]);
    clearSessionCookies(reply);
    return reply.send(ok({ loggedOut: true }));
  },
};
