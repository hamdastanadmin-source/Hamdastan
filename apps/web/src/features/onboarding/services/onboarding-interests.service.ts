import { cookies } from 'next/headers';

import { onboardingService } from '@/services';

/**
 * Stage 1's saved answers, read on the server so the chips render already
 * selected — no empty flash, no client-side fetch on arrival.
 *
 * An empty list when there is nothing saved *or* the read failed: a person
 * who cannot see their earlier picks can still pick again, which beats an
 * error screen in the middle of onboarding.
 */
export async function getSavedInterestIds(): Promise<string[]> {
  const cookie = (await cookies()).toString();
  try {
    return (await onboardingService.getInterests({ cookie })).selectedInterests;
  } catch {
    return [];
  }
}
