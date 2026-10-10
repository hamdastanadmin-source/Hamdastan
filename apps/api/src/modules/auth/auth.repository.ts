import { query, queryOne, withTransaction } from '../../data';
import { createRepositorySlot } from '../../shared/repository';

import { deleteInBatches } from '../../data';

import type {
  ClientInfo,
  OtpChallenge,
  PurgeCounts,
  RetentionPolicy,
  RevokeReason,
  RotatedSession,
  SessionRecord,
  TokenHashes,
} from './auth.types';

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

  // ─── Wrong codes, per number across codes ────────────────────
  /** The live failure window for a number, or null when there is none. */
  findFailures(phone: string): Promise<{ failures: number; windowStartedAt: Date } | null>;
  /**
   * Counts one wrong code. Starts a new window when the last one began more
   * than `windowSeconds` before `now`. Returns the window after the increment.
   */
  recordFailure(
    phone: string,
    now: Date,
    windowSeconds: number
  ): Promise<{ failures: number; windowStartedAt: Date }>;
  clearFailures(phone: string): Promise<void>;

  // ─── Rate limiting ───────────────────────────────────────────
  recordSend(phone: string, ip: string | null): Promise<void>;
  countSendsForPhone(phone: string, since: Date): Promise<number>;
  countSendsForIp(ip: string, since: Date): Promise<number>;

  // ─── Sessions ────────────────────────────────────────────────
  /** Opens a session and issues its first token pair, in one transaction. */
  createSession(
    userId: string,
    tokens: TokenHashes,
    client: ClientInfo,
    absoluteExpiresAt: Date
  ): Promise<string>;
  // Resolving an access token is `UsersRepository.findByAccessToken`: it is
  // read together with the user row, in one round trip, on every request.
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
    policy: { reuseGraceSeconds: number; absoluteSeconds: number }
  ): Promise<RotatedSession | null>;
  /** Ends the session a refresh token belongs to, and every token in it. */
  revokeSessionByRefreshToken(tokenHash: string): Promise<void>;

  // ─── Managing a person's sessions (the admin panel) ──────────
  listActiveSessions(userId: string, now: Date): Promise<SessionRecord[]>;
  /** False when the session is not this person's, or already ended. */
  revokeSession(userId: string, sessionId: string, reason: RevokeReason): Promise<boolean>;
  /** Answers how many were live. */
  revokeAllSessions(userId: string, reason: RevokeReason): Promise<number>;

  // ─── Cleanup ─────────────────────────────────────────────────
  /** Deletes what can never be used again, keeping ended sessions for `retention`. */
  purgeExpired(now: Date, retention: RetentionPolicy): Promise<PurgeCounts>;
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

  async findFailures(phone) {
    const row = await queryOne<{ failures: number; window_started_at: Date }>(
      `SELECT failures, window_started_at FROM v2_otp_failures WHERE phone = $1`,
      [phone]
    );
    return row ? { failures: row.failures, windowStartedAt: row.window_started_at } : null;
  },

  async recordFailure(phone, now, windowSeconds) {
    // One statement, so two wrong guesses racing each other both count.
    const row = await queryOne<{ failures: number; window_started_at: Date }>(
      `INSERT INTO v2_otp_failures AS f (phone, failures, window_started_at)
       VALUES ($1, 1, $2)
       ON CONFLICT (phone) DO UPDATE
             SET failures = CASE WHEN f.window_started_at <= $2::timestamptz - make_interval(secs => $3)
                                 THEN 1 ELSE f.failures + 1 END,
                 window_started_at = CASE WHEN f.window_started_at <= $2::timestamptz - make_interval(secs => $3)
                                          THEN $2 ELSE f.window_started_at END
       RETURNING failures, window_started_at`,
      [phone, now, windowSeconds]
    );
    return { failures: row!.failures, windowStartedAt: row!.window_started_at };
  },

  async clearFailures(phone) {
    await query(`DELETE FROM v2_otp_failures WHERE phone = $1`, [phone]);
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

  async createSession(userId, tokens, origin, absoluteExpiresAt) {
    return withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO v2_sessions (user_id, expires_at, absolute_expires_at, last_seen_at, user_agent, ip)
         VALUES ($1, $2, $3, now(), $4, $5::inet) RETURNING id`,
        [userId, tokens.refreshExpiresAt, absoluteExpiresAt, origin.userAgent, origin.ip]
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

  async rotateRefreshToken(tokenHash, now, next, policy) {
    return withTransaction(async (client) => {
      // `FOR UPDATE` serialises two clients presenting the same token, so
      // exactly one of them spends it and the other sees it already spent.
      const { rows } = await client.query<{
        user_id: string;
        session_id: string;
        used_at: Date | null;
        absolute_expires_at: Date | null;
        expired: boolean;
      }>(
        `SELECT r.user_id, r.session_id, r.used_at, s.absolute_expires_at,
                (r.expires_at <= $2 OR s.revoked_at IS NOT NULL OR s.expires_at <= $2
                  OR s.absolute_expires_at <= $2) AS expired
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
        if (sinceSpentMs > policy.reuseGraceSeconds * 1000) {
          // Spent a while ago: a replay — a stolen copy, or a client that
          // lost track. There is no way to tell, so the whole session goes.
          await client.query(
            `UPDATE v2_sessions SET revoked_at = now(), revoked_reason = 'reuse_detected'
              WHERE id = $1 AND revoked_at IS NULL`,
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

      // A session from before absolute lifetimes existed gets its end now —
      // a full term from its first refresh under the rule, not from sign-in,
      // so nobody is signed out by the rule arriving.
      const absoluteExpiresAt =
        current.absolute_expires_at ?? new Date(now.getTime() + policy.absoluteSeconds * 1000);
      const cap = (at: Date) => (at < absoluteExpiresAt ? at : absoluteExpiresAt);

      await client.query(
        `INSERT INTO v2_refresh_tokens (token_hash, session_id, user_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [next.refreshTokenHash, current.session_id, current.user_id, cap(next.refreshExpiresAt)]
      );
      await client.query(
        `INSERT INTO v2_access_tokens (token_hash, session_id, user_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [next.accessTokenHash, current.session_id, current.user_id, cap(next.accessExpiresAt)]
      );
      // Rolling expiry, up to the absolute end: a weekly visitor stays
      // signed in, for at most the session's absolute lifetime. The device
      // columns are left as sign-in recorded them: most refreshes arrive
      // from `apps/web`'s server on the visitor's behalf, whose address and
      // user agent are its own.
      await client.query(
        `UPDATE v2_sessions SET expires_at = $2, absolute_expires_at = $3, last_seen_at = $4
          WHERE id = $1`,
        [current.session_id, cap(next.refreshExpiresAt), absoluteExpiresAt, now]
      );

      return { userId: current.user_id, sessionId: current.session_id, absoluteExpiresAt };
    });
  },

  async revokeSessionByRefreshToken(tokenHash) {
    await query(
      `UPDATE v2_sessions SET revoked_at = now(), revoked_reason = 'logout'
        WHERE id = (SELECT session_id FROM v2_refresh_tokens WHERE token_hash = $1)
          AND revoked_at IS NULL`,
      [tokenHash]
    );
  },

  async listActiveSessions(userId, now) {
    const rows = await query<{
      id: string;
      created_at: Date;
      last_seen_at: Date | null;
      expires_at: Date;
      absolute_expires_at: Date | null;
      user_agent: string | null;
      ip: string | null;
    }>(
      `SELECT id, created_at, last_seen_at, expires_at, absolute_expires_at, user_agent, host(ip) AS ip
         FROM v2_sessions
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > $2
          AND (absolute_expires_at IS NULL OR absolute_expires_at > $2)
        ORDER BY COALESCE(last_seen_at, created_at) DESC`,
      [userId, now]
    );
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
      absoluteExpiresAt: row.absolute_expires_at,
      userAgent: row.user_agent,
      ip: row.ip,
    }));
  },

  async revokeSession(userId, sessionId, reason) {
    // The user id is part of the match, so a session id from one person
    // cannot be used to end another's.
    const rows = await query(
      `UPDATE v2_sessions SET revoked_at = now(), revoked_reason = $3
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        RETURNING id`,
      [sessionId, userId, reason]
    );
    return rows.length > 0;
  },

  async revokeAllSessions(userId, reason) {
    const rows = await query(
      `UPDATE v2_sessions SET revoked_at = now(), revoked_reason = $2
        WHERE user_id = $1 AND revoked_at IS NULL
        RETURNING id`,
      [userId, reason]
    );
    return rows.length;
  },

  async purgeExpired(now, retention) {
    // Tokens die first: an expired token can neither sign anyone in nor be
    // replayed (a replay of an expired token is refused before the reuse
    // check), so nothing is lost by deleting it. Sessions are kept for the
    // retention period after they end, as the record of who was signed in
    // when; deleting one takes any tokens still under it.
    const day = 24 * 60 * 60;
    return {
      access_tokens: await deleteInBatches('v2_access_tokens', 'expires_at < $1', [now]),
      refresh_tokens: await deleteInBatches('v2_refresh_tokens', 'expires_at < $1', [now]),
      sessions: await deleteInBatches(
        'v2_sessions',
        `COALESCE(revoked_at, LEAST(expires_at, COALESCE(absolute_expires_at, expires_at)))
           < $1::timestamptz - make_interval(secs => $2)`,
        [now, retention.sessionDays * day]
      ),
      otp_challenges: await deleteInBatches('v2_otp_challenges', 'expires_at < $1', [now]),
      otp_sends: await deleteInBatches(
        'v2_otp_sends',
        'sent_at < $1::timestamptz - make_interval(secs => $2)',
        [now, retention.otpSendDays * day]
      ),
      // A failure window long over: its count no longer locks anything.
      otp_failures: await deleteInBatches(
        'v2_otp_failures',
        'window_started_at < $1::timestamptz - make_interval(secs => $2)',
        [now, day]
      ),
    };
  },
};
