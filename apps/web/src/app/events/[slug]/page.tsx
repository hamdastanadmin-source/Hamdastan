import type { Metadata } from 'next';

import { EventDetailScreen } from '@/features/events';
import { getEventPage } from '@/features/events/server';

export const metadata: Metadata = { title: 'رویداد' };
export const dynamic = 'force-dynamic';

/** An event the person may not see is the 404 page — the API answers 404, never 403. */
export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { event, related } = await getEventPage(slug);
  return <EventDetailScreen event={event} related={related} />;
}
