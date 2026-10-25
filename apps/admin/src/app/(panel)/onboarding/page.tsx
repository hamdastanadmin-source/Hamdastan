import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { OnboardingScreen } from '@/features/onboarding';

export const metadata: Metadata = { title: 'آنبوردینگ' };

export default async function OnboardingPage() {
  await requireAdminPermission('onboarding.write');
  return <OnboardingScreen />;
}
