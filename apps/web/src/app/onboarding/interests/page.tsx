import type { Metadata } from 'next';

import { requireSession } from '@/features/auth/server';
import { InterestsStep } from '@/features/onboarding';
import { getOnboardingInterests } from '@/features/onboarding/server';

export const metadata: Metadata = { title: 'علاقه‌مندی‌ها' };
export const dynamic = 'force-dynamic';

/** Onboarding stage 1. */
export default async function OnboardingInterestsPage() {
  await requireSession();
  const initial = await getOnboardingInterests();

  return <InterestsStep initial={initial} />;
}
