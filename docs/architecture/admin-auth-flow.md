# Admin authentication flow

How somebody gets into `apps/admin`, and everything that can stop them.

The product's own sign-in is passwordless — a mobile number and a one-time code
— and is described in [auth-flow.md](./auth-flow.md). **The admin panel is not
that flow.** It is a username and a password, there is no self-registration, and
the two share nothing but the response envelope and the phone-number
normalisation. Different module, different cookie, different user store.

---

## 1. The shape of it

```
                    apps/admin                         apps/api
                    ──────────                         ────────
/login              username + password ──────────────→ POST /admin/auth/login
                                                          │
                                        ┌─────────────────┴─────────────────┐
                                        │ 1. find the account (by lowercased │
                                        │    username)                       │
                                        │ 2. is it locked out?               │
                                        │ 3. verify the password against the  │
                                        │    scrypt hash                      │
                                        │ 4. is it active?                    │
                                        │ 5. has accessExpiresAt passed?      │
                                        │ 6. has the temporary password       │
                                        │    expired?                         │
                                        └─────────────────┬─────────────────┘
                                                          │
                          admin_session cookie ←──────────┘
                                   │
                   mustChangePassword?
                     │                    │
                   true                 false
                     │                    │
          /change-password            /  (dashboard)
                     │
      new password + confirmation ────────→ POST /admin/auth/change-password
                                                          │
                                        ┌─────────────────┴─────────────────┐
                                        │ policy check → hash → store       │
                                        │ mustChangePassword = false        │
                                        │ credentials version++             │
                                        │ issue a fresh session             │
                                        └─────────────────┬─────────────────┘
                                                          │
                     new admin_session cookie ←───────────┘
                                   │
                              /  (dashboard)
```

Every box on the right is in `apps/api/src/modules/admin-auth/admin-auth.service.ts`.
Nothing on the left decides anything.

---

## 2. Where each decision lives

| Decision | Where |
| --- | --- |
| Is this the right password? | `admin-auth.service.ts` → `shared/password.ts` |
| Is the account active, in date, past the forced change? | `admin-auth.service.ts` |
| Does this role carry this permission? | `admin-auth.service.ts` → `@hamdastan/shared/rbac` |
| Is this session still good? | `admin-auth.service.ts` |
| What does a strong password mean? | `packages/validation/admin.ts` |
| Which screen does the admin see? | `apps/admin/src/features/auth` |

The last row is the only one in the front-end, and it is a redirect rather than
a permission: `requireAdmin()` sends an admin with no session to `/login` and an
admin who owes a password change to `/change-password`, and every page it
guards then gets its data from a backend route that checks the same things
again.

---

## 3. The forced password change

An account created by another admin starts on a password it did not choose, so
`mustChangePassword` is true and stays true until it chooses one.

While it is set:

- `GET /admin/auth/session` answers, so the panel knows where to send them
- `POST /admin/auth/change-password` works
- `POST /admin/auth/logout` works
- **everything else answers `403 ADMIN_PASSWORD_CHANGE_REQUIRED`**

`middleware/admin-guard.ts` is what refuses the rest, and it does so before it
looks at permissions — an account that owes a change cannot reach anything by
having a generous role.

Both screens are plain: no logo, no product name, start-aligned headings. The
panel is an internal tool, and a brand lockup on a sign-in form is decoration
that has to be maintained.

The front-end mirrors the rule: `/change-password` sits outside the dashboard
layout, because showing that admin a shell whose every link leads to a 403 would
be worse than showing them one screen. `requirePasswordChange()` sends an admin who
owes nothing back to the dashboard, so the screen cannot be used to change a
password on a whim.

### The policy

Five rules, in `packages/validation/admin.ts`, read by the form's checklist and
by the backend:

| | |
| --- | --- |
| Length | at least 8 characters |
| Uppercase | at least one `A–Z` |
| Lowercase | at least one `a–z` |
| Digit | at least one `0–9` |
| Special | at least one character that is none of the above |

