import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { EventEditor } from '@/features/events';

export const metadata: Metadata = { title: 'رویداد جدید' };

export default async function NewEventPage() {
  await requireAdminPermission('events.write');
  return <EventEditor />;
}
