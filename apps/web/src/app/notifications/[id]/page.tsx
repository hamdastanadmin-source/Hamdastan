import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { NotificationOpener } from '@/features/notifications';

export const metadata: Metadata = { title: 'اعلان' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OpenNotificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <NotificationOpener id={id} />;
}
