import type { Metadata } from 'next';

import { NotificationsScreen } from '@/features/notifications';
import { getInbox } from '@/features/notifications/server';

export const metadata: Metadata = { title: 'اعلان‌ها' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  return <NotificationsScreen initial={await getInbox()} />;
}
