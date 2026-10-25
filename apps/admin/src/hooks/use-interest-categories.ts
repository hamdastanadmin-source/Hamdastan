'use client';

import { useEffect, useState } from 'react';

import type { AdminInterestCategory } from '@hamdastan/types';

import { adminOnboardingService } from '@/services';

/**
 * Stage 1's interest categories, for the audience pickers and the labels
 * that name them. Empty until they arrive; a failure leaves them empty — an
 * audience still shows its ids, and the API still accepts them.
 */
export function useInterestCategories() {
  const [categories, setCategories] = useState<AdminInterestCategory[]>([]);

  useEffect(() => {
    let active = true;
    adminOnboardingService.interestCategories().then((list) => active && setCategories(list), () => undefined);
    return () => {
      active = false;
    };
  }, []);

  return categories;
}
