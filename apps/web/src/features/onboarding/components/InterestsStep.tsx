'use client';

import { toast } from 'sonner';

import { INTEREST_CATEGORIES, MIN_INTEREST_CATEGORIES } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { Screen, ScreenBack, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';
import { HttpError } from '@/services';

import { useInterestSelection } from '../hooks/use-interest-selection';
import { categorySelection } from '../utils/interest-selection';
import { InterestCategoryCard } from './InterestCategoryCard';
import { OnboardingBottomCTA } from './OnboardingBottomCTA';
import { OnboardingProgress } from './OnboardingProgress';

/**
 * Onboarding stage 1: what are you into?
 *
 * The body scrolls with the page and the action stays pinned in the sticky
 * footer, which sits in the flow — so the last card ends above it rather than
 * underneath it, with no padding to keep in step.
 *
 * `initialInterestIds` is what `apps/api` already holds, read by the page on
 * the server, so a person coming back sees their earlier picks.
 */
export function InterestsStep({ initialInterestIds }: { initialInterestIds: string[] }) {
  const { selected, selectedCategoryCount, canContinue, isSaving, setCategorySelection, save } =
    useInterestSelection(initialInterestIds);

  const handleContinue = async () => {
    try {
      await save();
    } catch (error) {
      // The API answers in Persian; only "never arrived" needs our wording.
      toast.error(
        error instanceof HttpError
          ? error.message
          : 'ارتباط با سرور برقرار نشد. اینترنتت رو بررسی کن.'
      );
      return;
    }
    // Stage 2 does not exist yet; when it does, this navigates to it.
    toast.success('انتخاب‌هات ذخیره شد');
  };

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/onboarding" />
      </ScreenHeader>

      <ScreenBody className="gap-6">
        <OnboardingProgress step={1} />

        <div className="flex flex-col gap-2">
          <ScreenTitle
            title="به چه چیزهایی علاقه داری؟"
            description={`حداقل از ${toPersianDigits(MIN_INTEREST_CATEGORIES)} دسته انتخاب کن تا دنیای تو رو بهتر بشناسیم.`}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            هر انتخاب، آواتار تو رو دقیق‌تر می‌سازه.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {INTEREST_CATEGORIES.map((category) => (
            <InterestCategoryCard
              key={category.id}
              category={category}
              value={categorySelection(selected, category)}
              onValueChange={(values) => setCategorySelection(category, values)}
            />
          ))}
        </div>
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
