import type { FastifyPluginAsync } from 'fastify';

/**
 * HTTP surface of the Content module — محتوای دنیاها.
 *
 * Mounted at `${API_PREFIX}/content` by `app.ts`.
 *
 * A route declares the path and the schema, then hands off. It holds no
 * logic of its own and calls nothing below the controller:
 *
 *   app.get('/:id', { schema: contentSchemas.getById }, contentController.getById);
 */
export const contentRoutes: FastifyPluginAsync = async () => {
  // Register this module's routes here.
};
