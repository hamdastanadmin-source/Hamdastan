import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';

import { API_PREFIX } from '@hamdastan/config';

import { env } from './config';
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
  await app.register(cors, {
    origin: env.corsOrigins,
    // The front-end apps send the session cookie.
    credentials: true,
  });

  registerErrorHandler(app);

  /**
   * Liveness probe, outside the versioned prefix so it survives a version
   * bump. There are no downstream dependencies to check yet; when a data
   * layer is added, probe it here and fold the result into `checks` so a
   * degraded instance reports 503 and leaves rotation.
   */
  app.get('/health', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'error'> = {};
    const healthy = Object.values(checks).every((value) => value === 'ok');

    return reply
      .status(healthy ? 200 : 503)
      .send(ok({ status: healthy ? 'healthy' : 'degraded', checks, uptime: process.uptime() }));
  });

  for (const { prefix, routes } of moduleRoutes) {
    await app.register(routes, { prefix: `${API_PREFIX}${prefix}` });
  }

  return app;
}