Stated once, so the ticks an admin watches cannot disagree with the answer they
get. The front-end check saves a round trip; the backend is the authority.

The **login** form deliberately does not apply the policy: a generated
temporary password does not satisfy it, and rejecting it at the door would lock
every new admin out before they could reach this screen.

---

## 4. The temporary password

```
create account ──→ generate 6 digits (CSPRNG) ──→ store only the scrypt hash
                                │
                                └──→ SMS: username + password
                                              │
                          first sign-in ───────┘
                                │
                       forced change ──→ chosen password, hashed
                                          mustChangePassword = false
                                          temporary expiry cleared
```

| Property | How |
| --- | --- |
| Generated by the backend | `generateNumericPassword` in `shared/password.ts`, `randomInt`, never `Math.random` |
| Six digits | `TEMPORARY_PASSWORD_LENGTH` in `packages/validation/admin.ts` |
| Never stored in plain | only `hashPassword`'s output is written, in production and in development alike |
| Single-purpose | usable once, to reach the change-password screen |
| Expires | `ADMIN_TEMP_PASSWORD_TTL_HOURS`, default 48; after that, `403 ADMIN_TEMPORARY_PASSWORD_EXPIRED` and the account needs a reset |
| Dead after the change | the hash is replaced, so the old password matches nothing |
| Not recoverable | there is no endpoint that reads a password back |

**There is no "send it again".** Since only a hash is stored, re-sending an
existing password is impossible by construction, so the operation offered is
*replace*: `POST /admin/users/:id/reset-password` generates a new password,
invalidates the old one, forces another change, signs the account's sessions
out and texts the new credentials. «ارسال مجدد اطلاعات ورود» in the panel is
that same call, because it is the only honest version of it.

---

## 5. Access expiration

Every admin account has `accessExpiresAt`, an ISO calendar date. Access lasts to
the **end** of that day, evaluated in `Asia/Tehran` (`shared/dates.ts`) — in UTC
the date turns over three and a half hours early, which would cut an account's
last day short.

It is checked at sign-in **and on every authenticated request**, so moving a
date into the past takes effect on that account's next request rather than at
its next sign-in. The same is true of suspending an account.

The panel shows the state — a badge on the row — and computes none of it:
`accessExpired` comes from the backend, because the browser's clock is not the
clock that grants access.

---

## 6. Sessions

| | |
| --- | --- |
| Cookie | `admin_session`, `httpOnly`, `SameSite=Lax`, `Secure` in production |
| Lifetime | `ADMIN_SESSION_MAX_AGE_HOURS`, default 12 |
| Token | 256 bits from `randomBytes`, **stored hashed** (SHA-256) |
| Separate from the product's | a different cookie name, so one browser can hold both and signing out of one leaves the other alone |

A session stops resolving when it expires, when it is deleted by a sign-out, or
when the account's password is written by anybody. The last one is a counter:
each account carries `credentialsVersion`, a session carries the version it was
issued under, and a mismatch is refused. That is how a reset signs every device
out without sweeping a session table — and it is a counter rather than a
timestamp because two writes inside one millisecond are indistinguishable by
clock, and "the session issued a moment before the reset" is exactly the case
that must not survive.

Changing your own password therefore rotates your session: the write
invalidates what you were holding, and the response hands you a replacement, so
you stay signed in and every other device does not.

---

## 7. Login attempt limiting

`ADMIN_LOGIN_MAX_ATTEMPTS` consecutive wrong passwords (default 5) lock the
account for `ADMIN_LOGIN_LOCK_MINUTES` (default 15). While the lock holds, even
the right password is refused, with `429 ADMIN_TOO_MANY_ATTEMPTS` and
`details.retryAfterSeconds`.

A successful sign-in clears the count, and so does any password write.

The counter is per account, which is what protects an account from being guessed
at. It is not a per-IP limit and does not protect the endpoint from being
hammered across many usernames — see *What is left for production* below.

