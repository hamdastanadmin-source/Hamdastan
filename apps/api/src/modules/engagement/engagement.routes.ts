import type { FastifyPluginAsync } from 'fastify';

import { authenticate, authenticateAdmin } from '../../middleware';

import { engagementController as c } from './engagement.controller';

/**
 * HTTP surface of the Engagement module — Engagement Studio.
 *
 * Two plugins, two audiences, one guard each, registered per route as
 * everywhere else:
 *
 *   `/admin/engagement`  the studio — `authenticateAdmin`
 *   `/me/activities`     the person's own activities — `authenticate`
 */

export const engagementAdminRoutes: FastifyPluginAsync = async (app) => {
  const admin = { preHandler: authenticateAdmin };

  app.get('/activities', admin, c.list);
  app.post('/activities', admin, c.create);
  app.get('/activities/:id', admin, c.get);
  app.put('/activities/:id', admin, c.update);
  app.post('/activities/:id/status', admin, c.changeStatus);
  app.post('/activities/:id/duplicate', admin, c.duplicate);
  app.get('/activities/:id/results', admin, c.results);
  app.get('/activities/:id/export', admin, c.exportCsv);
  app.get('/activities/:id/submissions', admin, c.submissions);
  app.get('/activities/:id/grants', admin, c.grants);
  app.get('/activities/:id/history', admin, c.history);
  app.post('/audience/preview', admin, c.previewAudience);
  app.post('/submissions/:id/review', admin, c.review);
  app.post('/xp/:id/revoke', admin, c.revokeXp);
};

export const engagementRoutes: FastifyPluginAsync = async (app) => {
  const user = { preHandler: authenticate };

  app.get('/', user, c.listMine);
  app.get('/:id', user, c.getMine);
  app.put('/:id/draft', user, c.saveDraft);
  app.post('/:id/submit', user, c.submit);
};
