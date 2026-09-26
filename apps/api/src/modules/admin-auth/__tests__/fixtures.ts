import type { FastifyInstance } from 'fastify';

import { API_PREFIX, ADMIN_SESSION_COOKIE_NAME } from '@hamdastan/config';
import type { AdminRoleCode } from '@hamdastan/types';
import { TEMPORARY_PASSWORD_LENGTH } from '@hamdastan/validation';

import { mockSmsProvider } from '../../../integrations/sms';
import {
  createInMemoryAdminAuthRepository,
  setAdminAuthRepository,
} from '../../admin-auth';
import {
  createInMemoryAdminUserStore,
  createInMemoryAdminUsersRepository,
  seedDevelopmentAdmin,
  setAdminUsersRepository,
  type AdminUserStore,
} from '../../admin-users';

/**
 * Shared by the admin-auth and admin-users suites, so the two cannot drift
 * about what a signed-in admin is.
 *
 * `buildApp()` binds the admin stand-ins itself, exactly as the process does.
 * These tests rebind them over a store they hold a reference to, because two of
 * the flows under test — an expired account, an expired temporary password —
 * are states no endpoint can put an account into. A client cannot reach them;
 * a clock can, and the store is the only place to stand in for one.
 */

export const ADMIN_API = `${API_PREFIX}/admin`;

export const DEV_ADMIN = { username: 'Admin', password: 'Admin1234' } as const;

/** Satisfies every rule in `adminPasswordSchema`. */
export const STRONG_PASSWORD = 'Hamdastan!2026';

/** A date far enough out that a test never races it. */
export const FUTURE_DATE = '2099-12-31';

/**
 * Rebinds both admin repositories over a fresh store and returns it.
 *
 * Call it in `beforeEach`, after `buildApp()`, so each test starts from one
 * development admin and nothing else.
 */
export async function installAdminStore(): Promise<AdminUserStore> {
  const store = createInMemoryAdminUserStore();
  const users = createInMemoryAdminUsersRepository(store);

  setAdminUsersRepository(users);
  setAdminAuthRepository(createInMemoryAdminAuthRepository(store));

  await seedDevelopmentAdmin(users);
  mockSmsProvider.clear();

  return store;
}

/** The record behind a username, for the states only a clock can produce. */
export function storedAdmin(store: AdminUserStore, username: string) {
  const key = username.toLowerCase();
  for (const user of store.users.values()) {
    if (user.usernameKey === key) return user;
  }
  throw new Error(`no admin named ${username}`);
}

/** Writes a record back after a test has aged it. */
export function replaceAdmin(
  store: AdminUserStore,
  username: string,
  patch: Partial<ReturnType<typeof storedAdmin>>
): void {
  const user = storedAdmin(store, username);
  store.users.set(user.id, { ...user, ...patch });
}

/** The session cookie off a login response, ready to send back. */
export function sessionCookie(response: { cookies: unknown[] }): string {
  const cookie = (response.cookies as Array<{ name: string; value: string }>).find(
    (candidate) => candidate.name === ADMIN_SESSION_COOKIE_NAME
  );
  if (!cookie) throw new Error('the response set no admin session cookie');
  return `${ADMIN_SESSION_COOKIE_NAME}=${cookie.value}`;
}

/** Signs in and returns the cookie header plus the body, for chaining. */
export async function login<T = Record<string, unknown>>(
  app: FastifyInstance,
  username: string,
  password: string
): Promise<{ cookie: string; status: number; body: T }> {
  const response = await app.inject({
    method: 'POST',
    url: `${ADMIN_API}/auth/login`,
    payload: { username, password },
  });

  return {
    status: response.statusCode,
    body: response.json() as T,
    cookie: response.statusCode === 200 ? sessionCookie(response) : '',
  };
}

/**
 * The temporary password the backend just sent — read out of the mock gateway's
 * outbox, which is the one thing in these tests a real client could not do.
 *
 * It is the only run of digits of that length in the credentials message.
 */
export function sentTemporaryPassword(mobile: string): string {
  const message = mockSmsProvider.lastMessageFor(mobile);
  const password = message?.text.match(
    new RegExp(`\\d{${TEMPORARY_PASSWORD_LENGTH}}`)
  )?.[0];
  if (!password) throw new Error(`no credentials were delivered to ${mobile}`);
  return password;
}

/** The body for creating an admin, with the bits a test cares about overridden. */
export function newAdminPayload(overrides: {
  username: string;
  mobile: string;
  roleCode?: AdminRoleCode;
  accessExpiresAt?: string;
}) {
  return {
    firstName: 'کاربر',
    lastName: 'آزمایشی',
    roleCode: 'user_manager' as AdminRoleCode,
    accessExpiresAt: FUTURE_DATE,
    ...overrides,
  };
}
