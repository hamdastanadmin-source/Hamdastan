import type { FastifyReply, FastifyRequest } from 'fastify';

import { ADMIN_SESSION_COOKIE_NAME } from '@hamdastan/config';
import type {
  AdminChangePasswordResponse,
  AdminLoginResponse,
  AdminSessionResponse,
} from '@hamdastan/types';

import { env } from '../../config';
import { UnauthorizedError } from '../../shared/errors';
import { ok } from '../../shared/response';
import { parseRequest } from '../../shared/validate';
import { adminAuthSchemas } from './admin-auth.schema';
import { adminAuthService } from './admin-auth.service';

/**
 * HTTP adapter for admin authentication.
 *
 * It parses the request, calls `adminAuthService` and shapes the reply. The one
 * piece of HTTP machinery it owns beyond that is the session cookie: the token
 * is set and cleared here and never appears in a response body, so it stays out
 * of reach of client script.
 *
 * The admin cookie is a different cookie from the product's, so one browser can
 * hold both sessions and signing out of one leaves the other alone.
 */

/**
 * Where the cookie lives, written once.
 *
 * Clearing a cookie only works if the attributes that scope it match the ones
 * it was set with, so `path` and `domain` come from here for both.
 */
const ADMIN_COOKIE_SCOPE = {
  path: '/',
  ...(env.SESSION_COOKIE_DOMAIN ? { domain: env.SESSION_COOKIE_DOMAIN } : {}),
} as const;

function setAdminSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(ADMIN_SESSION_COOKIE_NAME, token, {
    ...ADMIN_COOKIE_SCOPE,
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    expires: expiresAt,
  });
}

/** The cookie, or a 401 — used where the handler cannot do anything without one. */
function requireToken(request: FastifyRequest): string {
  const token = request.cookies[ADMIN_SESSION_COOKIE_NAME];
  if (!token) throw new UnauthorizedError('برای ورود به پنل مدیریت وارد شوید');
  return token;
}

export const adminAuthController = {
  async login(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const input = parseRequest(adminAuthSchemas.login, request.body);
    const session = await adminAuthService.login(input);

    setAdminSessionCookie(reply, session.token, session.expiresAt);

    const body: AdminLoginResponse = { admin: session.admin };
    return reply.send(ok(body));
  },

  /**
   * The forced password change.
   *
   * Allowed while `mustChangePassword` is set — it is the one thing that is —
   * and it issues a new session, because writing the password invalidates every
   * session older than it, including the one this request arrived on.
   */
  async changePassword(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const token = requireToken(request);
    const { newPassword } = parseRequest(adminAuthSchemas.changePassword, request.body);
    const session = await adminAuthService.changePassword(token, newPassword);

    setAdminSessionCookie(reply, session.token, session.expiresAt);

    const body: AdminChangePasswordResponse = { admin: session.admin };
    return reply.send(ok(body));
  },

  async session(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const admin = await adminAuthService.session(
      request.cookies[ADMIN_SESSION_COOKIE_NAME]
    );

    const body: AdminSessionResponse = { admin };
    return reply.send(ok(body));
  },

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const token = request.cookies[ADMIN_SESSION_COOKIE_NAME];
    if (token) {
      await adminAuthService.logout(token);
    }

    // Cleared whether or not the token was still good, so a stale cookie does
    // not keep the browser trying to use it.
    reply.clearCookie(ADMIN_SESSION_COOKIE_NAME, ADMIN_COOKIE_SCOPE);

    return reply.send(ok({ loggedOut: true }));
  },
};
