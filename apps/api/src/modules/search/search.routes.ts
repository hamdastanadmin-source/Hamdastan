import type { FastifyPluginAsync } from 'fastify';

/**
 * HTTP surface of the Search module — جستجوی سراسری.
 *
 * Mounted at `${API_PREFIX}/search` by `app.ts`.
 *
 * A route declares the path and the schema, then hands off. It holds no
 * logic of its own and calls nothing below the controller:
 *
 *   app.get('/:id', { schema: searchSchemas.getById }, searchController.getById);
 */
export const searchRoutes: FastifyPluginAsync = async () => {
  // Register this module's routes here.
};
