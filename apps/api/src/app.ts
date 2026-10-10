import { randomUUID } from 'node:crypto';

import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';

import { API_PREFIX } from '@hamdastan/config';

import { env } from './config';
import { isDatabaseConfigured, pingDatabase } from './data';
import { registerCsrfProtection, registerErrorHandler, registerRateLimit } from './middleware';
import { moduleRoutes } from './modules';
import { ok } from './shared/response';

/**
 * Builds the server without starting it, so tests can drive it in-process
 * through `app.inject()` instead of binding a port.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: env.isDevelopment
        ? {
            target: 'pino-pretty',
            options: { colorize: true, ignore: 'pid,hostname', translateTime: 'SYS:standard' },
          }
        : undefined,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
        remove: true,
      },
    },
    // Only the addresses in TRUST_PROXY — nginx's, in production — may say
    // who the client is. Anything wider lets a caller write its own
    // X-Forwarded-For and pick the address every per-IP limit counts.
    trustProxy: env.trustProxy,
    // nginx's `$request_id` (32 hex characters) when it sent one, so a
    // request has one id in the access log and in this log. Anything else —
    // a client's own header in development, say — is not trusted as an id
    // and a fresh one is made.
    requestIdHeader: false,
    genReqId: (request) => {
      const header = request.headers['x-request-id'];
      return typeof header === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(header) ? header : randomUUID();
    },
    bodyLimit: env.HTTP_BODY_LIMIT_BYTES,
    requestTimeout: env.HTTP_REQUEST_TIMEOUT_MS,
  });

  // HSTS is nginx's (deploy/nginx.conf), deliberately without
  // includeSubDomains or preload, which are hard to take back. helmet's
  // default would send a second, stricter header beside it.
  await app.register(helmet, { strictTransportSecurity: false });
  // Session tokens travel as httpOnly cookies, so every request has to be
  // able to read them — see `shared/cookies.ts` for why not localStorage.
  await app.register(cookie);
  await app.register(cors, {
    origin: env.corsOrigins,
    // The front-end apps send the session cookie.
    credentials: true,
    // Spelled out rather than left to the default, which does not include
    // PUT — and `PUT /me/basic-info` is how the profile form submits.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // `Idempotency-Key` makes a write retryable (shared/idempotency.ts).
    allowedHeaders: ['Content-Type', 'Accept', 'Idempotency-Key'],
    // Read by the clients' retry policy: when to try again, and how much
    // budget is left.
    exposedHeaders: [
      'Retry-After',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-ID',
    ],
  });

  // Echoed, so a client reporting a failure can quote the id that finds it.
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  registerErrorHandler(app);
  registerCsrfProtection(app);
  // Before any route, so its onRoute hook sees every one of them.
  await registerRateLimit(app);

  /**
   * Readiness probe, outside the versioned prefix so it survives a version
   * bump. A failing downstream dependency reports 503, which is what takes a
   * degraded instance out of rotation instead of letting it serve errors.
   *
   * `skipped` is not a failure: without DATABASE_URL there is no data layer
   * to be degraded about, which is the expected state of a fresh checkout.
   */
  app.get('/health', { config: { rateLimit: false } }, async (_request, reply) => {
    const checks: Record<string, 'ok' | 'error' | 'skipped'> = {
      database: !isDatabaseConfigured()
        ? 'skipped'
        : (await pingDatabase())
          ? 'ok'
          : 'error',
    };
    const healthy = Object.values(checks).every((value) => value !== 'error');

    return reply
      .status(healthy ? 200 : 503)
      .send(ok({ status: healthy ? 'healthy' : 'degraded', checks, uptime: process.uptime() }));
  });

  for (const { prefix, routes } of moduleRoutes) {
    await app.register(routes, { prefix: `${API_PREFIX}${prefix}` });
  }

  return app;
}
