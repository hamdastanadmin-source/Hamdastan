/**
 * The numbers the sign-in flow is built out of.
 *
 * They are here rather than in `apps/api` because both sides need them and
 * must not disagree: the browser counts down the same two minutes the server
 * will enforce, and the birth-date `<Select>` offers exactly the years the
 * server's validator accepts. A value that only the backend enforces (a rate
 * limit) still lives here, so the whole policy reads in one place.
 */

/** One-time code. */
export const OTP = {
  /** Digits in the code. Changing this changes the OTP input's slot count. */
  LENGTH: 6,
  /** How long a code stays valid. */
  TTL_SECONDS: 120,
  /** How long before the same number may ask for another. */
  RESEND_AFTER_SECONDS: 120,
  /** Wrong guesses a single code tolerates before it is burnt. */
  MAX_ATTEMPTS: 5,
  /** Sends allowed per phone number inside `RATE_WINDOW_SECONDS`. */
  MAX_SENDS_PER_PHONE: 3,
  /** Sends allowed per caller address inside `RATE_WINDOW_SECONDS`. */
  MAX_SENDS_PER_IP: 10,
  RATE_WINDOW_SECONDS: 600,
} as const;

/** Session and token lifetimes. */
export const SESSION = {
  ACCESS_TOKEN_TTL_SECONDS: 15 * 60,
  /** Rolling: pushed out again on every refresh. */
  REFRESH_TOKEN_TTL_SECONDS: 30 * 24 * 60 * 60,
  /**
   * A spent refresh token presented again this soon after is the same client
   * racing itself — a navigation fires the page and its prefetches at once,
   * each through `proxy.ts` with the same cookie — and is answered with a
   * fresh pair. Later than this it is a replay and ends the session.
   */
  REFRESH_REUSE_GRACE_SECONDS: 30,
  ACCESS_COOKIE: 'hd_at',
  REFRESH_COOKIE: 'hd_rt',
} as const;

/**
 * Who the product is for. Under thirteen is out of scope for V1, and the
 * upper bound keeps the year `<Select>` to a list a thumb can scroll.
 */
export const PROFILE = {
  MIN_AGE: 13,
  MAX_AGE: 80,
  FIRST_NAME_MIN: 2,
  FIRST_NAME_MAX: 30,
  LAST_NAME_MIN: 2,
  LAST_NAME_MAX: 40,
} as const;

/**
 * Where the router sends someone, decided by the server and never by the
 * client. `basic_info` and `onboarding` are also the two unfinished values of
 * `v2_users.onboarding_step`.
 */
export const NEXT_STEPS = ['basic_info', 'onboarding', 'home'] as const;

/** The widest the app's single column ever gets, in pixels. */
export const MOBILE_SHELL_MAX_WIDTH = 430;
