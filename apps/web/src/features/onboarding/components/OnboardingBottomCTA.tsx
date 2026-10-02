import { MIN_INTEREST_CATEGORIES } from '@hamdastan/config';
import { Button } from '@hamdastan/ui';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { ScreenFooter } from '@/components';

/**
 * The stage's one action, and the line above it that says what it is
 * waiting for.
 *
 * The status is a polite live region: it changes with every category the
 * person completes, and a screen-reader user should hear «۲ از ۳ دسته» as
 * it happens without losing their place among the chips.
 */
export function OnboardingBottomCTA({
  selectedCategoryCount,
  canContinue,
  isSaving,
  onContinue,
}: {
  selectedCategoryCount: number;
  canContinue: boolean;
  isSaving: boolean;
  onContinue: () => void;
}) {
  const status = canContinue
    ? 'عالیه! آماده‌ای بریم مرحله بعد'
    : `${toPersianDigits(selectedCategoryCount)} از ${toPersianDigits(MIN_INTEREST_CATEGORIES)} دسته انتخاب شده`;

  return (
    <ScreenFooter className="flex flex-col gap-3">
      <p
        role="status"
        aria-live="polite"
        className={
          canContinue
            ? 'text-center text-sm font-medium text-primary'
            : 'text-center text-sm text-muted-foreground'
        }
      >
        {status}
      </p>
      <Button
        type="button"
        size="xl"
        className="w-full"
        disabled={!canContinue}
        loading={isSaving}
        onClick={onContinue}
      >
        ادامه
      </Button>
    </ScreenFooter>
  );
}
