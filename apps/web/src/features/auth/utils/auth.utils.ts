/**
 * Presentation helpers for the login flow.
 *
 * Nothing here decides anything — the backend does that. These turn what it
 * says into something readable in Persian, and turn a failed request into a
 * message with a code attached so the UI can react to it.
 *
 * Phone and digit rendering are shared with the app shell and live in
 * `@hamdastan/shared`; the steps import them from there, like everything else.
 */

import { toPersianDigits } from '@hamdastan/shared';
import type { AuthErrorCode } from '@hamdastan/types';
import { normalizePhone, PHONE_NUMBER_LENGTH, z } from '@hamdastan/validation';

import { HttpError } from '@/services';

import type { AuthErrorField, AuthFlowError } from '../types/auth.types';

/**
 * What the phone field accepts as the user types.
 *
 * Normalising first means a pasted `+98 912…` or `۰۹۱۲…` turns into the one
 * spelling the backend stores before anything is counted, so capping the
 * length cannot truncate a number that was simply written another way.
 * Everything that is not a digit is dropped, and eleven is the most a number
 * can be — there is nothing a twelfth digit could mean.
 */
export function sanitizePhoneInput(raw: string): string {
  return normalizePhone(raw).replace(/\D/g, '').slice(0, PHONE_NUMBER_LENGTH);
}

/** Seconds to `۱:۵۹`. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return toPersianDigits(`${minutes}:${String(seconds).padStart(2, '0')}`);
}

/** Seconds between now and an ISO timestamp, never negative. */
export function secondsUntil(isoTimestamp: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(isoTimestamp).getTime() - now) / 1000));
}

/**
 * Where a backend error belongs, for the codes that are about one field
 * wherever they are raised. Anything absent stays under the field the caller
 * was working on — a validation failure on the phone step is a phone problem,
 * and the same failure on the registration form is a form problem.
 */
const FIELD_BY_CODE: Partial<Record<AuthErrorCode, AuthErrorField>> = {
  PHONE_NOT_REGISTERED: 'phone',
  PHONE_ALREADY_REGISTERED: 'phone',
  OTP_INVALID: 'code',
  OTP_EXPIRED: 'code',
  OTP_NOT_FOUND: 'code',
  OTP_TOO_MANY_ATTEMPTS: 'code',
};

const NETWORK_ERROR_MESSAGE = 'ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.';
const UNKNOWN_ERROR_MESSAGE = 'خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.';

/**
 * Normalises whatever a step threw into something renderable.
 *
 * Every failure arrives here — a field rule the shared schema rejected before
 * the request, the backend's answer, or a request that never left — so the
 * error shape is the same whichever of them it was.
 *
 * The backend already writes its messages in Persian, so they are shown as they
 * arrive; only the cases it never got to answer are worded here.
 */
export function toAuthError(error: unknown, field: AuthErrorField = 'form'): AuthFlowError {
  // A rule from @hamdastan/validation, applied locally to save a round trip.
  if (error instanceof z.ZodError) {
    return {
      code: 'VALIDATION_ERROR',
      message: error.issues[0]?.message ?? UNKNOWN_ERROR_MESSAGE,
      field,
    };
  }

  if (error instanceof HttpError) {
    return {
      code: error.code,
      message: error.message,
      field: FIELD_BY_CODE[error.code as AuthErrorCode] ?? field,
    };
  }

  // A thrown TypeError from fetch means the request never arrived.
  if (error instanceof TypeError) {
    return { message: NETWORK_ERROR_MESSAGE, field };
  }

  return { message: UNKNOWN_ERROR_MESSAGE, field };
}
