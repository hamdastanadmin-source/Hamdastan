import type { FastifyPluginAsync } from 'fastify';

import { authenticate, rateLimits, requireAdminPermission as can } from '../../middleware';

import { engagementController as c } from './engagement.controller';

/**
 * HTTP surface of the Engagement module — Engagement Studio.
 *
 * Two plugins, two audiences, one guard each, registered per route as
 * everywhere else:
 *
 *   `/admin/engagement`  the studio — `requireAdminPermission(…)`, per route
 *   `/me/activities`     the person's own activities — `authenticate`
 */

export const engagementAdminRoutes: FastifyPluginAsync = async (app) => {
  // Each route names the permission it needs; the role table decides who has it.
  const guard = (permission: Parameters<typeof can>[0]) => ({ preHandler: can(permission) });

  app.get('/activities', guard('activities.read'), c.list);
  app.post('/activities', guard('activities.write'), c.create);
  app.get('/activities/:id', guard('activities.read'), c.get);
  app.put('/activities/:id', guard('activities.write'), c.update);
  app.post('/activities/:id/status', guard('activities.publish'), c.changeStatus);
  app.post('/activities/:id/duplicate', guard('activities.write'), c.duplicate);
  app.get('/activities/:id/results', guard('results.read'), c.results);
  app.get('/activities/:id/export', guard('results.export'), c.exportCsv);
  app.get('/activities/:id/submissions', guard('results.individual'), c.submissions);
  app.get('/activities/:id/grants', guard('xp.read'), c.grants);
  app.get('/activities/:id/history', guard('activities.read'), c.history);
  app.post('/audience/preview', guard('activities.read'), c.previewAudience);
  app.post('/submissions/:id/review', guard('submissions.review'), c.review);
  app.post('/xp/:id/revoke', guard('xp.revoke'), c.revokeXp);
};

export const engagementRoutes: FastifyPluginAsync = async (app) => {
  const user = { preHandler: authenticate };

  app.get('/', user, c.listMine);
  app.get('/:id', user, c.getMine);
  app.put('/:id/draft', user, c.saveDraft);
  app.post('/:id/submit', { ...user, config: { rateLimit: rateLimits.submit } }, c.submit);
};
