import type { FastifyPluginAsync } from 'fastify';

/**
 * HTTP surface of the Community module — گروه‌ها و تعامل کاربران.
 *
 * Mounted at `${API_PREFIX}/community` by `app.ts`.
 *
 * A route declares the path and the schema, then hands off. It holds no
 * logic of its own and calls nothing below the controller:
 *
 *   app.get('/:id', { schema: communitySchemas.getById }, communityController.getById);
 */
export const communityRoutes: FastifyPluginAsync = async () => {
  // Register this module's routes here.
};
