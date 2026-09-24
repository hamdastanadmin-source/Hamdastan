import type { FastifyPluginAsync } from 'fastify';

/**
 * HTTP surface of the Auth module — ورود، خروج و نشست کاربر.
 *
 * Mounted at `${API_PREFIX}/auth` by `app.ts`.
 *
 * A route declares the path and the schema, then hands off. It holds no
 * logic of its own and calls nothing below the controller:
 *
 *   app.get('/:id', { schema: authSchemas.getById }, authController.getById);
 */
export const authRoutes: FastifyPluginAsync = async () => {
  // Register this module's routes here.
};
