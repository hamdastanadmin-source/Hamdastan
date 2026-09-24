import type { FastifyPluginAsync } from 'fastify';

/**
 * HTTP surface of the Notifications module — اعلان‌ها.
 *
 * Mounted at `${API_PREFIX}/notifications` by `app.ts`.
 *
 * A route declares the path and the schema, then hands off. It holds no
 * logic of its own and calls nothing below the controller:
 *
 *   app.get('/:id', { schema: notificationsSchemas.getById }, notificationsController.getById);
 */
export const notificationsRoutes: FastifyPluginAsync = async () => {
  // Register this module's routes here.
};
