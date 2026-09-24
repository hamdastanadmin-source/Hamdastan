import type { FastifyPluginAsync } from 'fastify';

/**
 * HTTP surface of the Trivia module — پرسش‌های تریویا.
 *
 * Mounted at `${API_PREFIX}/trivia` by `app.ts`.
 *
 * A route declares the path and the schema, then hands off. It holds no
 * logic of its own and calls nothing below the controller:
 *
 *   app.get('/:id', { schema: triviaSchemas.getById }, triviaController.getById);
 */
export const triviaRoutes: FastifyPluginAsync = async () => {
  // Register this module's routes here.
};
