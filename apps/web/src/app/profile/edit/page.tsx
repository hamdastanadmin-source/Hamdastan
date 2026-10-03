import type { Metadata } from 'next';

import { EditProfile } from '@/features/profile';
import { getAccountOverview } from '@/features/profile/server';

export const metadata: Metadata = { title: 'ویرایش پروفایل' };
export const dynamic = 'force-dynamic';

export default async function EditProfilePage() {
  const { profile } = await getAccountOverview();
  return <EditProfile profile={profile} />;
}
