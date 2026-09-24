import type { FastifyPluginAsync } from 'fastify';

/**
 * HTTP surface of the Users module — حساب کاربری و پروفایل.
 *
 * Mounted at `${API_PREFIX}/users` by `app.ts`.
 *
 * A route declares the path and the schema, then hands off. It holds no
 * logic of its own and calls nothing below the controller:
 *
 *   app.get('/:id', { schema: usersSchemas.getById }, usersController.getById);
 */
export const usersRoutes: FastifyPluginAsync = async () => {
  // Register this module's routes here.
};
