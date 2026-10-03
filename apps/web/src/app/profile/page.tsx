import type { Metadata } from 'next';

import { ProfileHome } from '@/features/profile';
import { getAccountOverview } from '@/features/profile/server';

export const metadata: Metadata = { title: 'پروفایل' };
export const dynamic = 'force-dynamic';

/** The account hub. `?reward=` is set by a save that just earned XP, to play it once. */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ reward?: string | string[] }>;
}) {
  const [overview, { reward }] = await Promise.all([getAccountOverview(), searchParams]);
  return <ProfileHome overview={overview} rewardParam={reward} />;
}
