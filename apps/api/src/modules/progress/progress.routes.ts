import type { FastifyPluginAsync } from 'fastify';

/**
 * HTTP surface of the Progress module — پیشرفت و دستاوردهای کاربر.
 *
 * Mounted at `${API_PREFIX}/progress` by `app.ts`.
 *
 * A route declares the path and the schema, then hands off. It holds no
 * logic of its own and calls nothing below the controller:
 *
 *   app.get('/:id', { schema: progressSchemas.getById }, progressController.getById);
 */
export const progressRoutes: FastifyPluginAsync = async () => {
  // Register this module's routes here.
};
