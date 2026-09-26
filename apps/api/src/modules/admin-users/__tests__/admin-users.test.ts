import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../../app';
import { mockSmsProvider } from '../../../integrations/sms';
import {
  ADMIN_API,
  DEV_ADMIN,
  installAdminStore,
  login,
  newAdminPayload,
  sentTemporaryPassword,
  sessionCookie,
  STRONG_PASSWORD,
} from '../../admin-auth/__tests__/fixtures';
import type { AdminUserStore } from '../admin-users.repository';

/**
 * «مدیریت کاربران»: creating an admin, editing one, and replacing the password
 * of one — and the permission checks that decide who may do any of it.
 *
 * The temporary password is never read from a response here. It is taken out of
 * the mock gateway's outbox, the way the new admin would take it off their
 * phone, so the tests do not depend on the development echo being switched on.
 */

let app: FastifyInstance;
let store: AdminUserStore;
/** A signed-in super admin, past the forced password change. */
let admin: string;

const MOBILE = '09121112233';

beforeEach(async () => {
  app = await buildApp();
  await app.ready();
  store = await installAdminStore();

  const first = await login(app, DEV_ADMIN.username, DEV_ADMIN.password);
  const changed = await app.inject({
    method: 'POST',
    url: `${ADMIN_API}/auth/change-password`,
    headers: { cookie: first.cookie },
    payload: { newPassword: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD },
  });

  admin = sessionCookie(changed);
});

afterEach(async () => {
  await app.close();
});

function createAdmin(payload: Record<string, unknown>, cookie = admin) {
  return app.inject({
    method: 'POST',
    url: `${ADMIN_API}/users`,
    headers: { cookie },
    payload,
  });
}

/** Creates an admin and walks them through their first sign-in. */
async function createAndSignIn(username: string, mobile: string, roleCode?: string) {
  await createAdmin(
    newAdminPayload({
      username,
      mobile,
      ...(roleCode ? { roleCode: roleCode as 'support' } : {}),
    })
  );

  const temporary = sentTemporaryPassword(mobile);
  const first = await login(app, username, temporary);

  const changed = await app.inject({
    method: 'POST',
    url: `${ADMIN_API}/auth/change-password`,
    headers: { cookie: first.cookie },
    payload: { newPassword: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD },
  });

  return { cookie: sessionCookie(changed), temporary };
}

