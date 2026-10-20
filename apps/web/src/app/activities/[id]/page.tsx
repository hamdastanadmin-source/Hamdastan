import type { Metadata } from 'next';

import { ActivityPlayer, JourneyPlayer } from '@/features/activities';
import { getLeaderboard, getPlayerActivity } from '@/features/activities/server';

export const metadata: Metadata = { title: 'فعالیت' };
export const dynamic = 'force-dynamic';

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = await getPlayerActivity(id);
  // Keyed by version: an edit published while the page was open starts the player afresh.
  if (activity.type === 'journey') return <JourneyPlayer key={activity.versionId} activity={activity} />;
  const leaderboard = activity.type === 'competition' ? await getLeaderboard(id) : null;
  return <ActivityPlayer key={activity.versionId} activity={activity} leaderboard={leaderboard} />;
}
