import type { Metadata } from 'next';

import { EditInterests } from '@/features/onboarding';
import { getOnboardingInterests } from '@/features/onboarding/server';

export const metadata: Metadata = { title: 'علاقه‌مندی‌ها' };
export const dynamic = 'force-dynamic';

export default async function EditInterestsPage() {
  const initial = await getOnboardingInterests();
  return <EditInterests initial={initial} />;
}
