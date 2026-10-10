import rateLimit, { type RateLimitOptions } from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { SESSION } from '@hamdastan/config';

import { env } from '../config';
import { sha256 } from '../shared/crypto';
import { AppError } from '../shared/errors';

import { slidingWindowStore } from './rate-limit-store';

/**
 * Request rate limits — the API's half of the defence; nginx's `limit_req`
 * (deploy/nginx.conf) is the coarse per-address half in front of it.
 *
 * Every route gets exactly one policy. A route that names one in
 * `config.rateLimit` gets that; every other route gets the default below,
 * keyed by *who* is calling rather than from where:
 *
 *   an admin session   per admin, reads and writes counted separately
 *   a user session     per user, reads and writes counted separately
 *   no session         per address
 *
 * Keying signed-in traffic by account is what keeps an office or a mobile
 * carrier's NAT — many people, one address — from sharing one budget, and it
 * is also why the server-rendered calls `apps/web` makes on a visitor's
 * behalf need no client address at all: they carry the visitor's cookie.
 *
 * The check runs as a `preHandler`, after the route's own `authenticate`, so
 * `request.user` and `request.admin` are known. A request with a dead
 * session is refused by `authenticate` before it is counted; at 256 bits a
 * token cannot be guessed, and nginx limits such floods per address.
 */

const MINUTE = 60_000;

/** Never the raw key in a log: it is an address, a user id, a token hash. */
const fingerprint = (key: string) => sha256(key).slice(0, 16);

const isRead = (request: FastifyRequest) =>
  request.method === 'GET' || request.method === 'HEAD';

function defaultKey(request: FastifyRequest): string {
  if (request.admin) return `admin-${isRead(request) ? 'read' : 'write'}:${request.admin.id}`;
  if (request.user) return `user-${isRead(request) ? 'read' : 'write'}:${request.user.id}`;
  return `ip:${request.ip}`;
}

function defaultMax(request: FastifyRequest): number {
  if (request.admin) {
    return isRead(request) ? env.RATE_LIMIT_ADMIN_READ_PER_MINUTE : env.RATE_LIMIT_ADMIN_WRITE_PER_MINUTE;
  }
  if (request.user) {
    return isRead(request) ? env.RATE_LIMIT_USER_READ_PER_MINUTE : env.RATE_LIMIT_USER_WRITE_PER_MINUTE;
  }
  return env.RATE_LIMIT_ANONYMOUS_PER_MINUTE;
}

/** The per-route policies. A route opts in with `config: { rateLimit: … }`. */
export const rateLimits = {
  /**
   * Both code checks. The per-number lock (`OTP_MAX_FAILURES`) is the real
   * brute-force guard; this caps one address spraying many numbers.
   */
  otpVerify: {
    max: env.RATE_LIMIT_OTP_VERIFY_PER_15_MINUTES,
    timeWindow: 15 * MINUTE,
    keyGenerator: (request) => `otp-verify:${request.ip}`,
  },
  /**
   * Per refresh token. Rotation means a token lives one refresh, so this is
   * how often a single token may be presented — a client racing itself
   * stays well under it, a replay loop does not.
   */
  refresh: {
    max: env.RATE_LIMIT_REFRESH_PER_MINUTE,
    timeWindow: MINUTE,
    keyGenerator: (request) => {
      const token = request.cookies[SESSION.REFRESH_COOKIE];
      return token ? `refresh:${sha256(token)}` : `refresh-ip:${request.ip}`;
    },
  },
  /** Per user and activity: a submit button cannot be held down. */
  submit: {
    max: env.RATE_LIMIT_SUBMIT_PER_MINUTE,
    timeWindow: MINUTE,
    keyGenerator: (request) =>
      `submit:${request.user?.id ?? request.ip}:${(request.params as { id?: string }).id ?? ''}`,
  },
} satisfies Record<string, RateLimitOptions>;

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  if (!env.RATE_LIMIT_ENABLED) return;

  await app.register(rateLimit, {
    global: true,
    hook: 'preHandler',
    timeWindow: MINUTE,
    max: defaultMax,
    keyGenerator: defaultKey,
    store: slidingWindowStore(env.RATE_LIMIT_MAX_KEYS),
    // `Retry-After` and the `x-ratelimit-*` headers are the plugin's; the
    // body is the API's own envelope, with the wait in seconds as well.
    errorResponseBuilder: (_request, context) =>
      new AppError(429, 'RATE_LIMITED', 'درخواست‌ها زیاد بود، کمی بعد دوباره امتحان کن', {
        retryAfter: Math.ceil(context.ttl / 1000),
      }),
    onExceeded: (request, key) => {
      request.log.warn(
        { rateLimit: { route: request.routeOptions.url, method: request.method, key: fingerprint(key) } },
        'rate limit exceeded'
      );
    },
  });
}
