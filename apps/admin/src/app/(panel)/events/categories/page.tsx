import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { CategoriesScreen } from '@/features/events';

export const metadata: Metadata = { title: 'دسته‌بندی رویدادها' };

export default async function EventCategoriesPage() {
  await requireAdminPermission('events.read');
  return <CategoriesScreen />;
}
