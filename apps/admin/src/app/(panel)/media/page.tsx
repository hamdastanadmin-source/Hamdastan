import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { MediaLibraryScreen } from '@/features/media';

export const metadata: Metadata = { title: 'کتابخانه‌ی رسانه' };

export default async function MediaPage() {
  await requireAdminPermission('activities.read');
  return <MediaLibraryScreen />;
}
