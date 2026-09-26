import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';

import { API_PREFIX } from '@hamdastan/config';

import { env } from './config';
import { registerErrorHandler } from './middleware';
import { moduleRoutes } from './modules';
import {
  createInMemoryAdminAuthRepository,
  setAdminAuthRepository,
} from './modules/admin-auth';
import {
  createInMemoryAdminUserStore,
  createInMemoryAdminUsersRepository,
  seedDevelopmentAdmin,
  setAdminUsersRepository,
} from './modules/admin-users';
import { createInMemoryAuthRepository, setAuthRepository } from './modules/auth';
import { createInMemoryFormsRepository, setFormsRepository } from './modules/forms';
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

  // Sessions travel in an httpOnly cookie, so the auth controller needs to be
  // able to read and write one.
  await app.register(cookie);
  await app.register(helmet);
  await app.register(cors, {
    origin: env.corsOrigins,
    // The front-end apps send the session cookie.
    credentials: true,
    /**
     * Spelled out because the default is `GET,HEAD,POST`, and the browser
     * enforces it: without `PATCH` and `DELETE` here, the preflight refuses
     * them and every edit, autosave and delete fails in the browser while
     * working perfectly from curl — which is exactly the kind of bug that
     * survives a backend test suite.
     */
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  registerErrorHandler(app);

  /**
   * No data layer has been chosen yet, so the auth module runs on the in-memory
   * stand-in declared beside its port. Binding it here rather than in
   * `server.ts` means the tests drive the same wiring the process does, and a
   * fresh `buildApp()` starts from an empty store.
   *
   * Not in production, though: a per-instance user store that loses everybody
   * on restart must fail loudly rather than serve traffic, so there the
   * repository stays unbound and every auth route answers 501 until a real
   * implementation is bound here — see database/README.md.
   */
  if (!env.isProduction) {
    setAuthRepository(createInMemoryAuthRepository());

    /**
     * The admin panel, on the same terms. Both admin ports describe one future
     * table, so both stand-ins are built over one store — see
     * `admin-users.repository.ts`.
     *
     * The development admin is seeded here because admins cannot register
     * themselves: with an empty store and no seed, the panel would have no way
     * in at all. The account starts owing a password change, so a first sign-in
     * walks the forced-change flow rather than stepping around it.
     */
    const adminStore = createInMemoryAdminUserStore();
    const adminUsers = createInMemoryAdminUsersRepository(adminStore);

    setAdminUsersRepository(adminUsers);
    setAdminAuthRepository(createInMemoryAdminAuthRepository(adminStore));

    await seedDevelopmentAdmin(adminUsers);

    /**
     * Forms, their responses and the templates a new form starts from. Seeded
     * with realistic Persian content, so the dashboard, the builder and the
     * charts all have something true to render before anybody has typed
     * anything.
     */
    setFormsRepository(createInMemoryFormsRepository());
  }

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
