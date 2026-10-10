import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { ActivityResultsScreen } from '@/features/engagement';

export const metadata: Metadata = { title: 'نتایج فعالیت' };

export default async function ActivityResultsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPermission('results.read');
  const { id } = await params;
  return <ActivityResultsScreen id={id} />;
}
