import type { FastifyPluginAsync } from 'fastify';

import { authenticate, requireAdminPermission as can } from '../../middleware';

import { contentController as c } from './content.controller';

/**
 * HTTP surface of the Content module — محتوای دنیاها.
 *
 *   `/content`        live articles for the product — `authenticate`; what
 *                     may be seen is the repository's `LIVE` rule, and
 *                     only a live article takes a like or dislike
 *   `/admin/content`  the central content index and the article editor —
 *                     `requireAdminPermission(…)`, per route
 */

export const contentRoutes: FastifyPluginAsync = async (app) => {
  const user = { preHandler: authenticate };

  app.get('/articles', user, c.list);
  app.get('/articles/:slug', user, c.get);
  app.put('/articles/:id/reaction', user, c.react);
};

export const contentAdminRoutes: FastifyPluginAsync = async (app) => {
  // Each route names the permission it needs; the role table decides who has it.
  const guard = (permission: Parameters<typeof can>[0]) => ({ preHandler: can(permission) });

  app.get('/', guard('content.read'), c.index);
  app.get('/articles', guard('content.read'), c.adminList);
  app.post('/articles', guard('content.write'), c.create);
  app.get('/articles/:id', guard('content.read'), c.adminGet);
  app.put('/articles/:id', guard('content.write'), c.update);
  app.post('/articles/:id/status', guard('content.publish'), c.changeStatus);
  app.get('/articles/:id/preview', guard('content.read'), c.preview);
  app.get('/articles/:id/history', guard('content.read'), c.history);
};
