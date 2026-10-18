import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { CampaignEditor } from '@/features/notifications';

export const metadata: Metadata = { title: 'اعلان جدید' };

export default async function NewCampaignPage() {
  await requireAdminPermission('notifications.write');
  return <CampaignEditor initial={null} />;
}
