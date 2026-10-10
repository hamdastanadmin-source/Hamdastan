import type { Metadata } from 'next';

import { ActivityResultsScreen } from '@/features/engagement';

export const metadata: Metadata = { title: 'نتایج فعالیت' };

export default async function ActivityResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ActivityResultsScreen id={id} />;
}
