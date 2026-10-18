import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { CampaignsScreen } from '@/features/notifications';

export const metadata: Metadata = { title: 'اعلان‌ها' };

export default async function NotificationsPage() {
  await requireAdminPermission('notifications.read');
  return <CampaignsScreen />;
}
