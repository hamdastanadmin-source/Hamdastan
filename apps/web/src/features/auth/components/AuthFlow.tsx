'use client';

import { Card, CardContent } from '@hamdastan/ui';

import { useAuthFlow } from '../hooks/use-auth-flow';
import { OtpStep } from './OtpStep';
import { PhoneStep } from './PhoneStep';
import { RegistrationStep } from './RegistrationStep';

/**
 * The login flow.
 *
 * All it does is pick the step and wire it to `useAuthFlow` — the sequencing
 * lives in the hook, the rules live in the backend. `/login` renders this and
 * nothing else.
 *
 * Mobile first: one column, full-bleed on a phone, and a card once there is
 * room for one.
 */
export function AuthFlow() {
  const flow = useAuthFlow();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        {/* The brand mark goes here once there is a real one to put in. */}

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5 sm:p-7">
            {flow.step === 'phone' && (
              <PhoneStep
                defaultValue={flow.phone}
                isPending={flow.isPending}
                error={flow.error}
                onSubmit={flow.submitPhone}
              />
            )}

            {flow.step === 'registration' && (
              <RegistrationStep
                phone={flow.phone}
                isPending={flow.isPending}
                error={flow.error}
                onSubmit={flow.submitRegistration}
                onEditPhone={flow.editPhone}
              />
            )}

            {flow.step === 'otp' && flow.challenge && (
              <OtpStep
                // A new code is a new challenge, and remounting clears the box.
                key={flow.challenge.expiresAt}
                phone={flow.phone}
                secondsRemaining={flow.secondsRemaining}
                canResend={flow.canResend}
                isCodeLocked={flow.isCodeLocked}
                isPending={flow.isPending}
                error={flow.error}
                devCode={flow.challenge.devCode}
                onSubmit={flow.submitCode}
                onResend={flow.resendCode}
                onEditPhone={flow.editPhone}
              />
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground/60">هم‌داستان</p>
      </div>
    </div>
  );
}
