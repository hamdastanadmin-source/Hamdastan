import type { FastifyReply, FastifyRequest } from 'fastify';

import { SESSION_COOKIE_NAME } from '@hamdastan/config';
import type { AuthResponse, SessionResponse } from '@hamdastan/types';

import { env } from '../../config';
import { UnauthorizedError } from '../../shared/errors';
import { ok } from '../../shared/response';
import { parseRequest } from '../../shared/validate';
import { authSchemas } from './auth.schema';
import { authService } from './auth.service';

/**
 * HTTP adapter for the Auth module.
 *
 * It parses the request, calls `authService`, and shapes the reply. The one
 * piece of HTTP machinery it owns beyond that is the session cookie: the token
 * is set and cleared here and never appears in a response body, so it stays
 * out of reach of client script.
 */

/**
 * Where the cookie lives, written once.
 *
 * Clearing a cookie only works if the attributes that scope it match the ones
 * it was set with, so `path` and `domain` come from here for both — a clear
 * that drifts from the set leaves a cookie the browser will not drop.
 */
const SESSION_COOKIE_SCOPE = {
  path: '/',
  ...(env.SESSION_COOKIE_DOMAIN ? { domain: env.SESSION_COOKIE_DOMAIN } : {}),
} as const;

function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    ...SESSION_COOKIE_SCOPE,
    httpOnly: true,
    secure: env.isProduction,
    // The web app and the API are same-site (sibling hosts in production,
    // different ports locally), so Lax carries the cookie and still refuses it
    // on a cross-site request.
    sameSite: 'lax',
    expires: expiresAt,
  });
}

export const authController = {
  async checkPhone(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const { phone } = parseRequest(authSchemas.checkPhone, request.body);
    return reply.send(ok(await authService.checkPhone(phone)));
  },

  async sendOtp(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { phone } = parseRequest(authSchemas.sendOtp, request.body);
    return reply.send(ok(await authService.sendOtp(phone)));
  },

  async register(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const input = parseRequest(authSchemas.register, request.body);
    return reply.status(201).send(ok(await authService.register(input)));
  },

  async verifyOtp(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { phone, code } = parseRequest(authSchemas.verifyOtp, request.body);
    const session = await authService.verifyOtp(phone, code);

    setSessionCookie(reply, session.token, session.expiresAt);

    const body: AuthResponse = { user: session.user };
    return reply.send(ok(body));
  },

  /** Backs the "ویرایش شماره" link: the code in flight stops working. */
  async cancelOtp(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const { phone } = parseRequest(authSchemas.cancelOtp, request.body);
    await authService.cancelChallenge(phone);
    return reply.send(ok({ cancelled: true }));
  },

  async session(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const token = request.cookies[SESSION_COOKIE_NAME];
    const user = token ? await authService.getSessionUser(token) : null;

    if (!user) {
      throw new UnauthorizedError();
    }

    const body: SessionResponse = { user };
    return reply.send(ok(body));
  },

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (token) {
      await authService.logout(token);
    }

    // Cleared whether or not the token was still good, so a stale cookie does
    // not keep the browser trying to use it.
    reply.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_SCOPE);

    return reply.send(ok({ loggedOut: true }));
  },
};
