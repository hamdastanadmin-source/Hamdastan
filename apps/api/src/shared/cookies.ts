import type { FastifyReply } from 'fastify';

import { ADMIN_SESSION, SESSION } from '@hamdastan/config';

import { env } from '../config';

/**
 * Where the session lives: two `httpOnly` cookies, and nothing in
 * `localStorage`.
 *
 * `httpOnly` is the whole point — a token the page's own JavaScript cannot
 * read is a token an injected script cannot steal. `SameSite=Lax` is what
 * makes it safe to send them on ordinary navigations without opening the API
 * to cross-site form posts, and it holds in development too: `localhost:3000`
 * and `localhost:4000` differ only by port, which same-site does not count.
 *
 * The refresh cookie is scoped no more narrowly than the access one because
 * the Next.js middleware in `apps/web` reads its *presence* to decide whether
 * a visitor has a session worth refreshing.
 */

type CookieOptions = Parameters<FastifyReply['setCookie']>[2];

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setSessionCookies(
  reply: FastifyReply,
  tokens: {
    accessToken: string;
    accessExpiresAt: Date;
    refreshToken: string;
    refreshExpiresAt: Date;
  }
): void {
  reply.setCookie(SESSION.ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(),
    expires: tokens.accessExpiresAt,
  });
  reply.setCookie(SESSION.REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    expires: tokens.refreshExpiresAt,
  });
}

/** Clears both, with the same attributes they were set with. */
export function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(SESSION.ACCESS_COOKIE, baseOptions());
  reply.clearCookie(SESSION.REFRESH_COOKIE, baseOptions());
}

/** The admin panel's session: one token, under a name of its own. */
export function setAdminSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(ADMIN_SESSION.COOKIE, token, { ...baseOptions(), expires: expiresAt });
}

export function clearAdminSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(ADMIN_SESSION.COOKIE, baseOptions());
}
