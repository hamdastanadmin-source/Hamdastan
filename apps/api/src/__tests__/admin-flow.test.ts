import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ADMIN_SESSION, API_PREFIX } from '@hamdastan/config';

import { buildApp } from '../app';
import { closePool, getPool, runMigrations } from '../data';
import type { SmsSender } from '../integrations';
import { setAdminRepository, sqlAdminRepository } from '../modules/admin';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
import { setUsersRepository, sqlUsersRepository } from '../modules/users';

/**
 * The admin panel's sign-in and user management, against a real PostgreSQL
 * built from the migrations — including the seed that makes the main admin
 * the first one. Skips without `TEST_DATABASE_URL`, like `auth-flow.test.ts`.
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

/** Seeded by migration 0009. */
const MAIN_ADMIN_PHONE = '09059466960';

type Cookies = Record<string, string>;

const silentSender: SmsSender = { name: 'test', async sendOtp() {} };

let app: FastifyInstance;
let phoneCounter = 0;

/** 0999 is a range no operator issues; the counter keeps tests apart. */
function nextPhone(): string {
  phoneCounter += 1;
  return `0999${String(Date.now() % 100_000).padStart(5, '0')}${String(phoneCounter).padStart(2, '0')}`;
}

function cookiesFrom(response: LightMyRequestResponse): Cookies {
  return Object.fromEntries(response.cookies.map(({ name, value }) => [name, value]));
}

function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown, cookies: Cookies = {}) {
  return app.inject({ method, url: `${API_PREFIX}${url}`, payload: body as object, cookies });
}

/** Requests an admin code and verifies it; returns the raw verify response. */
async function adminVerify(phone: string) {
  const requested = await call('POST', '/admin/auth/otp/request', { phone });
  expect(requested.statusCode, requested.body).toBe(200);
  const code = requested.json().data.debugCode as string;
  return call('POST', '/admin/auth/otp/verify', { phone, code });
}

async function adminSignIn(phone: string): Promise<Cookies> {
  const verified = await adminVerify(phone);
  expect(verified.statusCode, verified.body).toBe(200);
  const cookies = cookiesFrom(verified);
  expect(cookies[ADMIN_SESSION.COOKIE]).toBeTruthy();
  return cookies;
}

async function createAdmin(cookies: Cookies, fields: Record<string, unknown>) {
  return call('POST', '/admin/users', fields, cookies);
}

