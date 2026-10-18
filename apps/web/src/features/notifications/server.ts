/**
 * Notifications — server-only surface. Kept apart from `./index` so a client
 * component cannot pull `next/headers` into its bundle.
 */

export { getInbox, getNotificationPreferences, getUnreadCount } from './services/notifications.server';
