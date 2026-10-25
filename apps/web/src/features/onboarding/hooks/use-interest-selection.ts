'use client';

import { useMemo, useState } from 'react';

import type { InterestCategory } from '@hamdastan/config';
import type { OnboardingInterests } from '@hamdastan/types';
import { interestCategoryIndex } from '@hamdastan/validation';

import { onboardingService } from '@/services';

import {
  canContinueInterests,
  selectedCategoryCount,
  withCategorySelection,
} from '../utils/interest-selection';

/**
 * Stage 1's state: one set of selected ids, and everything else derived
 * from it. `initial` is what the server already has — the catalog and the
 * saved picks — read before render.
 */
export function useInterestSelection(initial: OnboardingInterests) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(initial.selectedInterests));
  const [isSaving, setIsSaving] = useState(false);
  const categoryOf = useMemo(() => interestCategoryIndex(initial.categories), [initial.categories]);

  return {
    selected,
    selectedCategoryCount: selectedCategoryCount(selected, categoryOf),
    canContinue: canContinueInterests(selected, categoryOf),
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
