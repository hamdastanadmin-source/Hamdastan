import { query, queryOne, withTransaction } from '../../data';
import { createRepositorySlot } from '../../shared/repository';

import type { OtpChallenge, ResolvedSession, TokenHashes } from './auth.types';

/**
 * Data access port for the Auth module, and the PostgreSQL adapter that
 * satisfies it.
 *
 * Everything here is about proving who someone is: the live one-time-code
 * challenge, the log the rate limits are counted from, and the session with
 * its chain of tokens. The account itself belongs to the Users module — this
 * one never reads or writes `v2_users`.
 */
export interface AuthRepository {
  // ─── One-time codes ──────────────────────────────────────────
  /** Replaces any live challenge for the number, which invalidates it. */
  saveChallenge(challenge: OtpChallenge): Promise<void>;
  findChallenge(phone: string): Promise<OtpChallenge | null>;
  /** Returns the attempt count after the increment. */
  recordFailedAttempt(phone: string): Promise<number>;
  deleteChallenge(phone: string): Promise<void>;

  // ─── Rate limiting ───────────────────────────────────────────
  recordSend(phone: string, ip: string | null): Promise<void>;
  countSendsForPhone(phone: string, since: Date): Promise<number>;
  countSendsForIp(ip: string, since: Date): Promise<number>;

  // ─── Sessions ────────────────────────────────────────────────
  /** Opens a session and issues its first token pair, in one transaction. */
  createSession(userId: string, tokens: TokenHashes): Promise<string>;
  findUserByAccessToken(tokenHash: string, now: Date): Promise<ResolvedSession | null>;
  /**
   * Spends a refresh token and issues the next pair. Returns null when the
   * token is unknown, expired, spent more than `reuseGraceSeconds` ago (which
   * also revokes the session) or its session is revoked — the caller cannot
   * tell those apart, and neither should an attacker.
   */
  rotateRefreshToken(
    tokenHash: string,
    now: Date,
    next: TokenHashes,
    reuseGraceSeconds: number
  ): Promise<ResolvedSession | null>;
  /** Ends the session a refresh token belongs to, and every token in it. */
  revokeSessionByRefreshToken(tokenHash: string): Promise<void>;
}

const slot = createRepositorySlot<AuthRepository>('auth');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const authRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setAuthRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

type ChallengeRow = {
  phone: string;
  code_hash: string;
  expires_at: Date;
  resend_available_at: Date;
  attempts: number;
};

