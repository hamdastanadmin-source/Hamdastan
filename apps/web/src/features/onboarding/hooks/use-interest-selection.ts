'use client';

import { useState } from 'react';

import type { InterestCategory } from '@hamdastan/config';
import type { OnboardingInterests } from '@hamdastan/types';

import { onboardingService } from '@/services';

import {
  canContinueInterests,
  selectedCategoryCount,
  withCategorySelection,
} from '../utils/interest-selection';

/**
 * Stage 1's state: one set of selected ids, and everything else derived
 * from it. `initial` is what the server already has, read before render.
 */
export function useInterestSelection(initial: readonly string[]) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(initial));
  const [isSaving, setIsSaving] = useState(false);

  return {
    selected,
    selectedCategoryCount: selectedCategoryCount(selected),
    canContinue: canContinueInterests(selected),
    isSaving,
    setCategorySelection: (category: InterestCategory, values: string[]) =>
      setSelected(withCategorySelection(selected, category, values)),
    /** Sends the selection to `apps/api`. Throws what the call throws. */
    save: async (): Promise<OnboardingInterests> => {
      setIsSaving(true);
      try {
        return await onboardingService.saveInterests({ interestIds: [...selected] });
      } finally {
        setIsSaving(false);
      }
    },
  };
}
