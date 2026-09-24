import type { FastifyPluginAsync } from 'fastify';

/**
 * HTTP surface of the Commerce module — خرید و پرداخت.
 *
 * Mounted at `${API_PREFIX}/commerce` by `app.ts`.
 *
 * A route declares the path and the schema, then hands off. It holds no
 * logic of its own and calls nothing below the controller:
 *
 *   app.get('/:id', { schema: commerceSchemas.getById }, commerceController.getById);
 */
export const commerceRoutes: FastifyPluginAsync = async () => {
  // Register this module's routes here.
};
