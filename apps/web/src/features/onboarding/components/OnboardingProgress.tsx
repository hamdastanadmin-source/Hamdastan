import { ONBOARDING_STAGE_COUNT } from '@hamdastan/config';
import { Progress } from '@hamdastan/ui';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

/**
 * «مرحله ۱ از ۳», over a bar. Says how far along *and* how little is left —
 * the second half is what keeps a questionnaire from feeling endless.
 */
export function OnboardingProgress({
  step,
  total = ONBOARDING_STAGE_COUNT,
}: {
  step: number;
  total?: number;
}) {
  const label = `مرحله ${toPersianDigits(step)} از ${toPersianDigits(total)}`;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Progress value={(step / total) * 100} aria-label={label} className="h-1.5" />
    </div>
  );
}
