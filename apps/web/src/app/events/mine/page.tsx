import type { Metadata } from 'next';

import { MyEventsScreen } from '@/features/events';
import { getMyEvents } from '@/features/events/server';

export const metadata: Metadata = { title: 'رویدادهای من' };
export const dynamic = 'force-dynamic';

export default async function MyEventsPage() {
  const { soon, lists } = await getMyEvents();
  return <MyEventsScreen soon={soon} lists={lists} />;
}
