import type { Metadata } from 'next';

import { ActivityPlayer, JourneyPlayer, type ActivityExit } from '@/features/activities';
import { getLeaderboard, getPlayerActivity } from '@/features/activities/server';
import { placeParam, placePath } from '@/lib';

export const metadata: Metadata = { title: 'فعالیت' };
export const dynamic = 'force-dynamic';

type Search = { place?: string | string[]; world?: string | string[] };

/** `?place=&world=`: opened as a task at a place — «بازگشت» leads back to it. */
export default async function ActivityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const activity = await getPlayerActivity(id);
  const at = placeParam(search);
  const exit: ActivityExit | undefined = at ? { href: placePath(at.slug, at.id), label: 'بازگشت به مکان' } : undefined;
  // Keyed by version: an edit published while the page was open starts the player afresh.
  if (activity.type === 'journey') return <JourneyPlayer key={activity.versionId} activity={activity} exit={exit} />;
  const leaderboard = activity.type === 'competition' ? await getLeaderboard(id) : null;
  return <ActivityPlayer key={activity.versionId} activity={activity} leaderboard={leaderboard} exit={exit} />;
}
