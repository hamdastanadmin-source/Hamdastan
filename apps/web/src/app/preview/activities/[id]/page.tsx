import type { Metadata } from 'next';

import { JourneyPreview } from '@/features/activities';
import { getJourneyPreview } from '@/features/activities/server';

export const metadata: Metadata = { title: 'پیش‌نمایش چالش', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** An admin's full preview of a journey, opened from the builder. */
export default async function JourneyPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JourneyPreview preview={await getJourneyPreview(id)} />;
}
