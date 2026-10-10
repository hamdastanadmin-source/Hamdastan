/**
 * Types internal to the Auth module.
 *
 * Nothing here crosses the wire: the shapes the browser sees are in
 * `@hamdastan/types`. These are the shapes the service reasons about — a
 * live one-time-code challenge, and the pair of tokens a sign-in produces.
 */

export type OtpChallenge = {
  phone: string;
  codeHash: string;
  expiresAt: Date;
  resendAvailableAt: Date;
  attempts: number;
};

/**
 * The pair a successful sign-in produces, in the two forms it exists in:
 * the raw tokens the controller writes into cookies, and the hashes the
 * repository stores. They are separate types so a raw token can never be
 * handed to a `INSERT` by mistake — the column is `char(64)` and the raw
 * token is not.
 */
export type SessionTokens = {
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
};

export type TokenHashes = {
  accessTokenHash: string;
  accessExpiresAt: Date;
  refreshTokenHash: string;
  refreshExpiresAt: Date;
};

/** What an access token resolves to. */
export type ResolvedSession = {
  userId: string;
  sessionId: string;
};

/** A session plus the end it can never be renewed past. */
export type RotatedSession = ResolvedSession & { absoluteExpiresAt: Date };

/** Where a sign-in or a refresh came from — shown when managing sessions. */
export type ClientInfo = { ip: string | null; userAgent: string | null };

/** Why a session ended, as `v2_sessions.revoked_reason` records it. */
export type RevokeReason = 'logout' | 'reuse_detected' | 'admin';

/** A live session, as an admin managing a person's sessions sees it. */
export type SessionRecord = {
  id: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  expiresAt: Date;
  absoluteExpiresAt: Date | null;
  userAgent: string | null;
  ip: string | null;
};

/** What the cleanup deleted, per table — logged, so it can be watched. */
export type PurgeCounts = Record<string, number>;

/** How long ended rows are kept before the cleanup deletes them. */
export type RetentionPolicy = { sessionDays: number; otpSendDays: number };
