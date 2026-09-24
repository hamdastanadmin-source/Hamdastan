import type { FastifyPluginAsync } from 'fastify';

/**
 * HTTP surface of the Worlds module — دنیاها و ساختار آن‌ها.
 *
 * Mounted at `${API_PREFIX}/worlds` by `app.ts`.
 *
 * A route declares the path and the schema, then hands off. It holds no
 * logic of its own and calls nothing below the controller:
 *
 *   app.get('/:id', { schema: worldsSchemas.getById }, worldsController.getById);
 */
export const worldsRoutes: FastifyPluginAsync = async () => {
  // Register this module's routes here.
};
