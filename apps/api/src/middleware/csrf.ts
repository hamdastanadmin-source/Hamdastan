import type { FastifyInstance } from 'fastify';

import { env } from '../config';
import { AppError } from '../shared/errors';

/**
 * Cross-site request forgery, refused at the door.
 *
 * Sessions are cookies, so a browser on another site could be made to send
 * them. `SameSite=Lax` already keeps them off a cross-site POST; these are
 * the two server-side checks behind it, for every request that changes
 * state:
 *
 *   • **Origin.** A browser names the page a request came from. A
 *     state-changing request whose `Origin` is not one of `CORS_ORIGINS` —
 *     or is `null`, an opaque sandboxed page — is refused, as is one the
 *     browser itself labels `Sec-Fetch-Site: cross-site`. A request with
 *     neither header is not from a browser page (the Next server, curl) and
 *     carries no ambient credentials to abuse.
 *   • **JSON only.** An HTML form can post `text/plain`, urlencoded or
 *     multipart without a CORS preflight; it cannot post
 *     `application/json`. Fastify's default `text/plain` parser is removed,
 *     so those bodies are a 415 before any handler sees them.
 */

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function registerCsrfProtection(app: FastifyInstance): void {
  app.removeContentTypeParser('text/plain');

  const allowed = new Set(env.corsOrigins);

  app.addHook('onRequest', async (request) => {
    if (!UNSAFE.has(request.method)) return;

    const site = request.headers['sec-fetch-site'];
    const origin = request.headers.origin;
    const foreignOrigin = origin !== undefined && !allowed.has(origin);

    if (site === 'cross-site' || foreignOrigin) {
      request.log.warn(
        { csrf: { origin: origin ?? null, site: site ?? null, route: request.url.split('?')[0] } },
        'cross-site request refused'
      );
      throw new AppError(403, 'CSRF_REJECTED', 'این درخواست از جای دیگه‌ای فرستاده شده و پذیرفته نشد');
    }
  });
}