---

## 8. Roles and permissions

A role is a code on the account (`roleCode`); the permissions it carries come
from the catalogue in `packages/shared/rbac/admin-rbac.ts`, which both sides
read.

| Role | Code | Permissions |
| --- | --- | --- |
| مدیر ارشد | `super_admin` | all of them |
| مدیر کاربران | `user_manager` | `dashboard.view`, `users.view`, `users.create`, `users.edit`, `users.reset_password` |
| پشتیبان | `support` | `dashboard.view` |

Both halves exist on purpose:

- **Front-end.** The sidebar leaves out an item whose permission the admin
  lacks, and the actions menu leaves out an action. This is a convenience.
- **Backend.** Every route names the permission it needs and the guard checks
  it. This is the boundary.

A hidden menu is not security and is never treated as one: `support` signing in
sees no users menu *and* gets `403 ADMIN_FORBIDDEN` from `/admin/users` if the
request is made anyway.

Adding a role is two lines in the catalogue plus its code in `AdminRoleCode`.
Adding a permission is one line in `AdminPermission` and one guard on the route
it protects — nothing is inferred from a name.

---

## 9. Where the code lives

```
apps/api/src/
├── modules/admin-auth/           sessions, passwords, every access decision
├── modules/admin-users/          the account record, and managing accounts
├── middleware/admin-guard.ts     the guard every other admin route opts into
├── shared/password.ts            scrypt hash / verify, password generation
├── shared/dates.ts               today, in Asia/Tehran
└── integrations/sms/             the one gateway adapter

apps/admin/src/
├── app/login, app/change-password          entry points, outside the shell
├── app/(dashboard)/                        everything behind a session
├── components/layout/                      AdminShell, AdminSidebar, AdminHeader
├── features/auth/                          the two forms, the session lookup
└── features/users/                         «مدیریت کاربران»

packages/
├── types/admin.ts                the wire contract
├── validation/admin.ts           the rules both sides apply
└── shared/rbac/admin-rbac.ts     the role catalogue
```

The endpoint reference is in [../api/admin-auth.md](../api/admin-auth.md) and
[../api/admin-users.md](../api/admin-users.md); the future schema is in
[admin-data-model.md](./admin-data-model.md).

---

## 10. Development credentials

`apps/api` seeds one admin outside production, because admins cannot register
themselves and the store starts empty:

| | |
| --- | --- |
| Username | `Admin` |
| Password | `Admin1234` |
| Role | `super_admin` |
| `mustChangePassword` | `true` |

Seeded in `app.ts` under `!env.isProduction`. It starts owing a password change
so the flow above is what a first sign-in walks, and it has no temporary-password
expiry — a fixed credential in a developer's notes going stale overnight would
only waste their time.

Nothing persists: accounts, passwords and sessions live in a `Map` and are lost
on restart. In production the slot stays unbound and the admin routes answer
`501 DATA_LAYER_NOT_CONFIGURED` rather than quietly serving a per-instance user
store.

`npm run dev` starts `apps/web` and `apps/api`; the panel is
`npm run dev:admin` alongside `npm run dev:api`, and it is useless without the
backend, because the backend is what has the accounts.

---

## 11. What is left for production

- **A data layer.** Everything above runs on `Map`s. The schema to implement is
  in [admin-data-model.md](./admin-data-model.md).
- **The first admin.** With no seed in production, whatever provisions the
  database has to create it.
- **An SMS gateway.** Credentials are logged, not sent. See
  [auth-sms-integration.md](./auth-sms-integration.md).
- **A rate limit on the endpoint itself.** The per-account lockout does not
  bound an attacker spreading attempts across usernames, and nothing here
  limits requests per IP.
- **An audit trail.** Who created, edited or reset whom is not recorded. The
  guard already resolves the acting admin onto the request, so the data is at
  hand the moment there is somewhere to put it.
