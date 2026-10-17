import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { WorldsScreen } from '@/features/worlds';

export const metadata: Metadata = { title: 'دنیاها' };

export default async function WorldsPage() {
  await requireAdminPermission('events.read');
  return <WorldsScreen />;
}
