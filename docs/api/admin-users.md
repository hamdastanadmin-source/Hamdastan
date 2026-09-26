# API — admin users

Base path: `/api/v1/admin/users`. Same `ApiResponse<T>` envelope as everything
else; see [admin-auth.md](./admin-auth.md) for the envelope and the session
cookie.

This is «مدیریت کاربران»: the admin accounts themselves. Every route is
guarded, and the guard is not a formality — it is the same check the panel uses
to hide a menu, made again where it counts.

---

## What every route checks first

`middleware/admin-guard.ts` runs before the handler and requires all five:

1. **Authenticated** — a session cookie that still resolves.
2. **Active** — `status = ACTIVE`.
3. **In date** — `accessExpiresAt` has not passed, in `Asia/Tehran`.
4. **Past the forced change** — `mustChangePassword` is false.
5. **Permitted** — the caller's role carries the permission the route names.

| Refusal | Status | Code |
| --- | --- | --- |
| No session or a session that no longer resolves | 401 | `UNAUTHORIZED` |
| Suspended account | 403 | `ADMIN_ACCOUNT_SUSPENDED` |
| Access expired | 403 | `ADMIN_ACCESS_EXPIRED` |
| Still owes a password change | 403 | `ADMIN_PASSWORD_CHANGE_REQUIRED` |
| Role lacks the permission | 403 | `ADMIN_FORBIDDEN` |

The order matters: an account that owes a password change is refused before its
permissions are considered, so it cannot reach anything by having a generous
role.

Permissions per route:

| Route | Permission |
| --- | --- |
| `GET /admin/users` | `users.view` |
| `POST /admin/users` | `users.create` |
| `GET /admin/users/:id` | `users.view` |
| `PATCH /admin/users/:id` | `users.edit` |
| `POST /admin/users/:id/reset-password` | `users.reset_password` |

Which role carries which permission is in
[../architecture/admin-data-model.md](../architecture/admin-data-model.md#4-roles-and-permissions).

**No response from any route here ever contains a password hash**, and only the
two credential-issuing routes can contain a password at all — outside
production, and only then.

---

## GET /admin/users

The list behind the table.

| Query | Default | Notes |
| --- | --- | --- |
| `search` | — | Matches first name, last name, full name, username or mobile, case-insensitively |
| `page` | `1` | |
| `pageSize` | `20` | Max 100 |

**200** — a `Paginated<AdminUser>`:

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "…",
        "firstName": "سارا",
        "lastName": "محمدی",
        "fullName": "سارا محمدی",
        "username": "sara",
        "mobile": "09121234567",
        "roleCode": "support",
        "roleName": "پشتیبان",
        "status": "ACTIVE",
        "accessExpiresAt": "2027-03-20",
        "accessExpired": false,
        "mustChangePassword": true,
        "lastLoginAt": null,
        "passwordChangedAt": null,
        "createdAt": "2026-09-25T10:53:48.098Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 2
  }
}
```

Newest first. Searching and paging are done by the backend, so a page of
results is a page of the whole set rather than a filter over what a client
already had.

`accessExpired` is computed here rather than in the browser: the client's clock
is not the clock that grants access.

---

## GET /admin/users/:id

**200** — `{ "user": AdminUser }`. **404** `NOT_FOUND` if there is no such
account.

---

## POST /admin/users

Creates an admin account and sends it its first password. **There is no
password field** — the backend generates one.

```json
{
  "firstName": "سارا",
  "lastName": "محمدی",
  "username": "sara",
  "mobile": "09121234567",
  "roleCode": "support",
  "accessExpiresAt": "2027-03-20"
}
```

| Field | Rule |
| --- | --- |
| `firstName`, `lastName` | Required, 2–50 characters |
| `username` | Required, unique (case-insensitive), 3–32 characters, `A–Z a–z 0–9 . _ -` |
| `mobile` | Required, a valid Iranian mobile number; normalised to `09xxxxxxxxx` |
| `roleCode` | Required, one of the catalogue's codes |
| `accessExpiresAt` | Required, ISO `YYYY-MM-DD`, not in the past |

**201**

```json
{
  "ok": true,
  "data": {
    "user": { "…": "AdminUser, with mustChangePassword: true" },
    "smsDelivered": true,
    "temporaryPassword": "547636"
  }
}
```

What the backend does, in order: refuse a duplicate username, write the record,
generate a six-digit password with the CSPRNG, store **only its scrypt hash**,
set `mustChangePassword` and a `ADMIN_TEMP_PASSWORD_TTL_HOURS` expiry, then text
the username and the password to `mobile`.

`smsDelivered` is whether the gateway accepted the message. **A failed SMS does
not fail the request**: the account exists, and the answer to a message that
never arrived is a reset, not a half-created account. The panel says so.

`temporaryPassword` is present **only** when `SHOW_DEV_CREDENTIALS=true` and
`NODE_ENV` is not `production`. Production cannot enable it. It exists because
no SMS gateway is contracted yet — see
[../architecture/auth-sms-integration.md](../architecture/auth-sms-integration.md).

| Failure | Status | Code |
| --- | --- | --- |
| Any field invalid | 400 | `VALIDATION_ERROR` |
| Username taken | 409 | `CONFLICT` |

---

## PATCH /admin/users/:id

Edits an account. Every field is optional; an empty body is refused rather than
treated as a no-op.

```json
{ "roleCode": "user_manager", "accessExpiresAt": "2027-06-21", "status": "SUSPENDED" }
```

| Field | Rule |
| --- | --- |
| `firstName`, `lastName` | 2–50 characters |
| `mobile` | A valid Iranian mobile number |
| `roleCode` | One of the catalogue's codes |
| `accessExpiresAt` | ISO `YYYY-MM-DD`, not in the past |
| `status` | `ACTIVE` or `SUSPENDED` |

**200** — `{ "user": AdminUser }`.

`username` is deliberately **not** editable: it is what credentials were sent
against and what the account is known by. A password is not editable here
either — the only thing another admin can do to a password is replace it, below.

| Failure | Status | Code |
| --- | --- | --- |
| Nothing to change, or a field invalid | 400 | `VALIDATION_ERROR` |
| No such account | 404 | `NOT_FOUND` |

Suspending an account or moving its expiry into the past takes effect on that
account's **next request**, not at some later sweep: the guard reads the record
every time.

---

## POST /admin/users/:id/reset-password

Replaces the account's password with a new temporary one and texts it.

This is also what «ارسال مجدد اطلاعات ورود» does, because there is nothing else
it could do: the backend keeps only a hash, so an existing password cannot be
read back and re-sent. It can only be replaced.

**200** — the same body as `POST /admin/users`:

```json
{
  "ok": true,
  "data": {
    "user": { "…": "AdminUser, with mustChangePassword: true" },
    "smsDelivered": true,
    "temporaryPassword": "483921"
  }
}
```

In order: generate a six-digit password, store its hash, set
`mustChangePassword`, set a fresh expiry, bump the account's credentials version
— which signs every session it had out — and text the new credentials.

Afterwards: the previous password does not work, whether it was temporary or
chosen; the account's sessions are gone; and its next sign-in lands on the
change-password screen.

| Failure | Status | Code |
| --- | --- | --- |
| No such account | 404 | `NOT_FOUND` |

---

## Roles

There is no `GET /admin/roles`. The catalogue lives in
`@hamdastan/shared/rbac` and both sides read it, so the roles the panel offers
are by construction the roles this API accepts, and adding one needs no
endpoint. It moves into a table when a data layer arrives — the design is in
[../architecture/admin-data-model.md](../architecture/admin-data-model.md).
