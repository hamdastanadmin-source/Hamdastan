import type { FastifyPluginAsync } from 'fastify';

/**
 * HTTP surface of the Events module — رویدادها.
 *
 * Mounted at `${API_PREFIX}/events` by `app.ts`.
 *
 * A route declares the path and the schema, then hands off. It holds no
 * logic of its own and calls nothing below the controller:
 *
 *   app.get('/:id', { schema: eventsSchemas.getById }, eventsController.getById);
 */
export const eventsRoutes: FastifyPluginAsync = async () => {
  // Register this module's routes here.
};
