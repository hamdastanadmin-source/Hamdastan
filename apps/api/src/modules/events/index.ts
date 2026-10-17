/**
 * Events — رویدادها: discovery, the detail page, interest, registration and
 * the handoff to Fidibo Art for the product; events, their categories and
 * bookings for the panel.
 *
 * Public surface of the module. `modules/index.ts` mounts the route plugins;
 * `server.ts` binds the repository.
 */

export { eventsAdminRoutes, eventsRoutes, myEventsRoutes } from './events.routes';
export { eventsService } from './events.service';
export { setEventsRepository, sqlEventsRepository, type EventsRepository } from './events.repository';