describe.skipIf(!hasDatabase)('admin panel against a migrated database', () => {
  let main: Cookies;

  beforeAll(async () => {
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();

    setUsersRepository(sqlUsersRepository);
    setAuthRepository(sqlAuthRepository);
    setAdminRepository(sqlAdminRepository);
    setSmsSender(silentSender);

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
  });

  describe('sign-in', () => {
    it('lets the seeded main admin in with a one-time code', async () => {
      main = await adminSignIn(MAIN_ADMIN_PHONE);

      const me = await call('GET', '/admin/me', undefined, main);
      expect(me.statusCode, me.body).toBe(200);
      expect(me.json().data.admin).toMatchObject({
        phone: MAIN_ADMIN_PHONE,
        firstName: 'امید',
        lastName: 'بهشتی',
        status: 'active',
      });
      expect(me.json().data.admin.lastLoginAt).not.toBeNull();
    });

    it('refuses a proven number that is not on the list, and creates nothing for it', async () => {
      const stranger = nextPhone();
      const verified = await adminVerify(stranger);

      expect(verified.statusCode).toBe(403);
      expect(verified.json().error.code).toBe('ADMIN_ACCESS_DENIED');
      expect(cookiesFrom(verified)[ADMIN_SESSION.COOKIE]).toBeUndefined();

      // No public registration, and no product account as a side effect.
      const { rows } = await getPool().query(
        `SELECT (SELECT count(*) FROM v2_admin_users WHERE phone = $1)::int AS admins,
                (SELECT count(*) FROM v2_users WHERE phone = $1)::int AS users`,
        [stranger]
      );
      expect(rows[0]).toEqual({ admins: 0, users: 0 });
    });

    it('does not accept a product sign-in code', async () => {
      const requested = await call('POST', '/auth/otp/request', { phone: MAIN_ADMIN_PHONE });
      const code = requested.json().data.debugCode as string;

      const verified = await call('POST', '/admin/auth/otp/verify', { phone: MAIN_ADMIN_PHONE, code });
      expect(verified.statusCode).toBe(400);
      expect(verified.json().error.code).toBe('OTP_INVALID');

      // Clean up the half-used challenge so the next test can ask again.
      await getPool().query(`DELETE FROM v2_otp_challenges WHERE phone = $1`, [MAIN_ADMIN_PHONE]);
    });

    it('guards every admin route in the backend, whatever the cookies', async () => {
      expect((await call('GET', '/admin/users')).statusCode).toBe(401);
      expect((await call('POST', '/admin/users', { firstName: 'علی' })).statusCode).toBe(401);
      expect(
        (await call('GET', '/admin/users', undefined, { [ADMIN_SESSION.COOKIE]: 'forged' })).statusCode
      ).toBe(401);

      // A product session is not an admin session.
      const phone = nextPhone();
      const requested = await call('POST', '/auth/otp/request', { phone });
      const verified = await call('POST', '/auth/otp/verify', {
        phone,
        code: requested.json().data.debugCode,
      });
      expect((await call('GET', '/admin/users', undefined, cookiesFrom(verified))).statusCode).toBe(401);
    });

    it('ends the session on logout', async () => {
      const cookies = await adminSignIn(MAIN_ADMIN_PHONE);
      const out = await call('POST', '/admin/auth/logout', undefined, cookies);
      expect(out.statusCode).toBe(200);
      expect((await call('GET', '/admin/me', undefined, cookies)).statusCode).toBe(401);
      // The other session is untouched.
      expect((await call('GET', '/admin/me', undefined, main)).statusCode).toBe(200);
    });
  });

  describe('managing users', () => {
    it('creates a user, active by default, with the number normalised', async () => {
      const phone = nextPhone();
      const created = await createAdmin(main, {
        firstName: 'سارا',
        lastName: 'محمدی',
        phone: `+98${phone.slice(1)}`,
      });

      expect(created.statusCode, created.body).toBe(201);
      expect(created.json().data).toMatchObject({
        firstName: 'سارا',
        lastName: 'محمدی',
        phone,
        status: 'active',
        lastLoginAt: null,
      });
    });

    it('can create a user as inactive', async () => {
      const created = await createAdmin(main, {
        firstName: 'رضا',
        lastName: 'کریمی',
        phone: nextPhone(),
        status: 'inactive',
      });
      expect(created.statusCode).toBe(201);
      expect(created.json().data.status).toBe('inactive');
    });

    it('validates every field, with a message per field', async () => {
      const missing = await createAdmin(main, { phone: '0912' });
      expect(missing.statusCode).toBe(400);
      expect(Object.keys(missing.json().error.details.fields).sort()).toEqual([
        'firstName',
        'lastName',
        'phone',
      ]);

      const latin = await createAdmin(main, { firstName: 'Ali', lastName: 'رضایی', phone: nextPhone() });
      expect(latin.statusCode).toBe(400);
      expect(latin.json().error.details.fields.firstName).toBeTruthy();
    });

    it('refuses a phone number another user already has', async () => {
      const duplicate = await createAdmin(main, {
        firstName: 'تکراری',
        lastName: 'تست',
        phone: MAIN_ADMIN_PHONE,
      });
      expect(duplicate.statusCode).toBe(409);
      expect(duplicate.json().error.code).toBe('ADMIN_PHONE_TAKEN');
    });

    it('lists newest first and searches by name and by number', async () => {
      const phone = nextPhone();
      await createAdmin(main, { firstName: 'نگار', lastName: 'جستجویی', phone });

      const all = await call('GET', '/admin/users', undefined, main);
      expect(all.statusCode).toBe(200);
      expect(all.json().data.items[0].phone).toBe(phone);
      expect(all.json().data.total).toBeGreaterThanOrEqual(4);

      const byName = await call('GET', `/admin/users?search=${encodeURIComponent('نگار جستجو')}`, undefined, main);
      expect(byName.json().data.items.map((u: { phone: string }) => u.phone)).toEqual([phone]);

      // Persian digits, as an operator might type them.
      const persianTail = phone.slice(-6).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
      const byPhone = await call('GET', `/admin/users?search=${encodeURIComponent(persianTail)}`, undefined, main);
      expect(byPhone.json().data.items.map((u: { phone: string }) => u.phone)).toEqual([phone]);

      // A wildcard is a literal character.
      const wildcard = await call('GET', '/admin/users?search=%25', undefined, main);
      expect(wildcard.json().data.total).toBe(0);

      const paged = await call('GET', '/admin/users?pageSize=1&page=2', undefined, main);
      expect(paged.json().data).toMatchObject({ page: 2, pageSize: 1 });
      expect(paged.json().data.items).toHaveLength(1);
    });

    it('edits names and number, and refuses an unknown or malformed id', async () => {
      const created = await createAdmin(main, { firstName: 'مینا', lastName: 'قدیمی', phone: nextPhone() });
      const { id } = created.json().data;
      const newPhone = nextPhone();

      const edited = await call('PATCH', `/admin/users/${id}`, { lastName: 'جدیدی', phone: newPhone }, main);
      expect(edited.statusCode, edited.body).toBe(200);
      expect(edited.json().data).toMatchObject({ firstName: 'مینا', lastName: 'جدیدی', phone: newPhone });

      const taken = await call('PATCH', `/admin/users/${id}`, { phone: MAIN_ADMIN_PHONE }, main);
      expect(taken.json().error.code).toBe('ADMIN_PHONE_TAKEN');

      const empty = await call('PATCH', `/admin/users/${id}`, {}, main);
      expect(empty.statusCode).toBe(400);

      const unknown = await call('PATCH', '/admin/users/00000000-0000-4000-8000-000000000000', { firstName: 'هیچ' }, main);
      expect(unknown.statusCode).toBe(404);

      const malformed = await call('PATCH', '/admin/users/not-a-uuid', { firstName: 'هیچ' }, main);
      expect(malformed.statusCode).toBe(400);
    });
  });

  describe('activation and deactivation', () => {
    it('ends a deactivated user\'s sessions at once, keeps them out, and lets them back in on reactivation', async () => {
      const phone = nextPhone();
      const created = await createAdmin(main, { firstName: 'کامران', lastName: 'موقت', phone });
      const { id } = created.json().data;

      const theirs = await adminSignIn(phone);
      expect((await call('GET', '/admin/users', undefined, theirs)).statusCode).toBe(200);

      const deactivated = await call('PATCH', `/admin/users/${id}`, { status: 'inactive' }, main);
      expect(deactivated.json().data.status).toBe('inactive');

      // The open session is dead on its next request…
      expect((await call('GET', '/admin/users', undefined, theirs)).statusCode).toBe(401);
      const { rows } = await getPool().query(
        `SELECT count(*)::int AS live FROM v2_admin_sessions WHERE admin_id = $1 AND revoked_at IS NULL`,
        [id]
      );
      expect(rows[0].live).toBe(0);

      // …and a fresh sign-in is refused.
      const refused = await adminVerify(phone);
      expect(refused.statusCode).toBe(403);
      expect(refused.json().error.code).toBe('ADMIN_ACCESS_DENIED');

      // Reactivated, they can sign in again. The refused attempt consumed its
      // challenge, so the resend cooldown does not apply.
      const reactivated = await call('PATCH', `/admin/users/${id}`, { status: 'active' }, main);
      expect(reactivated.json().data.status).toBe('active');
      const back = await adminSignIn(phone);
      expect((await call('GET', '/admin/me', undefined, back)).statusCode).toBe(200);
    });

    it('deletes a user for good: their session dies and they cannot sign in', async () => {
      const phone = nextPhone();
      const created = await createAdmin(main, { firstName: 'حذفی', lastName: 'آزمایشی', phone });
      const { id } = created.json().data;
      const theirs = await adminSignIn(phone);

      const deleted = await call('DELETE', `/admin/users/${id}`, undefined, main);
      expect(deleted.statusCode, deleted.body).toBe(200);
      expect(deleted.json().data).toEqual({ deleted: true });

      expect((await call('GET', '/admin/me', undefined, theirs)).statusCode).toBe(401);
      const { rows } = await getPool().query(
        `SELECT (SELECT count(*) FROM v2_admin_users WHERE id = $1)::int AS admins,
                (SELECT count(*) FROM v2_admin_sessions WHERE admin_id = $1)::int AS sessions`,
        [id]
      );
      expect(rows[0]).toEqual({ admins: 0, sessions: 0 });

      const refused = await adminVerify(phone);
      expect(refused.json().error.code).toBe('ADMIN_ACCESS_DENIED');

      // Gone means gone: a second delete is a 404, and the number is free again.
      expect((await call('DELETE', `/admin/users/${id}`, undefined, main)).statusCode).toBe(404);
      expect((await createAdmin(main, { firstName: 'دوباره', lastName: 'آزمایشی', phone })).statusCode).toBe(201);
    });

    it('refuses to let an admin delete themselves, or delete without a session', async () => {
      const { id } = (await call('GET', '/admin/me', undefined, main)).json().data.admin;

      const refused = await call('DELETE', `/admin/users/${id}`, undefined, main);
      expect(refused.statusCode).toBe(400);
      expect(refused.json().error.code).toBe('ADMIN_SELF_DELETION');
      expect((await call('GET', '/admin/me', undefined, main)).statusCode).toBe(200);

      expect((await call('DELETE', `/admin/users/${id}`)).statusCode).toBe(401);
      expect((await call('DELETE', '/admin/users/not-a-uuid', undefined, main)).statusCode).toBe(400);
    });

    it('refuses to let an admin deactivate themselves', async () => {
      const me = await call('GET', '/admin/me', undefined, main);
      const { id } = me.json().data.admin;

      const refused = await call('PATCH', `/admin/users/${id}`, { status: 'inactive' }, main);
      expect(refused.statusCode).toBe(400);
      expect(refused.json().error.code).toBe('ADMIN_SELF_DEACTIVATION');

      // Still signed in, still active.
      const after = await call('GET', '/admin/me', undefined, main);
      expect(after.json().data.admin.status).toBe('active');
    });
  });
});
