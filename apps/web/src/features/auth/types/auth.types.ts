/**
 * Types private to the login flow in this app.
 *
 * The wire contract lives in `@hamdastan/types` — what is here is the shape of
 * the screen: which step is showing, and what went wrong.
 */

import type { AuthErrorCode, Gender, OtpChallenge } from '@hamdastan/types';

/** The three screens the user moves between. */
export type AuthStep = 'phone' | 'registration' | 'otp';

/** Which field a message belongs under, when it belongs under one. */
export type AuthErrorField = 'phone' | 'code' | 'form';

export type AuthFlowError = {
  /**
   * The backend's code where there is one, so the UI can react to it.
   *
   * `string & {}` keeps `AuthErrorCode` completing in an editor while still
   * accepting a code this build has not heard of — the backend is free to add
   * one, and the UI has to fall back rather than mis-handle it.
   */
  code?: AuthErrorCode | (string & {});
  /** Already in Persian, ready to render. */
  message: string;
  field: AuthErrorField;
};

export type RegistrationFormValues = {
  firstName: string;
  lastName: string;
  birthDate: string;
  /** Empty until the user picks one — the schema is what rejects that. */
  gender: Gender | '';
};

/** Everything `AuthFlow` and its steps render from. */
export type AuthFlowState = {
  step: AuthStep;
  /** Normalised, as the backend returned it. */
  phone: string;
  challenge: OtpChallenge | null;
  /** Seconds until the current code expires. Drives the countdown. */
  secondsRemaining: number;
  /** True once the countdown has run out. */
  canResend: boolean;
  /** Set when the code is out of attempts: only a resend gets past it. */
  isCodeLocked: boolean;
  isPending: boolean;
  error: AuthFlowError | null;
};
