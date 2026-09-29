import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';

import { API_PREFIX } from '@hamdastan/config';

import { env } from './config';
import { isDatabaseConfigured, pingDatabase } from './data';
import { registerErrorHandler } from './middleware';
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
    trustProxy: true,
  });

  await app.register(helmet);
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
    allowedHeaders: ['Content-Type', 'Accept'],
  });

  registerErrorHandler(app);

  /**
   * Readiness probe, outside the versioned prefix so it survives a version
   * bump. A failing downstream dependency reports 503, which is what takes a
   * degraded instance out of rotation instead of letting it serve errors.
   *
   * `skipped` is not a failure: without DATABASE_URL there is no data layer
   * to be degraded about, which is the expected state of a fresh checkout.
   */
  app.get('/health', async (_request, reply) => {
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
