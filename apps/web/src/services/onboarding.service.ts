import type { OnboardingInterests } from '@hamdastan/types';
import type { InterestsInput } from '@hamdastan/validation';

import { apiClient } from './api-client';

/**
 * Every onboarding route, named once.
 *
 * A call made while rendering on the server has no cookie jar of its own;
 * the caller passes the request's own `cookie` header through.
 */
type ServerCall = { cookie?: string };

export const onboardingService = {
  getInterests(options?: ServerCall): Promise<OnboardingInterests> {
    return apiClient.get<OnboardingInterests>('/me/onboarding/interests', {
      ...(options?.cookie ? { headers: { cookie: options.cookie } } : {}),
      cache: 'no-store',
    });
  },

  saveInterests(input: InterestsInput): Promise<OnboardingInterests> {
    return apiClient.put<OnboardingInterests>('/me/onboarding/interests', input);
  },
};
