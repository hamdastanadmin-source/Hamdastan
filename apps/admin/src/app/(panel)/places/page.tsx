import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { PlacesScreen } from '@/features/places';

export const metadata: Metadata = { title: 'مکان‌ها' };

export default async function PlacesPage() {
  await requireAdminPermission('worlds.read');
  return <PlacesScreen />;
}
