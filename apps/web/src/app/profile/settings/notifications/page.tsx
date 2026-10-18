import type { Metadata } from 'next';

import { NotificationSettingsScreen } from '@/features/notifications';
import { getNotificationPreferences } from '@/features/notifications/server';

export const metadata: Metadata = { title: 'تنظیمات اعلان‌ها' };
export const dynamic = 'force-dynamic';

export default async function NotificationSettingsPage() {
  return <NotificationSettingsScreen preferences={await getNotificationPreferences()} />;
}
