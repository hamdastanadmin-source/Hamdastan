'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { INTEREST_CATEGORIES, MIN_INTEREST_CATEGORIES } from '@hamdastan/config';
import { Accordion } from '@hamdastan/ui';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { Screen, ScreenBack, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';
import { HttpError } from '@/services';

import { useInterestSelection } from '../hooks/use-interest-selection';
import { categorySelection } from '../utils/interest-selection';
import { InterestCategoryCard } from './InterestCategoryCard';
import { OnboardingBottomCTA } from './OnboardingBottomCTA';

/**
 * Onboarding stage 1: what are you into?
 *
 * Categories start collapsed, and one opens at a time; which one is open is
 * view state only, so the picks survive collapsing and opening another.
 *
 * The body scrolls with the page and the action stays pinned in the sticky
 * footer, which sits in the flow — so the last card ends above it rather than
 * underneath it, with no padding to keep in step.
 *
 * `initialInterestIds` is what `apps/api` already holds, read by the page on
 * the server, so a person coming back sees their earlier picks.
 */
export function InterestsStep({ initialInterestIds }: { initialInterestIds: string[] }) {
  const router = useRouter();
  const { selected, selectedCategoryCount, canContinue, isSaving, setCategorySelection, save } =
    useInterestSelection(initialInterestIds);
  const [openCategoryId, setOpenCategoryId] = useState('');

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

        <Accordion
          type="single"
          collapsible
          value={openCategoryId}
          onValueChange={setOpenCategoryId}
          className="flex flex-col gap-2"
        >
          {INTEREST_CATEGORIES.map((category) => (
            <InterestCategoryCard
              key={category.id}
              category={category}
              value={categorySelection(selected, category)}
              onValueChange={(values) => setCategorySelection(category, values)}
              onOpen={() => setOpenCategoryId(category.id)}
              onClear={() => {
                setCategorySelection(category, []);
                if (openCategoryId === category.id) setOpenCategoryId('');
              }}
            />
          ))}
        </Accordion>
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
