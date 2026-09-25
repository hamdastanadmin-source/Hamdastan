/**
 * The authentication contract.
 *
 * Sign-in is passwordless: the user types a mobile number, the backend issues
 * a one-time code, and a session is created once that code is verified. Both
 * `apps/web` and `apps/api` compile against the definitions below, so a change
 * here is a change both sides see.
 *
 * Types that only the backend needs — stored records, hashes, counters — stay
 * in `apps/api/src/modules/auth/auth.types.ts`.
 */

export type UserRole = 'USER' | 'ADMIN';

export type Gender = 'MALE' | 'FEMALE';

/** The signed-in user, as every surface of the product sees them. */
export type AuthUser = {
  id: string;
  /** Normalised to `09xxxxxxxxx`. */
  phone: string;
  firstName: string;
  lastName: string;
  /** Joined once here so every screen shows the same name. */
  fullName: string;
  /** ISO calendar date, `YYYY-MM-DD`. */
  birthDate: string;
  gender: Gender;
  role: UserRole;
  isActive: boolean;
};

// ─── One-time codes ──────────────────────────────────────────────────────────

/**
 * Why a code was issued. The backend decides this from the state of the
 * phone number — the client never sends it, so it cannot ask for a
 * registration code for a number that is already taken.
 */
export type OtpPurpose = 'LOGIN' | 'REGISTER';

/**
 * What the client is told about a live challenge.
 *
 * The code is not part of it: `devCode` is populated only outside production,
 * and only when the dev echo is switched on — see `SHOW_DEV_OTP`.
 */
export type OtpChallenge = {
  phone: string;
  purpose: OtpPurpose;
  /** ISO timestamp. The countdown in the UI runs to this. */
  expiresAt: string;
  /** ISO timestamp. Resend is refused before it. */
  resendAvailableAt: string;
  /** Verify attempts left before the challenge locks. */
  attemptsRemaining: number;
  /** Development only. Never set when `NODE_ENV=production`. */
  devCode?: string;
};

// ─── Requests and responses ──────────────────────────────────────────────────

export type CheckPhoneRequest = { phone: string };
export type CheckPhoneResponse = { registered: boolean };

export type SendOtpRequest = { phone: string };
export type SendOtpResponse = OtpChallenge;

export type RegisterRequest = {
  phone: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: Gender;
};
/** Registration does not create a user — it issues a code. */
export type RegisterResponse = OtpChallenge;

export type VerifyOtpRequest = { phone: string; code: string };

export type CancelOtpRequest = { phone: string };

/** A session now exists; the token travels in an httpOnly cookie, not here. */
export type AuthResponse = { user: AuthUser };
export type VerifyOtpResponse = AuthResponse;
export type SessionResponse = AuthResponse;

// ─── Errors ──────────────────────────────────────────────────────────────────

/**
 * The `code` on an `ApiFailure` from the auth routes.
 *
 * The UI switches on these — it decides whether to offer a resend or to lock
 * the form from the code, never from the message text.
 */
export type AuthErrorCode =
  | 'PHONE_NOT_REGISTERED'
  | 'PHONE_ALREADY_REGISTERED'
  | 'OTP_NOT_FOUND'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_TOO_MANY_ATTEMPTS'
  | 'OTP_RESEND_COOLDOWN'
  | 'OTP_RESEND_LIMIT'
  | 'OTP_DELIVERY_FAILED'
  | 'ACCOUNT_SUSPENDED';
