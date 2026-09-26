import { randomUUID } from 'node:crypto';

import { normalizeUsername } from '@hamdastan/validation';

import { hashPassword } from '../../shared/password';
import { createRepositorySlot } from '../../shared/repository';
import type {
  AdminPasswordUpdate,
  AdminUserListFilter,
  AdminUserPage,
  AdminUserRecord,
  AdminUserUpdate,
  NewAdminUserRecord,
} from './admin-users.types';

/**
 * Data access port for admin-user management.
 *
 * One entity: the admin account. `admin-auth` declares a second port over the
 * same future table — this one is what the panel manages accounts through, that
 * one is what a sign-in goes through. Two ports rather than one because they
 * are two sets of data needs with two different callers, and a port is defined
 * by what its module needs rather than by what a table holds.
 */
export interface AdminUsersRepository {
  list(filter: AdminUserListFilter): Promise<AdminUserPage>;
  findById(id: string): Promise<AdminUserRecord | null>;
  /** By the lower-cased username, which is the unique key. */
  findByUsernameKey(usernameKey: string): Promise<AdminUserRecord | null>;
  create(user: NewAdminUserRecord): Promise<AdminUserRecord>;
  /** Null if the account is gone. */
  update(id: string, patch: AdminUserUpdate): Promise<AdminUserRecord | null>;
  /**
   * Replaces the password — a reset, or the admin choosing their own — and
   * increments `credentialsVersion`, which is what ends the account's existing
   * sessions.
   */
  setPassword(id: string, update: AdminPasswordUpdate): Promise<AdminUserRecord | null>;
}

const slot = createRepositorySlot<AdminUsersRepository>('adminUsers');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const adminUsersRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setAdminUsersRepository = slot.set;

// ─── The development stand-in ────────────────────────────────────────────────

/**
 * The admin accounts, in a Map.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ No database has been chosen for this project, so admin accounts live in │
 * │ this Map. That means:                                                   │
 * │   - every account, including password changes, is lost on restart       │
 * │   - nothing is shared between processes, so a second instance sees a    │
 * │     different set of admins                                            │
 * │                                                                        │
 * │ `admin-auth` keeps its sessions in its own stand-in but reads and       │
 * │ writes these same records, so both are handed this one store. When a    │
 * │ data layer is picked it supplies both ports and this is deleted; no     │
 * │ service, controller or route changes. The schema to satisfy is in       │
 * │ docs/architecture/admin-data-model.md.                                  │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export type AdminUserStore = {
  users: Map<string, AdminUserRecord>;
};

export function createInMemoryAdminUserStore(): AdminUserStore {
  return { users: new Map() };
}

/** Matches a search term against the fields the panel's search box covers. */
function matchesSearch(user: AdminUserRecord, search: string): boolean {
  const needle = search.toLowerCase();
  return [user.firstName, user.lastName, `${user.firstName} ${user.lastName}`, user.username, user.mobile]
    .join('\n')
    .toLowerCase()
    .includes(needle);
}

export function createInMemoryAdminUsersRepository(
  store: AdminUserStore
): AdminUsersRepository {
  const touch = (user: AdminUserRecord): AdminUserRecord => {
    const updated = { ...user, updatedAt: new Date() };
    store.users.set(user.id, updated);
    return { ...updated };
  };

  return {
    async list({ search, page, pageSize }) {
      const matching = [...store.users.values()]
        .filter((user) => (search ? matchesSearch(user, search) : true))
        // Newest first: the account somebody just created is the one they want.
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const start = (page - 1) * pageSize;

      return {
        items: matching.slice(start, start + pageSize).map((user) => ({ ...user })),
        total: matching.length,
      };
    },

    async findById(id) {
      const user = store.users.get(id);
      return user ? { ...user } : null;
    },

    async findByUsernameKey(usernameKey) {
      for (const user of store.users.values()) {
        if (user.usernameKey === usernameKey) return { ...user };
      }
      return null;
    },

    async create(input) {
      const now = new Date();
      const user: AdminUserRecord = {
        ...input,
        id: randomUUID(),
        lastLoginAt: null,
        passwordChangedAt: null,
        credentialsVersion: 1,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: now,
        updatedAt: now,
      };
      store.users.set(user.id, user);
      return { ...user };
    },

    async update(id, patch) {
      const user = store.users.get(id);
      if (!user) return null;
      return touch({ ...user, ...patch });
    },

    async setPassword(id, update) {
      const user = store.users.get(id);
      if (!user) return null;

      return touch({
        ...user,
        ...update,
        // Every session issued under the old version stops resolving.
        credentialsVersion: user.credentialsVersion + 1,
        // A new password clears whatever lock the old one collected.
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    },
  };
}

/**
 * The development admin, so there is somebody to sign in as.
 *
 * Admins cannot register themselves, and the store starts empty, so without
 * this the panel would have no way in at all. The credential is
 * `Admin` / `Admin1234` and it is **development only** — `app.ts` seeds it only
 * when `NODE_ENV` is not production, and the account starts with
 * `mustChangePassword`, so the forced-change flow is what a first sign-in walks
 * through.
 *
 * It is given no temporary-password expiry: a generated password expires so a
 * forgotten SMS cannot be used a month later, but a fixed credential in a
 * developer's notes going stale overnight would only waste their time.
 *
 * Idempotent, so calling it twice against one store is harmless.
 */
export const DEVELOPMENT_ADMIN = {
  firstName: 'مدیر',
  lastName: 'سیستم',
  username: 'Admin',
  password: 'Admin1234',
  mobile: '09120000000',
} as const;

export async function seedDevelopmentAdmin(
  repository: AdminUsersRepository
): Promise<void> {
  const usernameKey = normalizeUsername(DEVELOPMENT_ADMIN.username);
  if (await repository.findByUsernameKey(usernameKey)) return;

  await repository.create({
    firstName: DEVELOPMENT_ADMIN.firstName,
    lastName: DEVELOPMENT_ADMIN.lastName,
    username: DEVELOPMENT_ADMIN.username,
    usernameKey,
    mobile: DEVELOPMENT_ADMIN.mobile,
    passwordHash: await hashPassword(DEVELOPMENT_ADMIN.password),
    mustChangePassword: true,
    temporaryPasswordExpiresAt: null,
    status: 'ACTIVE',
    roleCode: 'super_admin',
    // Far enough out that a local checkout does not expire mid-sprint.
    accessExpiresAt: '2099-12-31',
  });
}
