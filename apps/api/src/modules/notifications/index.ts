/**
 * Notifications — اعلان‌ها
 *
 * Public surface of the module. `modules/index.ts` mounts the routes;
 * `server.ts` binds the repository, the push sender and the logger;
 * `maintenance` runs the dispatcher. Producers — `missions`, `engagement`,
 * `events` — call the `notificationsService` methods named after what
 * happened. Nothing outside reaches past this file.
 */

export { notificationsAdminRoutes, notificationsRoutes } from './notifications.routes';
export { notificationsService, setNotificationsLogger, setPushSender, uniqueKey } from './notifications.service';
export {
  setNotificationsRepository,
  sqlNotificationsRepository,
  type NotificationsRepository,
} from './notifications.repository';
