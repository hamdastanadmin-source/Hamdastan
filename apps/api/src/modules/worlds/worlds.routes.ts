import type { FastifyPluginAsync } from 'fastify';

import { authenticate, requireAdminPermission as can } from '../../middleware';

import { worldsController as c } from './worlds.controller';

/**
 * HTTP surface of the Worlds module — the world list.
 *
 *   `/worlds`        the active worlds, for the product — `authenticate`
 *   `/admin/worlds`  keeping the list — reading needs `events.read` (the
 *                    event editor picks from it), changing it `worlds.manage`
 */

export const worldsRoutes: FastifyPluginAsync = async (app) => {
  const user = { preHandler: authenticate };

  app.get('/', user, c.list);
  app.get('/:slug', user, c.getBySlug);
};

export const worldsAdminRoutes: FastifyPluginAsync = async (app) => {
  const guard = (permission: Parameters<typeof can>[0]) => ({ preHandler: can(permission) });

  app.get('/', guard('events.read'), c.listAll);
  app.post('/', guard('worlds.manage'), c.create);
  app.put('/order', guard('worlds.manage'), c.reorder);
  app.put('/:id', guard('worlds.manage'), c.update);
  app.delete('/:id', guard('worlds.manage'), c.remove);
};
