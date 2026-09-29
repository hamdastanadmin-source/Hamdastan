'use client';

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

import { Screen, ScreenBody, ScreenFooter, ScreenHeader } from '@/components';

import { useAuthActions } from '../hooks/use-auth-actions';
import { useCountdown } from '../hooks/use-countdown';
import { authErrorMessage } from '../utils/errors';
import {
  getDebugCode,
  getServerDebugCode,
  subscribeDebugCode,
} from '../utils/otp-handoff';

/**
 * Step two: proving the number belongs to the person holding it.
 *
 * There is no confirm button. Six digits is the whole form, so the moment the
 * sixth arrives — typed, pasted, or filled in by the OS from the SMS — it
 * submits. A button here would be a second action for a decision the user has
 * already made.
 *
 * A wrong code is shown three ways at once, because one of them is not enough
 * for everybody: the boxes turn red (colour), they shake (motion), and the
 * reason appears underneath in words (`role="alert"`, so it is announced).
 */

/** `1:59` in Persian digits. */
function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return toPersianDigits(`${minutes}:${String(seconds).padStart(2, '0')}`);
}

export function OtpForm({ phone }: { phone: string }) {
  const { requestOtp, verifyOtp } = useAuthActions();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [resendIn, setResendIn] = useState<number>(OTP.RESEND_AFTER_SECONDS);
  const remaining = useCountdown(resendIn);

  // The development echo, handed over by the previous screen. Subscribed to
  // rather than read once, so a resend replaces it — and read as `null` on
  // the server, so the markup matches on hydration.
  const debugCode = useSyncExternalStore(
    subscribeDebugCode,
    getDebugCode,
    getServerDebugCode
  );

  // Guards the auto-submit against React running the effect twice, which it
  // does in development's strict mode — a code is spendable exactly once.
  const submitted = useRef<string | null>(null);

  const submit = useCallback(
    async (value: string) => {
      if (submitted.current === value) return;
      submitted.current = value;

      setChecking(true);
      setError(null);
      try {
        await verifyOtp(phone, value);
      } catch (caught) {
        setError(authErrorMessage(caught));
        setCode('');
        submitted.current = null;
      } finally {
        setChecking(false);
      }
    },
    [phone, verifyOtp]
  );

  const resend = async () => {
    try {
      const seconds = await requestOtp(phone);
      setCode('');
      setError(null);
      submitted.current = null;
      setResendIn(seconds);
      toast.success('کد دوباره فرستاده شد');
    } catch (caught) {
      toast.error(authErrorMessage(caught));
    }
  };

  return (
    <Screen>
      <ScreenHeader>
        <Button asChild variant="ghost" size="sm" className="-ms-2 text-muted-foreground">
          <Link href="/auth/phone">بازگشت</Link>
        </Button>
      </ScreenHeader>

      <ScreenBody className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold leading-tight">کد تأیید رو وارد کن</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            کد {toPersianDigits(OTP.LENGTH)} رقمی به{' '}
            <span dir="ltr" className="font-medium text-foreground">
              {phone}
            </span>{' '}
            فرستاده شد.{' '}
            <Link href="/auth/phone" className="font-medium text-primary underline-offset-4 hover:underline">
              ویرایش شماره
            </Link>
          </p>
        </header>

        {debugCode && (
          <Alert>
            <KeyRound aria-hidden="true" />
            <AlertTitle>کد تست</AlertTitle>
            <AlertDescription>
              <span dir="ltr" className="font-mono text-base tracking-[0.3em] text-foreground">
                {debugCode}
              </span>
              <span>تا وصل شدن سرویس پیامک، کد همین‌جا نمایش داده می‌شود.</span>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col items-center gap-3">
          {/* The boxes run LTR: the first digit typed sits at the start of
              the code as written in the SMS the user is copying from. */}
          <div dir="ltr" className={error ? 'animate-shake motion-reduce:animate-none' : undefined}>
            <InputOTP
              maxLength={OTP.LENGTH}
              value={code}
              // input-otp filters keystrokes and pastes against this, so a
              // Persian-keyboard ۱۲۳۴۵۶ has to be allowed through before
              // onChange can rewrite it as 123456.
              pattern="[0-9\u06F0-\u06F9\u0660-\u0669]*"
              onChange={(value) => {
                const digits = toLatinDigits(value);
                setCode(digits);
                if (error) setError(null);
                // No confirm button: the sixth digit *is* the submit, and
                // this is the event that produced it.
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
                  <InputOTPSlot
                    key={index}
                    index={index}
                    aria-invalid={Boolean(error)}
                    className="h-14 w-12 text-xl font-semibold"
                  />
                ))}
              </InputOTPGroup>
              <InputOTPSeparator className="text-muted-foreground" />
              <InputOTPGroup>
                {[3, 4, 5].map((index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    aria-invalid={Boolean(error)}
                    className="h-14 w-12 text-xl font-semibold"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {checking && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              در حال بررسی…
            </p>
          )}

          {error && !checking && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
      </ScreenBody>

      <ScreenFooter>
        {remaining > 0 ? (
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            ارسال دوباره تا {formatCountdown(remaining)}
          </p>
        ) : (
          <Button
            type="button"
            variant="link"
            onClick={resend}
            className="h-12 w-full text-base font-bold"
          >
            ارسال دوباره‌ی کد
          </Button>
        )}
      </ScreenFooter>
    </Screen>
  );
}
