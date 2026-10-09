'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, KeyRound, Loader2, RotateCcw } from 'lucide-react';

import { OTP } from '@hamdastan/config';
import { toLatinDigits, toPersianDigits } from '@hamdastan/shared/format/persian';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@hamdastan/ui';

import { errorMessage } from '@/lib';

type OtpStepProps = {
  phone: string;
  /** Present only while the API's development echo is on. */
  debugCode?: string;
  resendIn: number;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onEditPhone: () => void;
};

/**
 * The six-digit code. The sixth digit submits — there is no confirm button.
 * The parent remounts this step on every resend (by `key`), which is what
 * restarts the resend timer.
 */
export function OtpStep({ phone, debugCode, resendIn, onVerify, onResend, onEditPhone }: OtpStepProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [resendReady, setResendReady] = useState(false);
  const [resending, setResending] = useState(false);
  // A code is spendable once; this stops a double submit of the same value.
  const submitted = useRef<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setResendReady(true), resendIn * 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const submit = useCallback(
    async (value: string) => {
      if (submitted.current === value) return;
      submitted.current = value;
      setChecking(true);
      setError(null);
      try {
        await onVerify(value);
      } catch (caught) {
        setError(errorMessage(caught));
        setCode('');
        submitted.current = null;
      } finally {
        setChecking(false);
      }
    },
    [onVerify]
  );

  const resend = async () => {
    setResending(true);
    try {
      await onResend();
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        کد {toPersianDigits(OTP.LENGTH)} رقمی به{' '}
        <span dir="ltr" className="font-medium tabular-nums text-foreground">
          {toPersianDigits(phone)}
        </span>{' '}
        فرستاده شد.{' '}
        <Button type="button" variant="link" className="h-auto p-0 text-foreground underline" onClick={onEditPhone}>
          ویرایش شماره
        </Button>
      </p>

      {debugCode && (
        <Alert>
          <KeyRound aria-hidden="true" />
          <AlertTitle>کد تست</AlertTitle>
          <AlertDescription>
            <span dir="ltr" className="font-mono text-base tracking-[0.3em] text-foreground">
              {debugCode}
            </span>
            <span>تا وصل شدن سرویس پیامک، کد همین‌جا نمایش داده می‌شه.</span>
          </AlertDescription>
        </Alert>
      )}

      {/* LTR: the first digit typed sits where the code starts in the SMS. */}
      <div dir="ltr" className="flex justify-center">
        <InputOTP
          maxLength={OTP.LENGTH}
          value={code}
          // Persian-keyboard digits are let through and rewritten below.
          pattern="[0-9۰-۹٠-٩]*"
          onChange={(value) => {
            const digits = toLatinDigits(value);
            setCode(digits);
            if (error) setError(null);
            if (digits.length === OTP.LENGTH) void submit(digits);
          }}
          disabled={checking}
          autoFocus
          autoComplete="one-time-code"
          aria-label="کد تأیید"
          aria-invalid={Boolean(error)}
        >
          <InputOTPGroup>
            {[0, 1, 2].map((index) => (
              <InputOTPSlot key={index} index={index} aria-invalid={Boolean(error)} className="size-11 text-lg" />
            ))}
          </InputOTPGroup>
          <InputOTPSeparator className="text-muted-foreground/50" />
          <InputOTPGroup>
            {[3, 4, 5].map((index) => (
              <InputOTPSlot key={index} index={index} aria-invalid={Boolean(error)} className="size-11 text-lg" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {/* Reserved, so a message appearing does not move the boxes. */}
      <div className="flex min-h-6 items-center justify-center">
        {checking && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            در حال بررسی…
          </p>
        )}
        {error && !checking && (
          <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={resend}
        disabled={!resendReady}
        loading={resending}
      >
        <RotateCcw aria-hidden="true" />
        {resendReady
          ? 'ارسال دوباره‌ی کد'
          : `ارسال دوباره پس از ${toPersianDigits(resendIn)} ثانیه`}
      </Button>
    </div>
  );
}
