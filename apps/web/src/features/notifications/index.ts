/**
 * Notifications — اعلان‌ها: the Notification Center, the opener every row
 * and push lead through, the header's bell, and the notification settings
 * with this device's push subscription.
 *
 * Public surface of the feature; the server-side reads are in `./server`.
 * What a person is sent, and where a notification may lead them, is decided
 * by `apps/api`; this feature shows it and sends the person's choices back.
 */

export { NotificationBell } from './components/NotificationBell';
export { NotificationOpener } from './components/NotificationOpener';
export { NotificationSettingsScreen } from './components/NotificationSettingsScreen';
export { NotificationsScreen } from './components/NotificationsScreen';
