import type { Metadata } from 'next';

import { requireSession } from '@/features/auth/server';
import { OnboardingIntro } from '@/features/onboarding';

export const metadata: Metadata = { title: 'ساخت دنیای من' };
export const dynamic = 'force-dynamic';

/**
 * Onboarding — the intro. `proxy.ts` is what keeps anyone without an
 * unfinished onboarding off this page.
 */
export default async function OnboardingPage() {
  await requireSession();

  return <OnboardingIntro />;
}
