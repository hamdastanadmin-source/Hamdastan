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
