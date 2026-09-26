import { createRepositorySlot } from '../../shared/repository';
import type { AdminUserStore } from '../admin-users/admin-users.repository';
import type {
  AdminPasswordUpdate,
  AdminUserRecord,
} from '../admin-users/admin-users.types';
import type { AdminSessionRecord } from './admin-auth.types';

/**
 * Data access port for admin authentication.
 *
 * Two things are stored: admin sessions, which this module owns, and the
 * account fields a sign-in reads and writes — the password hash, the attempt
 * counters, the timestamp of the last login. The account record itself belongs
 * to `admin-users`; this port is the authentication view of it, written in the
 * language of signing in rather than of managing people.
 */
export interface AdminAuthRepository {
  findUserByUsernameKey(usernameKey: string): Promise<AdminUserRecord | null>;
  findUserById(id: string): Promise<AdminUserRecord | null>;

  /** Clears the failed-attempt count and stamps the login. */
  recordSuccessfulLogin(id: string, at: Date): Promise<void>;
  /**
   * Counts one wrong password and returns the new total.
   *
   * Separate from a whole-record write for the same reason the one-time code
   * counter is: two requests guessing at once must not be able to lose a count
   * between a read and a write. Returns 0 if the account is gone.
   */
  recordFailedLogin(id: string): Promise<number>;
  /** Refuses sign-in until `until`. */
  lockUser(id: string, until: Date): Promise<void>;
  /**
   * Replaces the password — here, always because the admin chose a new one —
   * and increments `credentialsVersion` with it.
   */
  setUserPassword(id: string, update: AdminPasswordUpdate): Promise<AdminUserRecord | null>;

  createSession(session: AdminSessionRecord): Promise<AdminSessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<AdminSessionRecord | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
}

const slot = createRepositorySlot<AdminAuthRepository>('adminAuth');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const adminAuthRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setAdminAuthRepository = slot.set;

/**
 * The development stand-in, bound in `app.ts`.
 *
 * Sessions live in a Map here; the accounts live in the Map that
 * `admin-users` owns, which is why that store is handed in rather than
 * duplicated. Everything is lost on restart and nothing is shared between
 * processes, so this is not an authentication boundary and must not be
 * deployed as one — `app.ts` binds it only outside production.
 *
 * When a data layer is picked it supplies both admin ports and this is deleted;
 * no service, controller or route changes. The schema to satisfy is in
 * `docs/architecture/admin-data-model.md`, where session tokens are stored
 * hashed — as they already are here.
 */
export function createInMemoryAdminAuthRepository(
  store: AdminUserStore
): AdminAuthRepository {
  const sessions = new Map<string, AdminSessionRecord>();

  const write = (user: AdminUserRecord): AdminUserRecord => {
    const updated = { ...user, updatedAt: new Date() };
    store.users.set(user.id, updated);
    return { ...updated };
  };

  return {
    async findUserByUsernameKey(usernameKey) {
      for (const user of store.users.values()) {
        if (user.usernameKey === usernameKey) return { ...user };
      }
      return null;
    },

    async findUserById(id) {
      const user = store.users.get(id);
      return user ? { ...user } : null;
    },

    async recordSuccessfulLogin(id, at) {
      const user = store.users.get(id);
      if (!user) return;
      write({ ...user, lastLoginAt: at, failedLoginAttempts: 0, lockedUntil: null });
    },

    async recordFailedLogin(id) {
      const user = store.users.get(id);
      if (!user) return 0;

      const failedLoginAttempts = user.failedLoginAttempts + 1;
      write({ ...user, failedLoginAttempts });
      return failedLoginAttempts;
    },

    async lockUser(id, until) {
      const user = store.users.get(id);
      if (!user) return;
      write({ ...user, lockedUntil: until });
    },

    async setUserPassword(id, update) {
      const user = store.users.get(id);
      if (!user) return null;

      return write({
        ...user,
        ...update,
        credentialsVersion: user.credentialsVersion + 1,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    },

    async createSession(session) {
      // Drop expired rows so the map cannot grow without bound. A real data
      // layer would do this with a TTL index or a scheduled sweep instead.
      const now = new Date();
      for (const [tokenHash, stored] of sessions) {
        if (stored.expiresAt <= now) sessions.delete(tokenHash);
      }
      sessions.set(session.tokenHash, { ...session });
      return { ...session };
    },

    async findSessionByTokenHash(tokenHash) {
      const session = sessions.get(tokenHash);
      return session ? { ...session } : null;
    },

    async deleteSessionByTokenHash(tokenHash) {
      sessions.delete(tokenHash);
    },
  };
}
