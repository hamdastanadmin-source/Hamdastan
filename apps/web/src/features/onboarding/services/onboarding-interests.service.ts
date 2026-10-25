import { cookies } from 'next/headers';

import type { OnboardingInterests } from '@hamdastan/types';

import { onboardingService } from '@/services';

/**
 * Stage 1 as `apps/api` holds it — the catalog and the saved picks — read on
 * the server so the chips render already selected, with no empty flash and
 * no client-side fetch on arrival. The catalog is the screen, so a failed
 * read is left to the error boundary.
 */
export async function getOnboardingInterests(): Promise<OnboardingInterests> {
  const cookie = (await cookies()).toString();
  return onboardingService.getInterests({ cookie });
}
