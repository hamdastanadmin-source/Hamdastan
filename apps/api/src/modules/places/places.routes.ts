import type { FastifyPluginAsync } from 'fastify';

import { authenticate, requireAdminPermission as can } from '../../middleware';

import { placesController as c } from './places.controller';

/**
 * HTTP surface of the Places module.
 *
 *   `/worlds/:slug/places`  a world's map and the places on it, for the
 *                           product — `authenticate`
 *   `/admin/places`         building them — reading needs `worlds.read`,
 *                           changing anything `worlds.manage`: a place is
 *                           part of its world.
 */

export const placesRoutes: FastifyPluginAsync = async (app) => {
  const user = { preHandler: authenticate };

  app.get('/map', user, c.map);
  app.get('/:id', user, c.view);
};

export const placesAdminRoutes: FastifyPluginAsync = async (app) => {
  const guard = (permission: Parameters<typeof can>[0]) => ({ preHandler: can(permission) });

  app.get('/', guard('worlds.read'), c.list);
  app.post('/', guard('worlds.manage'), c.create);
  app.get('/:id', guard('worlds.read'), c.get);
  app.put('/:id', guard('worlds.manage'), c.update);
  app.post('/:id/status', guard('worlds.manage'), c.changeStatus);
  app.delete('/:id', guard('worlds.manage'), c.remove);
};
