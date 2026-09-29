import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

/**
 * Where the user is in sign-up, and how much is left.
 *
 * Signing in is three screens — number, code, profile — and until now none of
 * them said so. A form with no end in sight is a form people abandon, and the
 * last of the three is the longest, so the count is worth showing before
 * somebody reaches it.
 *
 * Segments rather than numbered circles: at 430px a three-node stepper with
 * labels is wider than it is informative, and the bar reads as progress from
 * across the room. The text beside it is what carries the same fact to a
 * screen reader, which is why the bar itself is `aria-hidden` and the
 * `progressbar` role lives on the wrapper.
 */

const AUTH_STEPS = ['شماره موبایل', 'کد تأیید', 'اطلاعات شما'] as const;

export function AuthSteps({ current }: { current: number }) {
  const total = AUTH_STEPS.length;

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={`مرحله ${toPersianDigits(current)} از ${toPersianDigits(total)} — ${AUTH_STEPS[current - 1]}`}
      className="flex w-full flex-col gap-2"
    >
      <div aria-hidden="true" className="flex items-center gap-1.5">
        {AUTH_STEPS.map((step, index) => (
          <span
            key={step}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              index < current ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>
      <p aria-hidden="true" className="text-xs font-medium text-muted-foreground">
        مرحله {toPersianDigits(current)} از {toPersianDigits(total)}
      </p>
    </div>
  );
}
