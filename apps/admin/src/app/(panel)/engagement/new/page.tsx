import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { ActivityEditor } from '@/features/engagement';

export const metadata: Metadata = { title: 'فعالیت جدید' };

export default async function NewActivityPage() {
  await requireAdminPermission('activities.write');
  return <ActivityEditor />;
}
