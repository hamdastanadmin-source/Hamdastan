import { cookies } from 'next/headers';

import type { NotificationInbox, NotificationPreferences } from '@hamdastan/types';

import { notificationsService } from '@/services';

/**
 * Notifications read on the server with the request's own cookies, so the
 * screens open complete. What cannot be read is `null` — the screen says
 * so — and the header's count is simply 0.
 */

const cookie = async () => (await cookies()).toString();

export async function getInbox(): Promise<NotificationInbox | null> {
  return notificationsService.inbox('all', undefined, { cookie: await cookie() }).catch(() => null);
}

/** Home's bell; home never fails because of it. */
export async function getUnreadCount(): Promise<number> {
  return notificationsService.unread({ cookie: await cookie() }).then(({ unread }) => unread, () => 0);
}

/** Null when it cannot be read — the screen says so and offers to try again. */
export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  return notificationsService.preferences({ cookie: await cookie() }).catch(() => null);
}
