import type { FastifyPluginAsync } from 'fastify';

import { requireAdminPermission as can } from '../../middleware';

import { mediaController as c } from './media.controller';

/**
 * HTTP surface of the Media module — the media & motion library.
 *
 *   `/admin/media`  the library — the activity permissions: it holds what
 *                   activities are built from
 *   `/media`        the files themselves, for both apps to draw. Public:
 *                   an id is unguessable, and the same file may be on a
 *                   card anyone in an audience sees. Not rate limited —
 *                   a screen of images is many cheap, cached reads.
 */

export const mediaAdminRoutes: FastifyPluginAsync = async (app) => {
  const guard = (permission: Parameters<typeof can>[0]) => ({ preHandler: can(permission) });

  app.get('/', guard('activities.read'), c.list);
  app.post('/', guard('activities.write'), c.upload);
  app.get('/:id', guard('activities.read'), c.get);
  app.patch('/:id', guard('activities.write'), c.update);
  app.put('/:id/file', guard('activities.write'), c.replace);
  app.delete('/:id', guard('activities.write'), c.remove);
};

export const mediaRoutes: FastifyPluginAsync = async (app) => {
  const open = { config: { rateLimit: false as const } };

  app.get('/:id', open, c.file);
  app.get('/:id/lottie', open, c.lottie);
};
