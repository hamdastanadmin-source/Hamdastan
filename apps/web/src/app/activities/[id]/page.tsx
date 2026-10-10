import type { Metadata } from 'next';

import { ActivityPlayer } from '@/features/activities';
import { getPlayerActivity } from '@/features/activities/server';

export const metadata: Metadata = { title: 'فعالیت' };
export const dynamic = 'force-dynamic';

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = await getPlayerActivity(id);
  // Keyed by version: an edit published while the page was open starts the player afresh.
  return <ActivityPlayer key={activity.versionId} activity={activity} />;
}
