import type { FastifyPluginAsync } from 'fastify';

import { authenticate, requireAdminPermission as can } from '../../middleware';

import { eventsController as c } from './events.controller';

/**
 * HTTP surface of the Events module — رویدادها.
 *
 *   `/events`        discovery, the calendar, the detail page, interest and
 *                    booking — `authenticate`; what a person may see is the
 *                    repository's rule, not the route's
 *   `/me/events`     «رویدادهای من»
 *   `/admin/events`  the panel — `requireAdminPermission(…)`, per route
 *
 * Fixed paths (`/calendar`, `/categories`) win over `/:slug`, and the slug
 * schema reserves them.
 */

export const eventsRoutes: FastifyPluginAsync = async (app) => {
  const user = { preHandler: authenticate };

  app.get('/', user, c.list);
  app.get('/calendar', user, c.calendar);
  app.get('/categories', user, c.categories);
  app.get('/:slug', user, c.get);
  app.get('/:slug/related', user, c.related);
  app.put('/:id/interest', user, c.setInterest);
  app.delete('/:id/interest', user, c.removeInterest);
  app.post('/:id/registrations', user, c.register);
  app.delete('/:id/registrations', user, c.cancelRegistration);
  app.post('/:id/booking-handoff', user, c.handoff);
};

export const myEventsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: authenticate }, c.listMine);
};

export const eventsAdminRoutes: FastifyPluginAsync = async (app) => {
  // Each route names the permission it needs; the role table decides who has it.
  const guard = (permission: Parameters<typeof can>[0]) => ({ preHandler: can(permission) });

  app.get('/', guard('events.read'), c.adminList);
  app.post('/', guard('events.write'), c.create);
  app.post('/audience/preview', guard('events.read'), c.previewAudience);
  app.post('/bookings/:id', guard('events.write'), c.reviewBooking);

  app.get('/categories', guard('events.read'), c.adminCategories);
  app.post('/categories', guard('events.write'), c.createCategory);
  app.put('/categories/order', guard('events.write'), c.reorderCategories);
  app.put('/categories/:id', guard('events.write'), c.updateCategory);
  app.delete('/categories/:id', guard('events.write'), c.removeCategory);

  app.get('/:id', guard('events.read'), c.adminGet);
  app.put('/:id', guard('events.write'), c.update);
  app.post('/:id/status', guard('events.publish'), c.changeStatus);
  app.post('/:id/duplicate', guard('events.write'), c.duplicate);
  app.get('/:id/preview', guard('events.read'), c.preview);
  app.get('/:id/history', guard('events.read'), c.history);
  app.get('/:id/bookings', guard('events.read'), c.listBookings);
};