export const sqlAuthRepository: AuthRepository = {
  async saveChallenge(challenge) {
    // One row per number, so issuing a code is also what retires the last
    // one — there is never a second live code to guess against.
    await query(
      `INSERT INTO v2_otp_challenges
              (phone, code_hash, issued_at, expires_at, resend_available_at, attempts)
       VALUES ($1, $2, now(), $3, $4, 0)
       ON CONFLICT (phone) DO UPDATE
               SET code_hash           = EXCLUDED.code_hash,
                   issued_at           = EXCLUDED.issued_at,
                   expires_at          = EXCLUDED.expires_at,
                   resend_available_at = EXCLUDED.resend_available_at,
                   attempts            = 0`,
      [challenge.phone, challenge.codeHash, challenge.expiresAt, challenge.resendAvailableAt]
    );
  },

  async findChallenge(phone) {
    const row = await queryOne<ChallengeRow>(
      `SELECT phone, code_hash, expires_at, resend_available_at, attempts
         FROM v2_otp_challenges WHERE phone = $1`,
      [phone]
    );
    if (!row) return null;
    return {
      phone: row.phone,
      codeHash: row.code_hash,
      expiresAt: row.expires_at,
      resendAvailableAt: row.resend_available_at,
      attempts: row.attempts,
    };
  },

  async recordFailedAttempt(phone) {
    const row = await queryOne<{ attempts: number }>(
      `UPDATE v2_otp_challenges SET attempts = attempts + 1
        WHERE phone = $1 RETURNING attempts`,
      [phone]
    );
    return row?.attempts ?? 0;
  },

  async deleteChallenge(phone) {
    await query(`DELETE FROM v2_otp_challenges WHERE phone = $1`, [phone]);
  },

  async recordSend(phone, ip) {
    await query(`INSERT INTO v2_otp_sends (phone, ip) VALUES ($1, $2::inet)`, [phone, ip]);
  },

  async countSendsForPhone(phone, since) {
    const row = await queryOne<{ count: string }>(
      `SELECT count(*)::text AS count FROM v2_otp_sends
        WHERE phone = $1 AND sent_at >= $2`,
      [phone, since]
    );
    return Number(row?.count ?? 0);
  },

  async countSendsForIp(ip, since) {
    const row = await queryOne<{ count: string }>(
      `SELECT count(*)::text AS count FROM v2_otp_sends
        WHERE ip = $1::inet AND sent_at >= $2`,
      [ip, since]
    );
    return Number(row?.count ?? 0);
  },

  async createSession(userId, tokens) {
    return withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO v2_sessions (user_id, expires_at) VALUES ($1, $2) RETURNING id`,
        [userId, tokens.refreshExpiresAt]
      );
      const sessionId = rows[0].id;

      await client.query(
        `INSERT INTO v2_access_tokens (token_hash, session_id, user_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [tokens.accessTokenHash, sessionId, userId, tokens.accessExpiresAt]
      );
      await client.query(
        `INSERT INTO v2_refresh_tokens (token_hash, session_id, user_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [tokens.refreshTokenHash, sessionId, userId, tokens.refreshExpiresAt]
      );

      // When someone last signed in is a question support will be asked,
      // and this is the moment that answers it.
      await client.query(
        `UPDATE v2_users SET last_login_at = now(), updated_at = now() WHERE id = $1`,
        [userId]
      );

      return sessionId;
    });
  },

  async findUserByAccessToken(tokenHash, now) {
    const row = await queryOne<{ user_id: string; session_id: string }>(
      `SELECT t.user_id, t.session_id
         FROM v2_access_tokens t
         JOIN v2_sessions s ON s.id = t.session_id
        WHERE t.token_hash = $1
          AND t.expires_at > $2
          AND s.revoked_at IS NULL
          AND s.expires_at > $2`,
      [tokenHash, now]
    );
    return row ? { userId: row.user_id, sessionId: row.session_id } : null;
  },

  async rotateRefreshToken(tokenHash, now, next, reuseGraceSeconds) {
    return withTransaction(async (client) => {
      // `FOR UPDATE` serialises two clients presenting the same token, so
      // exactly one of them spends it and the other sees it already spent.
      const { rows } = await client.query<{
        user_id: string;
        session_id: string;
        used_at: Date | null;
        expired: boolean;
      }>(
        `SELECT r.user_id, r.session_id, r.used_at,
                (r.expires_at <= $2 OR s.revoked_at IS NOT NULL OR s.expires_at <= $2) AS expired
           FROM v2_refresh_tokens r
           JOIN v2_sessions s ON s.id = r.session_id
          WHERE r.token_hash = $1
            FOR UPDATE OF r`,
        [tokenHash, now]
      );

      const current = rows[0];
      if (!current || current.expired) return null;

      if (current.used_at) {
        // Spent moments ago: the real client racing itself — several requests
        // of one navigation, each refreshing with the same cookie. Revoking
        // here signed people out every fifteen minutes, so it gets a pair of
        // its own, in the same session.
        const sinceSpentMs = now.getTime() - current.used_at.getTime();
        if (sinceSpentMs > reuseGraceSeconds * 1000) {
          // Spent a while ago: a replay — a stolen copy, or a client that
          // lost track. There is no way to tell, so the whole session goes.
          await client.query(
            `UPDATE v2_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
            [current.session_id]
          );
          return null;
        }
      } else {
        await client.query(
          `UPDATE v2_refresh_tokens SET used_at = $2 WHERE token_hash = $1`,
          [tokenHash, now]
        );
      }
      await client.query(
        `INSERT INTO v2_refresh_tokens (token_hash, session_id, user_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [next.refreshTokenHash, current.session_id, current.user_id, next.refreshExpiresAt]
      );
      await client.query(
        `INSERT INTO v2_access_tokens (token_hash, session_id, user_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [next.accessTokenHash, current.session_id, current.user_id, next.accessExpiresAt]
      );
      // Rolling expiry: a weekly visitor is never signed out.
      await client.query(`UPDATE v2_sessions SET expires_at = $2 WHERE id = $1`, [
        current.session_id,
        next.refreshExpiresAt,
      ]);

      return { userId: current.user_id, sessionId: current.session_id };
    });
  },

  async revokeSessionByRefreshToken(tokenHash) {
    await query(
      `UPDATE v2_sessions SET revoked_at = now()
        WHERE id = (SELECT session_id FROM v2_refresh_tokens WHERE token_hash = $1)
          AND revoked_at IS NULL`,
      [tokenHash]
    );
  },
};
