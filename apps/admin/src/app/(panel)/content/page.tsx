import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { ContentScreen } from '@/features/content';

export const metadata: Metadata = { title: 'محتوا' };

export default async function ContentPage() {
  await requireAdminPermission('content.read');
  return <ContentScreen />;
}
