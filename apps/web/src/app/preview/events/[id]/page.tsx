import type { Metadata } from 'next';

import { EventDetailScreen } from '@/features/events';
import { getEventPreview } from '@/features/events/server';

export const metadata: Metadata = { title: 'پیش‌نمایش رویداد', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** An admin's preview of an event in any status, opened from the editor. Nothing it shows is recorded. */
export default async function EventPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventDetailScreen event={await getEventPreview(id)} related={[]} />;
}
