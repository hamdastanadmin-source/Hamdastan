import type { Metadata } from 'next';

import { ProfileHome } from '@/features/profile';
import { getAccountOverview } from '@/features/profile/server';

export const metadata: Metadata = { title: 'پروفایل' };
export const dynamic = 'force-dynamic';

/** The account hub. */
export default async function ProfilePage() {
  return <ProfileHome overview={await getAccountOverview()} />;
}
