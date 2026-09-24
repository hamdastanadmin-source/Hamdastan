import type { FastifyPluginAsync } from 'fastify';

/**
 * HTTP surface of the Missions module — ماموریت‌ها.
 *
 * Mounted at `${API_PREFIX}/missions` by `app.ts`.
 *
 * A route declares the path and the schema, then hands off. It holds no
 * logic of its own and calls nothing below the controller:
 *
 *   app.get('/:id', { schema: missionsSchemas.getById }, missionsController.getById);
 */
export const missionsRoutes: FastifyPluginAsync = async () => {
  // Register this module's routes here.
};
