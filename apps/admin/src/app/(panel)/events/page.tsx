import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { EventsScreen } from '@/features/events';

export const metadata: Metadata = { title: 'رویدادها' };

export default async function EventsPage() {
  await requireAdminPermission('events.read');
  return <EventsScreen />;
}
