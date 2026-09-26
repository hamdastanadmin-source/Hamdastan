import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../../app';
import {
  ADMIN_API,
  DEV_ADMIN,
  installAdminStore,
  login,
  replaceAdmin,
  sessionCookie,
  STRONG_PASSWORD,
} from './fixtures';
import type { AdminUserStore } from '../../admin-users';

/**
 * Signing in to the admin panel, and everything that can refuse to let somebody
 * in: a wrong password, a locked account, a suspended one, an expiry date that
 * has passed, and a password that has to be changed before anything else works.
 *
 * Driven over HTTP through `app.inject()` rather than against the service,
 * because what is being asserted is the answer a client gets — the status, the
 * code it switches on, and whether a cookie came back.
 */

let app: FastifyInstance;
let store: AdminUserStore;

beforeEach(async () => {
  app = await buildApp();
  await app.ready();
  store = await installAdminStore();
});

afterEach(async () => {
  await app.close();
});

/** Somewhere only a signed-in, changed-password admin may go. */
function listUsers(cookie: string) {
  return app.inject({
    method: 'GET',
    url: `${ADMIN_API}/users`,
    headers: { cookie },
  });
}

describe('POST /admin/auth/login', () => {
  it('signs the development admin in and asks for a password change', async () => {
    const { status, body, cookie } = await login<{
      ok: true;
      data: { admin: { username: string; mustChangePassword: boolean; permissions: string[] } };
    }>(app, DEV_ADMIN.username, DEV_ADMIN.password);

    expect(status).toBe(200);
    expect(body.data.admin.username).toBe('Admin');
    expect(body.data.admin.mustChangePassword).toBe(true);
    expect(body.data.admin.permissions).toContain('users.view');
    expect(cookie).toContain('admin_session=');
  });

  it('matches the username case-insensitively', async () => {
    const { status } = await login(app, 'admin', DEV_ADMIN.password);
    expect(status).toBe(200);
  });

  it('never puts a password in the response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${ADMIN_API}/auth/login`,
      payload: { username: DEV_ADMIN.username, password: DEV_ADMIN.password },
    });

    expect(response.body).not.toContain(DEV_ADMIN.password);
    expect(response.body).not.toContain('passwordHash');
  });

  it('rejects a wrong password without saying which half was wrong', async () => {
    const { status, body } = await login<{ ok: false; error: { code: string } }>(
      app,
      DEV_ADMIN.username,
      'not-the-password'
    );

    expect(status).toBe(401);
    expect(body.error.code).toBe('ADMIN_INVALID_CREDENTIALS');
  });

  it('gives an unknown username the same answer as a wrong password', async () => {
    const { status, body } = await login<{ ok: false; error: { code: string } }>(
      app,
      'nobody',
      'not-the-password'
    );

    expect(status).toBe(401);
    expect(body.error.code).toBe('ADMIN_INVALID_CREDENTIALS');
  });

  it('locks the account after too many wrong passwords', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await login(app, DEV_ADMIN.username, 'wrong');
    }

    // Even the right password is refused while the lock holds.
    const { status, body } = await login<{ ok: false; error: { code: string } }>(
      app,
      DEV_ADMIN.username,
      DEV_ADMIN.password
    );

    expect(status).toBe(429);
    expect(body.error.code).toBe('ADMIN_TOO_MANY_ATTEMPTS');
  });

  it('refuses an account whose access has expired', async () => {
    replaceAdmin(store, DEV_ADMIN.username, { accessExpiresAt: '2020-01-01' });

    const { status, body } = await login<{ ok: false; error: { code: string } }>(
      app,
      DEV_ADMIN.username,
      DEV_ADMIN.password
    );

    expect(status).toBe(403);
    expect(body.error.code).toBe('ADMIN_ACCESS_EXPIRED');
  });

  it('refuses a suspended account', async () => {
    replaceAdmin(store, DEV_ADMIN.username, { status: 'SUSPENDED' });

    const { status, body } = await login<{ ok: false; error: { code: string } }>(
      app,
      DEV_ADMIN.username,
      DEV_ADMIN.password
    );

    expect(status).toBe(403);
    expect(body.error.code).toBe('ADMIN_ACCOUNT_SUSPENDED');
  });

  it('refuses a temporary password that has expired', async () => {
    replaceAdmin(store, DEV_ADMIN.username, {
      temporaryPasswordExpiresAt: new Date(Date.now() - 1000),
    });

    const { status, body } = await login<{ ok: false; error: { code: string } }>(
      app,
      DEV_ADMIN.username,
      DEV_ADMIN.password
    );

    expect(status).toBe(403);
    expect(body.error.code).toBe('ADMIN_TEMPORARY_PASSWORD_EXPIRED');
  });
});

