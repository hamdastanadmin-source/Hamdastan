import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ADMIN_SESSION, API_PREFIX } from '@hamdastan/config';
import { ADMIN_ROLE_PERMISSIONS, type AdminPermission, type AdminRole } from '@hamdastan/types';

import { buildApp } from '../app';
import { closePool, getPool, runMigrations } from '../data';
import type { SmsSender } from '../integrations';
import { setAdminRepository, sqlAdminRepository } from '../modules/admin';
import { setAuthRepository, setSmsSender, sqlAuthRepository } from '../modules/auth';
import { setEngagementRepository, sqlEngagementRepository } from '../modules/engagement';
import { setProgressRepository, sqlProgressRepository } from '../modules/progress';
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

/** A system admin unless the test says otherwise: most of these are about the list, not roles. */
async function createAdmin(cookies: Cookies, fields: Record<string, unknown>) {
  return call('POST', '/admin/users', { role: 'system_admin', ...fields }, cookies);
}

describe.skipIf(!hasDatabase)('admin panel against a migrated database', () => {
  let main: Cookies;

  beforeAll(async () => {
    await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations();

    setUsersRepository(sqlUsersRepository);
    setAuthRepository(sqlAuthRepository);
    setAdminRepository(sqlAdminRepository);
    setProgressRepository(sqlProgressRepository);
    setEngagementRepository(sqlEngagementRepository);
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

  describe('the admin idle timeout', () => {
    it('ends a session unused for two hours, though its twelve are not up', async () => {
      const cookies = await adminSignIn(MAIN_ADMIN_PHONE);
      expect((await call('GET', '/admin/me', undefined, cookies)).statusCode).toBe(200);

      await getPool().query(
        `UPDATE v2_admin_sessions SET last_seen_at = now() - interval '2 hours 1 minute'
          WHERE token_hash = encode(sha256($1::bytea), 'hex')`,
        [cookies[ADMIN_SESSION.COOKIE]]
      );
      expect((await call('GET', '/admin/me', undefined, cookies)).statusCode).toBe(401);
    });

    it('counts use as activity, so a working admin stays signed in', async () => {
      const cookies = await adminSignIn(MAIN_ADMIN_PHONE);
      await getPool().query(
        `UPDATE v2_admin_sessions SET last_seen_at = now() - interval '1 hour 50 minutes'
          WHERE token_hash = encode(sha256($1::bytea), 'hex')`,
        [cookies[ADMIN_SESSION.COOKIE]]
      );
      expect((await call('GET', '/admin/me', undefined, cookies)).statusCode).toBe(200);
      const { rows } = await getPool().query(
        `SELECT last_seen_at > now() - interval '1 minute' AS fresh FROM v2_admin_sessions
          WHERE token_hash = encode(sha256($1::bytea), 'hex')`,
        [cookies[ADMIN_SESSION.COOKIE]]
      );
      expect(rows[0].fresh).toBe(true);
    });
  });

  describe("managing a person's sessions", () => {
    async function productSignIn(phone: string): Promise<Cookies> {
      const requested = await call('POST', '/auth/otp/request', { phone });
      const code = requested.json().data.debugCode as string;
      const verified = await app.inject({
        method: 'POST',
        url: `${API_PREFIX}/auth/otp/verify`,
        payload: { phone, code },
        headers: { 'user-agent': 'Mozilla/5.0 (iPhone) test' },
      });
      expect(verified.statusCode, verified.body).toBe(200);
      return cookiesFrom(verified);
    }
    const me = (cookies: Cookies) => call('GET', '/me', undefined, cookies);

    it('finds a person by number and lists their live sessions with the device', async () => {
      const admin = await adminSignIn(MAIN_ADMIN_PHONE);
      const phone = nextPhone();
      await productSignIn(phone);
      await productSignIn(phone);

      const found = await call('POST', '/admin/app-users/sessions/lookup', { phone }, admin);
      expect(found.statusCode, found.body).toBe(200);
      const { user, sessions } = found.json().data;
      expect(user).toMatchObject({ phone, suspended: false });
      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toMatchObject({ userAgent: 'Mozilla/5.0 (iPhone) test', ip: '127.0.0.1' });

      expect((await call('POST', '/admin/app-users/sessions/lookup', { phone: nextPhone() }, admin)).statusCode).toBe(404);
    });

    it('ends one session at once, and leaves the others', async () => {
      const admin = await adminSignIn(MAIN_ADMIN_PHONE);
      const phone = nextPhone();
      const first = await productSignIn(phone);
      const second = await productSignIn(phone);
      const { user, sessions } = (await call('POST', '/admin/app-users/sessions/lookup', { phone }, admin)).json().data;

      // Newest first: the second sign-in.
      const ended = await call('DELETE', `/admin/app-users/${user.id}/sessions/${sessions[0].id}`, undefined, admin);
      expect(ended.statusCode, ended.body).toBe(200);
      expect((await me(second)).statusCode).toBe(401);
      expect((await call('POST', '/auth/refresh', undefined, second)).statusCode).toBe(401);
      expect((await me(first)).statusCode).toBe(200);

      // Already ended, or not this person's: 404, never another's session.
      expect((await call('DELETE', `/admin/app-users/${user.id}/sessions/${sessions[0].id}`, undefined, admin)).statusCode).toBe(404);
      const other = (await call('POST', '/admin/app-users/sessions/lookup', { phone: MAIN_ADMIN_PHONE }, admin));
      if (other.statusCode === 200) {
        const otherId = other.json().data.user.id as string;
        expect((await call('DELETE', `/admin/app-users/${otherId}/sessions/${sessions[1].id}`, undefined, admin)).statusCode).toBe(404);
        expect((await me(first)).statusCode).toBe(200);
      }

      const { rows } = await getPool().query(`SELECT revoked_reason FROM v2_sessions WHERE id = $1`, [sessions[0].id]);
      expect(rows[0].revoked_reason).toBe('admin');
    });

    it('ends every session the person has', async () => {
      const admin = await adminSignIn(MAIN_ADMIN_PHONE);
      const phone = nextPhone();
      const devices = [await productSignIn(phone), await productSignIn(phone), await productSignIn(phone)];
      const { user } = (await call('POST', '/admin/app-users/sessions/lookup', { phone }, admin)).json().data;

      const all = await call('DELETE', `/admin/app-users/${user.id}/sessions`, undefined, admin);
      expect(all.statusCode, all.body).toBe(200);
      expect(all.json().data).toEqual({ revoked: 3 });
      for (const device of devices) expect((await me(device)).statusCode).toBe(401);

      const after = await call('GET', `/admin/app-users/${user.id}/sessions`, undefined, admin);
      expect(after.json().data.sessions).toEqual([]);
    });

    it('is closed to anyone without an admin session, and refuses malformed ids', async () => {
      const admin = await adminSignIn(MAIN_ADMIN_PHONE);
      const person = await productSignIn(nextPhone());
      const someId = '00000000-0000-4000-8000-000000000000';

      expect((await call('POST', '/admin/app-users/sessions/lookup', { phone: MAIN_ADMIN_PHONE })).statusCode).toBe(401);
      expect((await call('POST', '/admin/app-users/sessions/lookup', { phone: MAIN_ADMIN_PHONE }, person)).statusCode).toBe(401);
      expect((await call('DELETE', `/admin/app-users/${someId}/sessions`, undefined, person)).statusCode).toBe(401);
      expect((await call('DELETE', `/admin/app-users/not-a-uuid/sessions`, undefined, admin)).statusCode).toBe(400);
      expect((await call('GET', `/admin/app-users/${someId}/sessions`, undefined, admin)).statusCode).toBe(404);
    });
  });

  describe('roles and permissions', () => {
    const ANY = '00000000-0000-4000-8000-000000000000';
    /** Every admin route that does something, and the permission it needs. */
    const ROUTES: Array<{ method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; url: string; needs: AdminPermission; body?: unknown }> = [
      { method: 'GET', url: '/admin/users', needs: 'admins.manage' },
      { method: 'POST', url: '/admin/users', needs: 'admins.manage', body: {} },
      { method: 'PATCH', url: `/admin/users/${ANY}`, needs: 'admins.manage', body: {} },
      { method: 'DELETE', url: `/admin/users/${ANY}`, needs: 'admins.manage' },
      { method: 'POST', url: '/admin/app-users/sessions/lookup', needs: 'sessions.manage', body: {} },
      { method: 'GET', url: `/admin/app-users/${ANY}/sessions`, needs: 'sessions.manage' },
      { method: 'DELETE', url: `/admin/app-users/${ANY}/sessions/${ANY}`, needs: 'sessions.manage' },
      { method: 'DELETE', url: `/admin/app-users/${ANY}/sessions`, needs: 'sessions.manage' },
      { method: 'GET', url: '/admin/engagement/activities', needs: 'activities.read' },
      { method: 'POST', url: '/admin/engagement/activities', needs: 'activities.write', body: {} },
      { method: 'GET', url: `/admin/engagement/activities/${ANY}`, needs: 'activities.read' },
      { method: 'POST', url: `/admin/engagement/activities/${ANY}/status`, needs: 'activities.publish', body: {} },
      { method: 'POST', url: `/admin/engagement/activities/${ANY}/duplicate`, needs: 'activities.write' },
      { method: 'GET', url: `/admin/engagement/activities/${ANY}/results`, needs: 'results.read' },
      { method: 'GET', url: `/admin/engagement/activities/${ANY}/export`, needs: 'results.export' },
      { method: 'GET', url: `/admin/engagement/activities/${ANY}/submissions`, needs: 'results.individual' },
      { method: 'GET', url: `/admin/engagement/activities/${ANY}/grants`, needs: 'xp.read' },
      { method: 'POST', url: `/admin/engagement/submissions/${ANY}/review`, needs: 'submissions.review', body: {} },
      { method: 'POST', url: `/admin/engagement/xp/${ANY}/revoke`, needs: 'xp.revoke', body: {} },
    ];

    async function signedInAs(role: AdminRole): Promise<Cookies> {
      const admin = await adminSignIn(MAIN_ADMIN_PHONE);
      const phone = nextPhone();
      const created = await createAdmin(admin, { firstName: 'نقش', lastName: 'آزمایشی', phone, role });
      expect(created.statusCode, created.body).toBe(201);
      expect(created.json().data.role).toBe(role);
      return adminSignIn(phone);
    }

    it.each(['system_admin', 'content_manager', 'mission_reviewer'] as const)(
      'lets a %s through exactly the routes its permissions name',
      async (role) => {
        const cookies = await signedInAs(role);
        for (const route of ROUTES) {
          const response = await call(route.method, route.url, route.body, cookies);
          const allowed = ADMIN_ROLE_PERMISSIONS[role].includes(route.needs);
          if (allowed) {
            // Past the guard: whatever the handler says about a made-up id, not a 403.
            expect(response.statusCode, `${role} ${route.method} ${route.url}`).not.toBe(403);
          } else {
            expect(response.statusCode, `${role} ${route.method} ${route.url}`).toBe(403);
            expect(response.json().error.code).toBe('ADMIN_PERMISSION_DENIED');
          }
        }
      }
    );

    it('gives every role its own view of itself', async () => {
      const reviewer = await signedInAs('mission_reviewer');
      const me = await call('GET', '/admin/me', undefined, reviewer);
      expect(me.statusCode).toBe(200);
      expect(me.json().data.admin.role).toBe('mission_reviewer');
    });

    it('requires a role to create an admin, and refuses one that does not exist', async () => {
      const admin = await adminSignIn(MAIN_ADMIN_PHONE);
      const base = { firstName: 'بی', lastName: 'نقش', phone: nextPhone() };
      expect((await call('POST', '/admin/users', base, admin)).statusCode).toBe(400);
      expect((await call('POST', '/admin/users', { ...base, role: 'root' }, admin)).statusCode).toBe(400);
    });

    it('changes a role, effective on the next request, but never your own', async () => {
      const admin = await adminSignIn(MAIN_ADMIN_PHONE);
      const phone = nextPhone();
      const created = (await createAdmin(admin, { firstName: 'ارتقا', lastName: 'آزمایشی', phone, role: 'content_manager' })).json().data;
      const theirs = await adminSignIn(phone);
      expect((await call('GET', '/admin/users', undefined, theirs)).statusCode).toBe(403);

      expect((await call('PATCH', `/admin/users/${created.id}`, { role: 'system_admin' }, admin)).statusCode).toBe(200);
      expect((await call('GET', '/admin/users', undefined, theirs)).statusCode).toBe(200);

      const self = (await call('GET', '/admin/me', undefined, admin)).json().data.admin;
      const demote = await call('PATCH', `/admin/users/${self.id}`, { role: 'content_manager' }, admin);
      expect(demote.statusCode).toBe(400);
      expect(demote.json().error.code).toBe('ADMIN_SELF_ROLE_CHANGE');
    });

    it("checks the admin's status on every request, not only when their sessions are revoked", async () => {
      const admin = await adminSignIn(MAIN_ADMIN_PHONE);
      const phone = nextPhone();
      await createAdmin(admin, { firstName: 'وضعیت', lastName: 'آزمایشی', phone, role: 'content_manager' });
      const theirs = await adminSignIn(phone);
      expect((await call('GET', '/admin/engagement/activities', undefined, theirs)).statusCode).toBe(200);

      // Straight in the database — no session is revoked, only the status changes.
      await getPool().query(`UPDATE v2_admin_users SET status = 'INACTIVE' WHERE phone = $1`, [phone]);
      expect((await call('GET', '/admin/engagement/activities', undefined, theirs)).statusCode).toBe(401);
      expect((await call('GET', '/admin/me', undefined, theirs)).statusCode).toBe(401);
    });

    it('keeps existing admins as system admins after the migration', async () => {
      const { rows } = await getPool().query(`SELECT role FROM v2_admin_users WHERE phone = $1`, [MAIN_ADMIN_PHONE]);
      expect(rows[0].role).toBe('SYSTEM_ADMIN');
    });
  });
});
