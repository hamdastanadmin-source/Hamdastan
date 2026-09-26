import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';

import { SESSION_COOKIE_NAME } from '@hamdastan/config';
import type { AuthUser } from '@hamdastan/types';

import { authService } from '../modules/auth/auth.service';

/**
 * Resolves the product's session cookie onto the request, without demanding one.
 *
 * The admin guard refuses anybody it cannot identify; this does the opposite,
 * because a form may be open to everybody. It answers "who is this, if
 * anybody?" and leaves the decision to the route's own service — which is where
 * the form's audience is checked.
 *
 * Cross-cutting request handling, so it lives here rather than in a module.
 */

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `attachSessionUser`. Null when nobody is signed in. */
    user?: AuthUser | null;
  }
}

export const attachSessionUser: preHandlerAsyncHookHandler = async (
  request: FastifyRequest
) => {
  const token = request.cookies[SESSION_COOKIE_NAME];
  request.user = token ? await authService.getSessionUser(token) : null;
};
