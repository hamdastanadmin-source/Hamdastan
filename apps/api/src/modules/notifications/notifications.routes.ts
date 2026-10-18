import type { FastifyPluginAsync } from 'fastify';

import { authenticate, rateLimits, requireAdminPermission as can } from '../../middleware';

import { notificationsController as c } from './notifications.controller';

/**
 * HTTP surface of the Notifications module — اعلان‌ها.
 *
 *   `/notifications`        the person's inbox, preferences and push
 *                           subscription — `authenticate`; every query is
 *                           scoped to the signed-in person
 *   `/admin/notifications`  campaigns — `requireAdminPermission(…)` per
 *                           route; sending to everyone is checked again in
 *                           the service (`notifications.broadcast`)
 */

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  const user = { preHandler: authenticate };

  app.get('/', user, c.inbox);
  app.get('/unread', user, c.unread);
  app.post('/read', user, c.markRead);
  app.get('/preferences', user, c.preferences);
  app.put('/preferences', user, c.savePreferences);
  app.post('/push/subscriptions', user, c.subscribe);
  app.post('/push/unsubscribe', user, c.unsubscribe);
  app.post('/:id/open', user, c.open);
  app.delete('/:id', user, c.dismiss);
};

export const notificationsAdminRoutes: FastifyPluginAsync = async (app) => {
  const guard = (permission: Parameters<typeof can>[0]) => ({ preHandler: can(permission) });
  const sending = { ...guard('notifications.send'), config: { rateLimit: rateLimits.campaignSend } };

  app.get('/overview', guard('notifications.read'), c.overview);
  app.get('/options', guard('notifications.write'), c.options);
  app.post('/audience', guard('notifications.write'), c.estimate);

  app.get('/campaigns', guard('notifications.read'), c.list);
  app.post('/campaigns', guard('notifications.write'), c.create);
  app.get('/campaigns/:id', guard('notifications.read'), c.get);
  app.put('/campaigns/:id', guard('notifications.write'), c.update);
  app.post('/campaigns/:id/duplicate', guard('notifications.write'), c.duplicate);
  app.post('/campaigns/:id/archive', guard('notifications.write'), c.archive);
  app.post('/campaigns/:id/send', sending, c.send);
  app.post('/campaigns/:id/cancel', guard('notifications.send'), c.cancel);
  app.post('/campaigns/:id/stop-push', guard('notifications.send'), c.stopPush);
  app.get('/campaigns/:id/report', guard('notifications.read'), c.report);
  app.get('/campaigns/:id/history', guard('notifications.read'), c.history);
};
