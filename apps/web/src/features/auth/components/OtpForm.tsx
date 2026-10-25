'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { CircleAlert, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { OTP } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import { toLatinDigits, toPersianDigits } from '@hamdastan/shared/format/persian';
import {
  Button,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Spinner,
} from '@hamdastan/ui';

import {
  Screen,
  ScreenBack,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  ScreenTitle,
} from '@/components';

import { useAuthActions } from '../hooks/use-auth-actions';
import { useCountdown } from '../hooks/use-countdown';
import { authErrorMessage } from '../utils/errors';

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
 *
 * While the code is being checked the form gives way to a loader, and on
 * success it stays there until the next screen replaces it — the form never
 * reappears, filled in and live again, between the verify and the redirect.
 */

// Six equal boxes in one row, one gap between each: `flex-1` shrinks them to
// fit the column at 320px, `max-w-12` stops them growing into slabs at 430px.
const SLOT_CLASS = 'h-14 min-w-0 max-w-12 flex-1 rounded-xl text-xl font-semibold';

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
        // On success `checking` is left on: the loader holds until the
        // redirect unmounts this screen.
        await verifyOtp(phone, value);
      } catch (caught) {
        setError(authErrorMessage(caught));
        setCode('');
        submitted.current = null;
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
      toast.success('یه کد جدید برات فرستادیم');
    } catch (caught) {
      toast.error(authErrorMessage(caught));
    }
  };

  if (checking) {
    return (
      <Screen>
        <ScreenBody center className="items-center">
          <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
            <Spinner aria-hidden="true" className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">در حال بررسی کد…</p>
          </div>
        </ScreenBody>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/auth/phone" />
      </ScreenHeader>

      <ScreenBody center className="gap-6">
        <ScreenTitle
          title="کد تأیید رو وارد کن"
          description={
            <>
              یه کد {toPersianDigits(OTP.LENGTH)} رقمی به{' '}
              <span dir="ltr" className="font-medium text-foreground tabular-nums">
                {toPersianDigits(phone)}
              </span>{' '}
              فرستادیم.{' '}
              <Link
                href="/auth/phone"
                className="font-medium text-foreground underline underline-offset-4"
              >
                تغییر شماره
              </Link>
            </>
          }
        />

        <div className="flex flex-col items-center gap-4">
          {/* The boxes run LTR: the first digit typed sits at the start of
              the code as written in the SMS the user is copying from. */}
          <div
            dir="ltr"
            className={cn(
              'w-full',
              error && 'animate-shake motion-reduce:animate-none'
            )}
          >
            <InputOTP
              maxLength={OTP.LENGTH}
              // A page may not carry a breakpoint, so the boxes flex (see
              // SLOT_CLASS); once they reach their cap the row centres.
              containerClassName="w-full justify-center"
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
              autoFocus
              autoComplete="one-time-code"
              aria-label="کد تأیید"
              aria-invalid={Boolean(error)}
            >
              <InputOTPGroup className="w-full justify-center">
                {Array.from({ length: OTP.LENGTH }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    aria-invalid={Boolean(error)}
                    className={SLOT_CLASS}
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* One row, reserved whether or not there is anything in it: the
              boxes would otherwise jump up the screen the moment a message
              appears under them, which is the one place on this screen the
              user is looking. */}
          <div className="flex min-h-6 items-center justify-center">
            {error && (
              <p
                role="alert"
                className="flex items-center gap-1.5 text-sm font-medium text-destructive"
              >
                {/* Colour is not the only carrier: the shake is motion, this
                    is a shape, and the text is the reason. */}
                <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
                {error}
              </p>
            )}
          </div>
        </div>
      </ScreenBody>

      <ScreenFooter className="flex flex-col items-center gap-1">
        <p className="text-sm text-muted-foreground">کد به دستت نرسید؟</p>
        {remaining > 0 ? (
          <p
            className="flex h-12 items-center text-sm font-medium tabular-nums text-foreground"
            aria-live="polite"
          >
            ارسال دوباره تا {formatCountdown(remaining)}
          </p>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="xl"
            onClick={resend}
            className="w-full"
          >
            <RotateCcw aria-hidden="true" />
            دوباره بفرست
          </Button>
        )}
      </ScreenFooter>
    </Screen>
  );
}
