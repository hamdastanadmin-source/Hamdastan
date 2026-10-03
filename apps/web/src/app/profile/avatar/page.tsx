import type { Metadata } from 'next';

import { AvatarStudio } from '@/features/profile';
import { getAccountOverview } from '@/features/profile/server';

export const metadata: Metadata = { title: 'آواتار من' };
export const dynamic = 'force-dynamic';

export default async function AvatarPage() {
  const { profile, progress } = await getAccountOverview();
  return <AvatarStudio saved={profile.avatar} level={progress.level} />;
}
