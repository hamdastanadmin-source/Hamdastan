/**
 * The user, as both sides agree to see them.
 *
 * Only what the browser is allowed to know is here: no password, no token, no
 * `onboarding_step` bookkeeping the client could act on by itself. Where the
 * user goes next is `nextStep`, and the server is the only thing that decides
 * it — the client renders the answer, it does not compute one.
 */

export type UserRole = 'USER' | 'ADMIN';

export type Gender = 'male' | 'female' | 'other';

/**
 * The three destinations of the routing table. `basic_info` and `onboarding`
 * are unfinished states; `home` means the account is complete.
 */
export type NextStep = 'basic_info' | 'onboarding' | 'home';

export type AuthUser = {
  id: string;
  /** Normalised to `09xxxxxxxxx`. */
  phone: string;
  /** Null until the basic-info form is submitted. */
  firstName: string | null;
  lastName: string | null;
  /** Gregorian `YYYY-MM-DD`; the UI renders it in the Jalali calendar. */
  birthDate: string | null;
  gender: Gender | null;
  /** What the product calls them. Defaults to the first name. */
  displayName: string | null;
  role: UserRole;
};

/** `GET /me`, and the body of a successful verify. */
export type SessionResponse = {
  user: AuthUser;
  nextStep: NextStep;
};

export type OtpRequestResponse = {
  /** Seconds until "ارسال دوباره" becomes available. */
  resendIn: number;
  /**
   * The code itself, echoed back for development only. Present only while
   * `OTP_DEBUG_DISPLAY` is on; absent — not null — in every other case, so a
   * production response has no field to leak.
   */
  debugCode?: string;
};

export type OtpVerifyResponse = SessionResponse & {
  /** True when this verify is what created the account. */
  isNew: boolean;
};

/** The stable `code` values the UI switches on. */
export const AUTH_ERROR_CODES = {
  OTP_RATE_LIMITED: 'OTP_RATE_LIMITED',
  OTP_NOT_FOUND: 'OTP_NOT_FOUND',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_LOCKED: 'OTP_LOCKED',
} as const;

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];
