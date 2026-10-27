'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { MIN_INTEREST_CATEGORIES } from '@hamdastan/config';
import type { OnboardingInterests } from '@hamdastan/types';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { Screen, ScreenBack, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';

import { interestSaveErrorMessage, useInterestSelection } from '../hooks/use-interest-selection';
import { InterestCategoryList } from './InterestCategoryList';
import { OnboardingBottomCTA } from './OnboardingBottomCTA';

/**
 * «ویرایش علاقه‌مندی‌ها» — stage 1's picker, opened again from «ویرایش
 * پروفایل» after onboarding. Same catalog, same three-category rule, same
 * `PUT /me/onboarding/interests`; the API never lowers the onboarding stage
 * on a re-save, so this is safe at any point.
 *
 * Saving goes back to the edit list, refreshed, so its row shows the new count.
 */
export function EditInterests({ initial }: { initial: OnboardingInterests }) {
  const router = useRouter();
  const { selected, selectedCategoryCount, canContinue, isSaving, setCategorySelection, save } =
    useInterestSelection(initial);

  const handleSave = async () => {
    try {
      await save();
    } catch (error) {
      toast.error(interestSaveErrorMessage(error));
      return;
    }
    toast.success('ذخیره شد');
    router.push('/profile/edit');
    router.refresh();
  };

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/profile/edit" />
      </ScreenHeader>

      <ScreenBody className="gap-6">
        <ScreenTitle
          title="علاقه‌مندی‌ها"
          description={`حداقل از ${toPersianDigits(MIN_INTEREST_CATEGORIES)} دسته انتخاب کن.`}
        />

        <InterestCategoryList
          categories={initial.categories}
          selected={selected}
          onCategoryChange={setCategorySelection}
        />
      </ScreenBody>

      <OnboardingBottomCTA
        selectedCategoryCount={selectedCategoryCount}
        canContinue={canContinue}
        isSaving={isSaving}
        onContinue={() => void handleSave()}
        label="ذخیره تغییرات"
        readyText={`${toPersianDigits(selected.size)} علاقه‌مندی از ${toPersianDigits(selectedCategoryCount)} دسته`}
      />
    </Screen>
  );
}
