/**
 * Types internal to the Auth module — the shapes that get stored.
 *
 * Anything the front-end also has to agree on is in `@hamdastan/types`
 * instead, so both sides compile against one definition. What stays here is
 * everything a client must never see: code hashes, attempt counters, session
 * tokens, and the profile of a user who has not verified their number yet.
 */

import type { AuthUser, Gender, OtpPurpose, UserRole } from '@hamdastan/types';

export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export type UserRecord = {
  id: string;
  /** Normalised to `09xxxxxxxxx`. Unique. */
  phone: string;
  firstName: string;
  lastName: string;
  /** ISO calendar date, `YYYY-MM-DD`. */
  birthDate: string;
  gender: Gender;
  role: UserRole;
  status: UserStatus;
  /** Set when the code was verified. A user record never exists without it. */
  phoneVerifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type NewUserRecord = Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * What a new user typed into the registration form.
 *
 * It rides along on their challenge rather than becoming a user row, which is
 * what makes "no unverified users exist" true by construction: if the code is
 * never verified, the draft expires with the challenge and nothing is left
 * behind.
 */
export type RegistrationDraft = {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: Gender;
};

/**
 * One live challenge per phone number. Issuing a new code overwrites the row,
 * which is precisely what invalidates the previous one.
 */
export type OtpChallengeRecord = {
  id: string;
  phone: string;
  purpose: OtpPurpose;
  /**
   * SHA-256 of `phone:code`. The code itself is never stored — not in
   * production, and not when the development echo is on, so no environment can
   * put a usable code into a row.
   */
  codeHash: string;
  /** Present when `purpose` is `REGISTER`. */
  registration?: RegistrationDraft;
  issuedAt: Date;
  expiresAt: Date;
  /** Before this, a resend is refused. */
  resendAvailableAt: Date;
  /** Failed verifications against the current code. Reset when a new one is sent. */
  attempts: number;
  /** Codes sent in the window starting at `windowStartedAt`, for the send limit. */
  sendCount: number;
  windowStartedAt: Date;
};

export type SessionRecord = {
  /** Opaque, 256 bits of randomness. Travels in an httpOnly cookie. */
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
};

/** What the service hands back once a code has been verified. */
export type IssuedSession = {
  user: AuthUser;
  token: string;
  expiresAt: Date;
};
