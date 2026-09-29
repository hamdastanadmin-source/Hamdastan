import type { FastifyRequest } from 'fastify';

import { SESSION } from '@hamdastan/config';

import { authService } from '../modules/auth';
import { usersService } from '../modules/users';
import type { UserRecord } from '../modules/users';
import { UnauthorizedError } from '../shared/errors';

/**
 * The preHandler that turns the access cookie into `request.user`.
 *
 * It sits in `middleware/` rather than in a module because it is the same
 * check on every protected route, and because a route file may not reach a
 * service directly — it registers this instead and stays a declaration.
 *
 * Refreshing is *not* done here. An expired access token is a 401, and the
 * caller is expected to present its refresh token at `POST /auth/refresh`.
 * Rotating silently inside an arbitrary request would mean any handler could
 * be the one that issues cookies, and a response that is mostly cached
 * suddenly carries a `Set-Cookie`.
 */

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `authenticate`. Present on every route that registers it. */
    user?: UserRecord;
  }
}

export async function authenticate(request: FastifyRequest): Promise<void> {
  const token = request.cookies[SESSION.ACCESS_COOKIE];
  if (!token) throw new UnauthorizedError();

  const resolved = await authService.resolveAccessToken(token);
  if (!resolved) throw new UnauthorizedError();

  // Loaded rather than trusted from the token: a suspended account must stop
  // working on its next request, not when its access token happens to expire.
  request.user = await usersService.getById(resolved.userId);
}

/** The authenticated user, for handlers that registered `authenticate`. */
export function currentUser(request: FastifyRequest): UserRecord {
  if (!request.user) throw new UnauthorizedError();
  return request.user;
}
