import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { ActivitiesScreen } from '@/features/engagement';

export const metadata: Metadata = { title: 'استودیو' };

export default async function EngagementPage() {
  await requireAdminPermission('activities.read');
  return <ActivitiesScreen />;
}