describe('the forced password change', () => {
  it('blocks every other admin route until the password is changed', async () => {
    const { cookie } = await login(app, DEV_ADMIN.username, DEV_ADMIN.password);

    const blocked = await listUsers(cookie);

    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.code).toBe('ADMIN_PASSWORD_CHANGE_REQUIRED');
  });

  it('still answers the session lookup, so the panel knows where to send them', async () => {
    const { cookie } = await login(app, DEV_ADMIN.username, DEV_ADMIN.password);

    const response = await app.inject({
      method: 'GET',
      url: `${ADMIN_API}/auth/session`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.admin.mustChangePassword).toBe(true);
  });

  it('lets the admin in once they have chosen a password', async () => {
    const { cookie } = await login(app, DEV_ADMIN.username, DEV_ADMIN.password);

    const changed = await app.inject({
      method: 'POST',
      url: `${ADMIN_API}/auth/change-password`,
      headers: { cookie },
      payload: { newPassword: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD },
    });

    expect(changed.statusCode).toBe(200);
    expect(changed.json().data.admin.mustChangePassword).toBe(false);

    // The change rotates the session, so the new cookie is the usable one.
    const rotated = await listUsers(sessionCookie(changed));
    expect(rotated.statusCode).toBe(200);
  });

  it('invalidates the session the change arrived on', async () => {
    const { cookie } = await login(app, DEV_ADMIN.username, DEV_ADMIN.password);

    await app.inject({
      method: 'POST',
      url: `${ADMIN_API}/auth/change-password`,
      headers: { cookie },
      payload: { newPassword: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD },
    });

    expect((await listUsers(cookie)).statusCode).toBe(401);
  });

  it('signs in with the new password and not the old one', async () => {
    const { cookie } = await login(app, DEV_ADMIN.username, DEV_ADMIN.password);
    await app.inject({
      method: 'POST',
      url: `${ADMIN_API}/auth/change-password`,
      headers: { cookie },
      payload: { newPassword: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD },
    });

    expect((await login(app, DEV_ADMIN.username, STRONG_PASSWORD)).status).toBe(200);
    expect((await login(app, DEV_ADMIN.username, DEV_ADMIN.password)).status).toBe(401);
  });

  it('enforces the password policy on the backend, whatever the form allowed', async () => {
    const { cookie } = await login(app, DEV_ADMIN.username, DEV_ADMIN.password);

    // Seven characters, then one rule missing each time: too short, no
    // uppercase, no lowercase, no digit, no special character.
    for (const weak of ['Ab1!cde', 'alllowercase1!', 'ALLUPPERCASE1!', 'NoDigitsHere!', 'NoSpecial123']) {
      const response = await app.inject({
        method: 'POST',
        url: `${ADMIN_API}/auth/change-password`,
        headers: { cookie },
        payload: { newPassword: weak, confirmPassword: weak },
      });

      expect(response.statusCode, `"${weak}" should be refused`).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('refuses a mismatched confirmation', async () => {
    const { cookie } = await login(app, DEV_ADMIN.username, DEV_ADMIN.password);

    const response = await app.inject({
      method: 'POST',
      url: `${ADMIN_API}/auth/change-password`,
      headers: { cookie },
      payload: { newPassword: STRONG_PASSWORD, confirmPassword: `${STRONG_PASSWORD}x` },
    });

    expect(response.statusCode).toBe(400);
  });

  it('refuses to change a password without a session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${ADMIN_API}/auth/change-password`,
      payload: { newPassword: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('the session', () => {
  it('refuses a request with no cookie', async () => {
    const response = await app.inject({ method: 'GET', url: `${ADMIN_API}/auth/session` });
    expect(response.statusCode).toBe(401);
  });

  it('refuses a cookie that was never issued', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${ADMIN_API}/auth/session`,
      headers: { cookie: 'admin_session=made-up' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('stops working once the account expires mid-session', async () => {
    const { cookie } = await login(app, DEV_ADMIN.username, DEV_ADMIN.password);

    replaceAdmin(store, DEV_ADMIN.username, { accessExpiresAt: '2020-01-01' });

    const response = await app.inject({
      method: 'GET',
      url: `${ADMIN_API}/auth/session`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ADMIN_ACCESS_EXPIRED');
  });

  it('is invalidated by signing out', async () => {
    const { cookie } = await login(app, DEV_ADMIN.username, DEV_ADMIN.password);

    const loggedOut = await app.inject({
      method: 'POST',
      url: `${ADMIN_API}/auth/logout`,
      headers: { cookie },
    });
    expect(loggedOut.statusCode).toBe(200);

    const after = await app.inject({
      method: 'GET',
      url: `${ADMIN_API}/auth/session`,
      headers: { cookie },
    });
    expect(after.statusCode).toBe(401);
  });
});
