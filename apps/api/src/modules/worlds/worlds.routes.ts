import type { FastifyPluginAsync } from 'fastify';

import { authenticate, requireAdminPermission as can } from '../../middleware';

import { worldsController as c } from './worlds.controller';

/**
 * HTTP surface of the Worlds module.
 *
 *   `/worlds`        the published worlds and a world's home, for the
 *                    product — `authenticate`
 *   `/admin/worlds`  the world CMS — reading needs `worlds.read` (every
 *                    editor that files content under a world picks from
 *                    it), changing anything `worlds.manage`
 */

export const worldsRoutes: FastifyPluginAsync = async (app) => {
  const user = { preHandler: authenticate };

  app.get('/', user, c.list);
  app.get('/:slug', user, c.getBySlug);
  app.get('/:slug/home', user, c.home);
  app.get('/:slug/activities', user, c.activities);
};

export const worldsAdminRoutes: FastifyPluginAsync = async (app) => {
  const guard = (permission: Parameters<typeof can>[0]) => ({ preHandler: can(permission) });

  app.get('/', guard('worlds.read'), c.listAll);
  app.post('/', guard('worlds.manage'), c.create);
  app.put('/order', guard('worlds.manage'), c.reorder);
  app.get('/:id', guard('worlds.read'), c.adminGet);
  app.put('/:id', guard('worlds.manage'), c.update);
  app.post('/:id/status', guard('worlds.manage'), c.changeStatus);
  app.delete('/:id', guard('worlds.manage'), c.remove);
  app.get('/:id/home', guard('worlds.read'), c.getHome);
  app.put('/:id/home', guard('worlds.manage'), c.saveHome);
  app.get('/:id/home/candidates', guard('worlds.read'), c.candidates);
  app.get('/:id/preview', guard('worlds.read'), c.preview);
};
