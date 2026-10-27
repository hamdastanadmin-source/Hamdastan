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
 * Onboarding stage 1: what are you into?
 *
 * The body scrolls with the page and the action stays pinned in the sticky
 * footer, which sits in the flow — so the last card ends above it rather than
 * underneath it, with no padding to keep in step.
 *
 * `initial` is what `apps/api` holds — the catalog, edited from the admin
 * panel, and the earlier picks — read by the page on the server.
 */
export function InterestsStep({ initial }: { initial: OnboardingInterests }) {
  const router = useRouter();
  const { selected, selectedCategoryCount, canContinue, isSaving, setCategorySelection, save } =
    useInterestSelection(initial);

  const handleContinue = async () => {
    try {
      await save();
    } catch (error) {
      toast.error(interestSaveErrorMessage(error));
      return;
    }
    router.push('/onboarding/questionnaire');
  };

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/onboarding" />
      </ScreenHeader>

      <ScreenBody className="gap-6">
        <div className="flex flex-col gap-2">
          <ScreenTitle
            title="به چه چیزهایی علاقه داری؟"
            description={`حداقل از ${toPersianDigits(MIN_INTEREST_CATEGORIES)} دسته انتخاب کن تا دنیای تو رو بهتر بشناسیم.`}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            هر انتخاب، آواتار تو رو دقیق‌تر می‌سازه.
          </p>
        </div>

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
        onContinue={() => void handleContinue()}
      />
    </Screen>
  );
}