describe('GET /admin/users', () => {
  it('lists the accounts that exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${ADMIN_API}/users`,
      headers: { cookie: admin },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.total).toBe(1);
    expect(response.json().data.items[0].username).toBe('Admin');
  });

  it('searches by name, username and mobile', async () => {
    await createAdmin(newAdminPayload({ username: 'sara', mobile: MOBILE }));

    const byMobile = await app.inject({
      method: 'GET',
      url: `${ADMIN_API}/users?search=${MOBILE}`,
      headers: { cookie: admin },
    });

    expect(byMobile.json().data.total).toBe(1);
    expect(byMobile.json().data.items[0].username).toBe('sara');

    const byUsername = await app.inject({
      method: 'GET',
      url: `${ADMIN_API}/users?search=SAR`,
      headers: { cookie: admin },
    });
    expect(byUsername.json().data.total).toBe(1);
  });

  it('never exposes a password hash', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${ADMIN_API}/users`,
      headers: { cookie: admin },
    });

    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain('scrypt$');
  });

  it('refuses a request with no session', async () => {
    const response = await app.inject({ method: 'GET', url: `${ADMIN_API}/users` });
    expect(response.statusCode).toBe(401);
  });
});

describe('POST /admin/users', () => {
  it('creates an account, forces a change and texts the credentials', async () => {
    const response = await createAdmin(newAdminPayload({ username: 'sara', mobile: MOBILE }));

    expect(response.statusCode).toBe(201);

    const { user, smsDelivered } = response.json().data;
    expect(user.username).toBe('sara');
    expect(user.mustChangePassword).toBe(true);
    expect(user.roleName).toBe('مدیر کاربران');
    expect(smsDelivered).toBe(true);

    const message = mockSmsProvider.lastMessageFor(MOBILE);
    expect(message?.purpose).toBe('ADMIN_CREDENTIALS');
    expect(message?.text).toContain('sara');
    expect(sentTemporaryPassword(MOBILE)).toMatch(/^\d{6}$/);
  });

  it('refuses a username that is already taken, whatever its case', async () => {
    await createAdmin(newAdminPayload({ username: 'sara', mobile: MOBILE }));

    const again = await createAdmin(
      newAdminPayload({ username: 'SARA', mobile: '09121112234' })
    );

    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('CONFLICT');
  });

  it('refuses an incomplete body', async () => {
    const response = await createAdmin({ username: 'sara' });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses an access date that has already passed', async () => {
    const response = await createAdmin(
      newAdminPayload({ username: 'sara', mobile: MOBILE, accessExpiresAt: '2020-01-01' })
    );

    expect(response.statusCode).toBe(400);
  });

  it('normalises the mobile number it was given', async () => {
    const response = await createAdmin(
      newAdminPayload({ username: 'sara', mobile: '+98 912 111 2233' })
    );

    expect(response.json().data.user.mobile).toBe(MOBILE);
  });

  it('lets the new admin sign in and change their password', async () => {
    await createAdmin(newAdminPayload({ username: 'sara', mobile: MOBILE }));
    const temporary = sentTemporaryPassword(MOBILE);

    const first = await login<{ data: { admin: { mustChangePassword: boolean } } }>(
      app,
      'sara',
      temporary
    );
    expect(first.status).toBe(200);
    expect(first.body.data.admin.mustChangePassword).toBe(true);

    // Nothing but the change works until it is done.
    const blocked = await app.inject({
      method: 'GET',
      url: `${ADMIN_API}/users`,
      headers: { cookie: first.cookie },
    });
    expect(blocked.json().error.code).toBe('ADMIN_PASSWORD_CHANGE_REQUIRED');

    const changed = await app.inject({
      method: 'POST',
      url: `${ADMIN_API}/auth/change-password`,
      headers: { cookie: first.cookie },
      payload: { newPassword: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD },
    });
    expect(changed.statusCode).toBe(200);

    const allowed = await app.inject({
      method: 'GET',
      url: `${ADMIN_API}/users`,
      headers: { cookie: sessionCookie(changed) },
    });
    expect(allowed.statusCode).toBe(200);
  });
});

describe('PATCH /admin/users/:id', () => {
  it('changes a role, an expiry and a status', async () => {
    const created = await createAdmin(newAdminPayload({ username: 'sara', mobile: MOBILE }));
    const { id } = created.json().data.user;

    const response = await app.inject({
      method: 'PATCH',
      url: `${ADMIN_API}/users/${id}`,
      headers: { cookie: admin },
      payload: { roleCode: 'support', accessExpiresAt: '2098-01-01', status: 'SUSPENDED' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.user.roleCode).toBe('support');
    expect(response.json().data.user.accessExpiresAt).toBe('2098-01-01');
    expect(response.json().data.user.status).toBe('SUSPENDED');
  });

  it('refuses a role that is not in the catalogue', async () => {
    const created = await createAdmin(newAdminPayload({ username: 'sara', mobile: MOBILE }));

    const response = await app.inject({
      method: 'PATCH',
      url: `${ADMIN_API}/users/${created.json().data.user.id}`,
      headers: { cookie: admin },
      payload: { roleCode: 'root' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('answers 404 for an account that does not exist', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `${ADMIN_API}/users/nope`,
      headers: { cookie: admin },
      payload: { firstName: 'تازه' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('POST /admin/users/:id/reset-password', () => {
  it('replaces the password, kills the old one and forces another change', async () => {
    const { cookie, temporary } = await createAndSignIn('sara', MOBILE);

    // The account is in normal use: signed in, password chosen.
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `${ADMIN_API}/users`,
          headers: { cookie },
        })
      ).statusCode
    ).toBe(200);

    const { id } = (
      await app.inject({
        method: 'GET',
        url: `${ADMIN_API}/users?search=sara`,
        headers: { cookie: admin },
      })
    ).json().data.items[0];

    const reset = await app.inject({
      method: 'POST',
      url: `${ADMIN_API}/users/${id}/reset-password`,
      headers: { cookie: admin },
    });

    expect(reset.statusCode).toBe(200);
    expect(reset.json().data.user.mustChangePassword).toBe(true);

    const replacement = sentTemporaryPassword(MOBILE);
    expect(replacement).not.toBe(temporary);

    // The password they had chosen no longer works…
    expect((await login(app, 'sara', STRONG_PASSWORD)).status).toBe(401);
    // …nor does the temporary one that preceded it…
    expect((await login(app, 'sara', temporary)).status).toBe(401);
    // …and their session is gone.
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `${ADMIN_API}/users`,
          headers: { cookie },
        })
      ).statusCode
    ).toBe(401);

    // The new one works, and lands them back on the change-password screen.
    const again = await login<{ data: { admin: { mustChangePassword: boolean } } }>(
      app,
      'sara',
      replacement
    );
    expect(again.status).toBe(200);
    expect(again.body.data.admin.mustChangePassword).toBe(true);
  });

  it('never returns the password in production shape', async () => {
    const created = await createAdmin(newAdminPayload({ username: 'sara', mobile: MOBILE }));

    // SHOW_DEV_CREDENTIALS is off in the test environment, so the echo is off
    // too — exactly as it is forced to be in production.
    expect(created.json().data.temporaryPassword).toBeUndefined();
  });
});

describe('permissions', () => {
  it('refuses an admin whose role has no users permission', async () => {
    const { cookie } = await createAndSignIn('hamid', '09129998877', 'support');

    const list = await app.inject({
      method: 'GET',
      url: `${ADMIN_API}/users`,
      headers: { cookie },
    });

    expect(list.statusCode).toBe(403);
    expect(list.json().error.code).toBe('ADMIN_FORBIDDEN');

    const create = await createAdmin(
      newAdminPayload({ username: 'nobody', mobile: '09120001122' }),
      cookie
    );
    expect(create.statusCode).toBe(403);
  });

  it('tells that admin what they may do, so the panel can hide the rest', async () => {
    const { cookie } = await createAndSignIn('hamid', '09129998877', 'support');

    const session = await app.inject({
      method: 'GET',
      url: `${ADMIN_API}/auth/session`,
      headers: { cookie },
    });

    expect(session.json().data.admin.permissions).toEqual(['dashboard.view']);
  });

  it('keeps the store consistent with what it reported', async () => {
    await createAdmin(newAdminPayload({ username: 'sara', mobile: MOBILE }));

    // One development admin plus the account just created.
    expect(store.users.size).toBe(2);
  });
});
