/**
 * Events — رویدادها
 *
 * Public surface of the module. `app.ts` mounts the routes; the data layer
 * binds the repository. Nothing outside reaches past this file.
 */

export { eventsRoutes } from './events.routes';
export { eventsService } from './events.service';
export { setEventsRepository, type EventsRepository } from './events.repository';
