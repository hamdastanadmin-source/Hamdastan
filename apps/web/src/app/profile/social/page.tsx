import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SocialProfileScreen } from '@/features/profile';
import { getAccountOverview } from '@/features/profile/server';

export const metadata: Metadata = { title: 'پروفایل اجتماعی من' };
export const dynamic = 'force-dynamic';

/** The full result. Before the questionnaire is finished there is none; the hub offers it instead. */
export default async function SocialProfilePage() {
  const { socialProfile } = await getAccountOverview();
  if (!socialProfile) redirect('/profile');
  return <SocialProfileScreen result={socialProfile} />;
}
