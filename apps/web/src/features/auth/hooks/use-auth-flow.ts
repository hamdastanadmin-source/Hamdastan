'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { OtpChallenge } from '@hamdastan/types';
import { phoneSchema, registerSchema, verifyOtpSchema } from '@hamdastan/validation';

import { authApi } from '../services/auth.api';
import type {
  AuthErrorField,
  AuthFlowError,
  AuthFlowState,
  AuthStep,
  RegistrationFormValues,
} from '../types/auth.types';
import { secondsUntil, toAuthError } from '../utils/auth.utils';

/**
 * The login flow, as a state machine.
 *
 * The components below it render what this returns and call back into it —
 * they hold no flow logic of their own. What lives here is sequencing and
 * timing: which step is showing, how long the current code has left, and
 * whether a resend is allowed yet.
 *
 * None of it is a security boundary. The schemas are parsed here only to save a
 * round trip on an obviously bad field; the backend checks everything again and
 * is the only thing that decides whether a code is good.
 */

const HOME_ROUTE = '/';

export type AuthFlowActions = {
  submitPhone(phone: string): Promise<void>;
  submitRegistration(values: RegistrationFormValues): Promise<void>;
  submitCode(code: string): Promise<void>;
  resendCode(): Promise<void>;
  /** "ویرایش شماره" — cancels the code in flight and goes back to step one. */
  editPhone(): Promise<void>;
};

export function useAuthFlow(): AuthFlowState & AuthFlowActions {
  const router = useRouter();

  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<AuthFlowError | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Survives the unmount that follows a successful sign-in, so a late state
  // update cannot fight the redirect.
  const isRedirecting = useRef(false);

  /**
   * Adopts a challenge and resets the clock in the same update, so the first
   * frame of a countdown is never measured against a stale `now`.
   */
  const applyChallenge = useCallback((next: OtpChallenge) => {
    setChallenge(next);
    setNow(Date.now());
  }, []);

  /**
   * One ticker, and only while something is still counting down. Once the code
   * has expired and the resend has opened, nothing derived from `now` can move
   * again, so it stops rather than re-rendering the card every second for as
   * long as the screen is open.
   */
  useEffect(() => {
    if (!challenge) return;

    const deadline = Math.max(
      new Date(challenge.expiresAt).getTime(),
      new Date(challenge.resendAvailableAt).getTime()
    );
    if (Date.now() >= deadline) return;

    const id = window.setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= deadline) window.clearInterval(id);
    }, 1000);

    return () => window.clearInterval(id);
  }, [challenge]);

  const secondsRemaining = challenge ? secondsUntil(challenge.expiresAt, now) : 0;
  const canResend = challenge
    ? now >= new Date(challenge.resendAvailableAt).getTime()
    : false;
  const isCodeLocked = error?.code === 'OTP_TOO_MANY_ATTEMPTS';

  /**
   * Runs one step of the flow.
   *
   * Every failure lands in one place — a schema rejection, the backend's
   * answer, or a request that never left — so the error shape is uniform by
   * construction rather than by three handlers agreeing.
   */
  const run = useCallback(
    async (field: AuthErrorField, action: () => Promise<void>) => {
      setIsPending(true);
      setError(null);
      try {
        await action();
      } catch (caught) {
        setError(toAuthError(caught, field));
      } finally {
        if (!isRedirecting.current) setIsPending(false);
      }
    },
    []
  );

  const submitPhone = useCallback(
    (raw: string) =>
      run('phone', async () => {
        const normalized = phoneSchema.parse(raw);
        setPhone(normalized);

        const { registered } = await authApi.checkPhone(normalized);
        if (!registered) {
          // New number: collect a profile before any code is sent.
          setStep('registration');
          return;
        }

        applyChallenge(await authApi.sendOtp(normalized));
        setStep('otp');
      }),
    [applyChallenge, run]
  );

  const submitRegistration = useCallback(
    (values: RegistrationFormValues) =>
      run('form', async () => {
        applyChallenge(await authApi.register(registerSchema.parse({ ...values, phone })));
        setStep('otp');
      }),
    [applyChallenge, phone, run]
  );

  const submitCode = useCallback(
    (code: string) =>
      run('code', async () => {
        await authApi.verifyOtp(verifyOtpSchema.parse({ phone, code }));

        // The backend has set the session cookie. `refresh` is what makes the
        // server re-render the shell with a signed-in user.
        isRedirecting.current = true;
        router.replace(HOME_ROUTE);
        router.refresh();
      }),
    [phone, router, run]
  );

  const resendCode = useCallback(
    () =>
      run('code', async () => {
        applyChallenge(await authApi.sendOtp(phone));
      }),
    [applyChallenge, phone, run]
  );

  const editPhone = useCallback(
    () =>
      run('phone', async () => {
        // Best effort: if the cancel call fails the user still gets to change
        // their number, and the old code expires on its own.
        await authApi.cancelOtp(phone).catch(() => undefined);
        setChallenge(null);
        setStep('phone');
      }),
    [phone, run]
  );

  return {
    step,
    phone,
    challenge,
    secondsRemaining,
    canResend,
    isCodeLocked,
    isPending,
    error,
    submitPhone,
    submitRegistration,
    submitCode,
    resendCode,
    editPhone,
  };
}
