import { randomUUID } from 'node:crypto';

import { createRepositorySlot } from '../../shared/repository';
import type {
  NewUserRecord,
  OtpChallengeRecord,
  SessionRecord,
  UserRecord,
} from './auth.types';

/**
 * Data access port for the Auth module.
 *
 * Three things are stored: users, the live challenge for a phone number, and
 * sessions. The vocabulary is the domain's rather than a store's, so the port
 * outlives whichever database is eventually chosen.
 */
export interface AuthRepository {
  findUserByPhone(phone: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(user: NewUserRecord): Promise<UserRecord>;

  /** At most one per number — issuing a code replaces the previous challenge. */
  findChallengeByPhone(phone: string): Promise<OtpChallengeRecord | null>;
  saveChallenge(challenge: OtpChallengeRecord): Promise<OtpChallengeRecord>;
  deleteChallengeByPhone(phone: string): Promise<void>;
  /**
   * Counts one wrong guess and returns the new total.
   *
   * Separate from `saveChallenge` because two devices guessing at once must not
   * be able to lose a count between a read and a write. A Map cannot lose that
   * race, but a database can, and a port that only offers whole-record writes
   * gives the data layer no way to make it atomic. Returns 0 if the challenge
   * is already gone.
   */
  recordFailedAttempt(phone: string): Promise<number>;

  createSession(session: SessionRecord): Promise<SessionRecord>;
  findSessionByToken(token: string): Promise<SessionRecord | null>;
  deleteSessionByToken(token: string): Promise<void>;
}

const slot = createRepositorySlot<AuthRepository>('auth');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const authRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setAuthRepository = slot.set;

/**
 * The development stand-in, bound in `app.ts`.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ No database has been chosen for this project, so everything below lives │
 * │ in three Maps. That means:                                              │
 * │   - users, challenges and sessions are lost on every restart            │
 * │   - nothing is shared between processes, so a second instance sees a     │
 * │     different set of users                                              │
 * │                                                                         │
 * │ This function is the only place that knows any of that. When a data      │
 * │ layer is picked it supplies its own `AuthRepository` and this one is     │
 * │ deleted; no service, controller or route changes. The schema it has to   │
 * │ satisfy is in docs/architecture/auth-data-model.md.                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export function createInMemoryAuthRepository(): AuthRepository {
  const users = new Map<string, UserRecord>();
  const challenges = new Map<string, OtpChallengeRecord>();
  const sessions = new Map<string, SessionRecord>();

  return {
    async findUserByPhone(phone) {
      for (const user of users.values()) {
        if (user.phone === phone) return { ...user };
      }
      return null;
    },

    async findUserById(id) {
      const user = users.get(id);
      return user ? { ...user } : null;
    },

    async createUser(input) {
      const now = new Date();
      const user: UserRecord = {
        ...input,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      users.set(user.id, user);
      return { ...user };
    },

    async findChallengeByPhone(phone) {
      const challenge = challenges.get(phone);
      return challenge ? { ...challenge } : null;
    },

    async saveChallenge(challenge) {
      challenges.set(challenge.phone, { ...challenge });
      return { ...challenge };
    },

    async deleteChallengeByPhone(phone) {
      challenges.delete(phone);
    },

    async recordFailedAttempt(phone) {
      const challenge = challenges.get(phone);
      if (!challenge) return 0;

      challenge.attempts += 1;
      return challenge.attempts;
    },

    async createSession(session) {
      // Drop expired rows so the map cannot grow without bound. A real data
      // layer would do this with a TTL index or a scheduled sweep instead.
      const now = new Date();
      for (const [token, stored] of sessions) {
        if (stored.expiresAt <= now) sessions.delete(token);
      }
      sessions.set(session.token, { ...session });
      return { ...session };
    },

    async findSessionByToken(token) {
      const session = sessions.get(token);
      return session ? { ...session } : null;
    },

    async deleteSessionByToken(token) {
      sessions.delete(token);
    },
  };
}
