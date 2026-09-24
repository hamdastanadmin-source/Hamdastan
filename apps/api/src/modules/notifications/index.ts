/**
 * Notifications — اعلان‌ها
 *
 * Public surface of the module. `app.ts` mounts the routes; the data layer
 * binds the repository. Nothing outside reaches past this file.
 */

export { notificationsRoutes } from './notifications.routes';
export { notificationsService } from './notifications.service';
export { setNotificationsRepository, type NotificationsRepository } from './notifications.repository';
