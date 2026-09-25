'use client';

import { useState } from 'react';
import { KeyRound, RotateCcw } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared';
import {
  Alert,
  AlertDescription,
  Button,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@hamdastan/ui';
import { OTP_CODE_LENGTH } from '@hamdastan/validation';

import type { AuthFlowError } from '../types/auth.types';
import { formatCountdown } from '../utils/auth.utils';
import { PhoneSummary } from './PhoneSummary';
import { StepHeader } from './StepHeader';

/**
 * Step three: the code.
 *
 * The countdown here is a courtesy, not a rule — the backend refuses an expired
 * code whatever this screen shows, and refuses a resend until its own cooldown
 * has passed.
 */

const SLOT_INDEXES = Array.from({ length: OTP_CODE_LENGTH }, (_, index) => index);

export function OtpStep({
  phone,
  secondsRemaining,
  canResend,
  isCodeLocked,
  isPending,
  error,
  devCode,
  onSubmit,
  onResend,
  onEditPhone,
}: {
  phone: string;
  secondsRemaining: number;
  canResend: boolean;
  isCodeLocked: boolean;
  isPending: boolean;
  error: AuthFlowError | null;
  devCode?: string;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onEditPhone: () => void;
}) {
  // Reset by `AuthFlow`, which remounts this step for every new code, so the
  // previous digits never sit there looking like they were typed for this one.
  const [code, setCode] = useState('');

  const countdown = formatCountdown(secondsRemaining);
  const isExpired = secondsRemaining === 0;

  /** The one gate both submit paths go through. */
  const trySubmit = (value: string) => {
    if (isPending || isCodeLocked || value.length !== OTP_CODE_LENGTH) return;
    onSubmit(value);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        trySubmit(code);
      }}
      className="space-y-6"
    >
      <StepHeader
        title="کد تأیید"
        description={`کد ${toPersianDigits(OTP_CODE_LENGTH)} رقمی ارسال‌شده به شمارهٔ زیر را وارد کنید.`}
      />

      <PhoneSummary phone={phone} onEdit={onEditPhone} disabled={isPending} />

      <div className="flex flex-col items-center gap-3">
        {/* rtl-ok: the slots fill left-to-right, as digits are dictated. */}
        <div dir="ltr">
          <InputOTP
            maxLength={OTP_CODE_LENGTH}
            value={code}
            onChange={setCode}
            // Typing the last digit submits, which is what a phone keyboard
            // expects.
            onComplete={trySubmit}
            disabled={isPending || isCodeLocked}
            autoFocus
            aria-label="کد تأیید"
          >
            {/* Square boxes side by side, centred — the shape a code is
                expected to take, and unmistakably something to type into. */}
            <InputOTPGroup className="gap-2 sm:gap-3">
              {SLOT_INDEXES.map((index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  aria-invalid={error?.field === 'code' || undefined}
                  // Square, and a darker well than the card it sits on.
                  // `dark:bg-background` repeats the fill because the primitive
                  // sets its own `dark:` background, which would otherwise win.
                  // The active ring and the invalid border are the primitive's
                  // — both are visible in either theme, where a navy border
                  // would not be.
                  className="size-14 rounded-lg border border-strong bg-background text-xl font-semibold tabular-nums shadow-none dark:bg-background sm:size-16 sm:text-2xl"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {isExpired ? (
          <p className="text-sm text-muted-foreground">مدت اعتبار کد به پایان رسید.</p>
        ) : (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            اعتبار کد:{' '}
            <span className="font-medium tabular-nums text-foreground">{countdown}</span>
          </p>
        )}
      </div>

      {devCode && (
        // Development only. The backend refuses to populate this outside
        // development, so it cannot appear in production however this renders.
        <Alert data-testid="dev-otp" className="border-dashed">
          <KeyRound />
          <AlertDescription>
            کد تست:{' '}
            <span data-testid="dev-otp-code" className="font-bold tabular-nums text-foreground">
              {toPersianDigits(devCode)}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <Button
          type="submit"
          loading={isPending}
          disabled={code.length !== OTP_CODE_LENGTH || isCodeLocked}
          className="h-12 w-full text-base"
        >
          تأیید و ورود
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={onResend}
          disabled={!canResend || isPending}
          className="w-full"
        >
          <RotateCcw className="size-4" />
          {canResend ? 'ارسال دوبارهٔ کد' : `ارسال دوباره پس از ${countdown}`}
        </Button>
      </div>
    </form>
  );
}
