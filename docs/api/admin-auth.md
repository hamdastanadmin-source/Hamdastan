# API — admin auth

Base path: `/api/v1/admin/auth`. Every response is the `ApiResponse<T>` envelope
from `@hamdastan/types`:

```json
{ "ok": true,  "data": { … } }
{ "ok": false, "error": { "code": "…", "message": "…", "details": { … } } }
```

`message` is Persian and safe to show an admin. **The client switches on `code`,
not on `message`** — the codes are stable, the wording is not.

This is the admin panel's sign-in and it has nothing to do with
[`/auth`](./auth.md), which is the product's passwordless flow. Different
module, different cookie, different user store, and no path from one into the
other.

Request bodies are validated in `admin-auth.controller.ts` against the schemas
in `packages/validation/admin.ts`, the same ones the forms use. The flow these
endpoints make up is described in
[../architecture/admin-auth-flow.md](../architecture/admin-auth-flow.md).

---

## The session cookie

`admin_session`, `httpOnly`, `SameSite=Lax`, `Secure` in production, 12 hours by
default (`ADMIN_SESSION_MAX_AGE_HOURS`). It is set by `/login` and
`/change-password`, cleared by `/logout`, and never appears in a response body.

The token is stored **hashed**. A session also stops resolving the moment the
account's password is written by anybody — see *Sessions* in
[the data model](../architecture/admin-data-model.md).

---

## POST /admin/auth/login

```json
{ "username": "Admin", "password": "Admin1234" }
```

**200** — the session cookie is set, and the body is the signed-in admin:

```json
{
  "ok": true,
  "data": {
    "admin": {
      "id": "…",
      "firstName": "مدیر",
      "lastName": "سیستم",
      "fullName": "مدیر سیستم",
      "username": "Admin",
      "mobile": "09120000000",
      "roleCode": "super_admin",
      "roleName": "مدیر ارشد",
      "status": "ACTIVE",
      "accessExpiresAt": "2099-12-31",
      "accessExpired": false,
      "mustChangePassword": true,
      "lastLoginAt": "2026-09-25T10:53:32.015Z",
      "passwordChangedAt": null,
      "createdAt": "2026-09-25T10:52:09.273Z",
      "permissions": ["dashboard.view", "users.view", "users.create", "users.edit", "users.reset_password"]
    }
  }
}
```

`mustChangePassword: true` means the panel may show exactly one screen —
`/change-password`. Every other admin route answers `403
ADMIN_PASSWORD_CHANGE_REQUIRED` until it is done.

The username is matched case-insensitively. Usernames are not validated against
the username rules here: an account whose spelling predates a rule change must
still be able to sign in.

| Failure | Status | Code |
| --- | --- | --- |
| Wrong password, or no such username | 401 | `ADMIN_INVALID_CREDENTIALS` |
| Too many wrong passwords | 429 | `ADMIN_TOO_MANY_ATTEMPTS` |
| Account suspended | 403 | `ADMIN_ACCOUNT_SUSPENDED` |
| `accessExpiresAt` has passed | 403 | `ADMIN_ACCESS_EXPIRED` |
| Temporary password has expired | 403 | `ADMIN_TEMPORARY_PASSWORD_EXPIRED` |
| Missing username or password | 400 | `VALIDATION_ERROR` |

An unknown username and a wrong password give the same answer, and take the
same time — the backend hashes a password even when there is no account, so the
difference is not detectable by timing.

`ADMIN_TOO_MANY_ATTEMPTS` carries `details.retryAfterSeconds`. The lock is
`ADMIN_LOGIN_MAX_ATTEMPTS` consecutive wrong passwords, held for
`ADMIN_LOGIN_LOCK_MINUTES`, and it refuses the right password too.

---

## POST /admin/auth/change-password

The forced change. Requires a session; it is the **only** endpoint an account
with `mustChangePassword` may call besides `/session` and `/logout`.

```json
{ "newPassword": "Hamdastan!2026", "confirmPassword": "Hamdastan!2026" }
```

**200** — the same `admin` shape as `/login`, with `mustChangePassword: false`,
and **a new session cookie**.

The session is rotated deliberately: writing the password invalidates every
session the account had, which would otherwise include the one this request
arrived on. The browser keeps working because it is handed the replacement in
the same response; any other device holding a session is signed out.

The policy is five rules, defined once in `packages/validation/admin.ts` and
read by both the form's checklist and this endpoint:

- at least 8 characters
- at least one uppercase Latin letter
- at least one lowercase Latin letter
- at least one digit
- at least one special character

| Failure | Status | Code |
| --- | --- | --- |
| Policy not met, or confirmation does not match | 400 | `VALIDATION_ERROR` |
| No session, or a session that no longer resolves | 401 | `UNAUTHORIZED` |
| Account suspended or expired | 403 | `ADMIN_ACCOUNT_SUSPENDED` / `ADMIN_ACCESS_EXPIRED` |

A weak password is refused here whatever the form allowed: the front-end check
saves a round trip, and this is the decision.

---

## GET /admin/auth/session

Who the cookie belongs to, and what they may do.

**200** — the same `admin` shape as `/login`.

It answers while `mustChangePassword` is set, which is what lets the panel send
that admin to the right screen rather than to a 403. It does **not** answer for
a suspended or expired account.

| Failure | Status | Code |
| --- | --- | --- |
| No cookie, unknown cookie, expired session, or a session invalidated by a password write | 401 | `UNAUTHORIZED` |
| Account suspended | 403 | `ADMIN_ACCOUNT_SUSPENDED` |
| Access expired | 403 | `ADMIN_ACCESS_EXPIRED` |

`apps/admin` treats 401 and 403 alike here — both mean "this browser has no
usable session" — and renders the login screen.

---

## POST /admin/auth/logout

Invalidates the session server-side and clears the cookie.

**200**

```json
{ "ok": true, "data": { "loggedOut": true } }
```

Always succeeds, with or without a usable cookie: the admin asked to leave, and
a stale cookie is refused on its next use anyway. Signing out of the panel does
not touch a product session in the same browser, and the reverse is also true.

---

## Development credentials

`apps/api` seeds one admin outside production, because admins cannot register
themselves and the store starts empty:

| | |
| --- | --- |
| Username | `Admin` |
| Password | `Admin1234` |
| Role | `super_admin` |
| `mustChangePassword` | `true` |

It is seeded in `app.ts` under `!env.isProduction`, so in production the store
is empty and the first admin has to be created by whatever bootstraps the real
data layer. The account starts owing a password change on purpose: a first
sign-in walks the forced-change flow rather than stepping around it.
