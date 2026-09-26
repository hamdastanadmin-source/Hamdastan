# Admin data model

**Nothing here is implemented in a database.** No database, ORM or persistence
technology has been chosen for this project, and none has been added. This is
the design the eventual data layer has to satisfy, and the contract the
in-memory stand-ins in `apps/api/src/modules/admin-users/admin-users.repository.ts`
and `apps/api/src/modules/admin-auth/admin-auth.repository.ts` already
implement.

The ports a data layer plugs into are `AdminUsersRepository` and
`AdminAuthRepository` in those files. Nothing below is a migration — see
[the rule on database changes](#applying-this-later).

The product's own users are a separate design in
[auth-data-model.md](./auth-data-model.md). An admin is not a `User` with a
role: the two are authenticated differently, stored separately and cannot sign
in to each other's surface.

---

## 1. Entities

Two rows and a catalogue.

```
+------------------------------+          +--------------------------+
|  AdminUser                   |          |  AdminRole               |
|------------------------------|          |--------------------------|
| id                  PK       |          | id            PK         |
| first_name                   |          | code          UNIQUE     |
| last_name                    |          | name                     |
| username                     |─ code ──>| permissions   json       |
| username_key        UNIQUE   | (by value| created_at               |
| password_hash                |  not a FK| updated_at               |
| must_change_password         |  today)  +--------------------------+
| temporary_password_expires_at|
| status                       |
| role_code                    |
| access_expires_at            |
| last_login_at                |
| password_changed_at          |
| credentials_version          |
| failed_login_attempts        |
| locked_until                 |
| created_at                   |
| updated_at                   |
+------------------------------+
            |
            | 1:N
+------------------------------+
|  AdminSession                |
|------------------------------|
| token_hash          PK       |
| admin_user_id       FK       |
| credentials_version          |
| created_at                   |
| expires_at                   |
+------------------------------+
```

**Two ports, one table.** `admin-users` manages accounts and `admin-auth`
authenticates them; each declares the data it needs rather than mirroring a
table, which is why `AdminUser` appears in both. A data layer implements both
against the same rows. The development stand-ins do the same thing: the accounts
live in one `Map`, owned by `admin-users`, and `admin-auth` is handed it.

---

## 2. AdminUser

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | Primary key. |
| `first_name` | string(50) | yes | 2–50 characters. |
| `last_name` | string(50) | yes | 2–50 characters. |
| `username` | string(32) | yes | As the creating admin typed it. Shown in the panel. |
| `username_key` | string(32) | yes | **Unique.** `lower(username)`. Every lookup goes through this, so `Admin` and `admin` cannot become two accounts. A generated/stored column, or an index on `lower(username)`, is equivalent — what matters is that the uniqueness is case-insensitive and enforced by the database rather than by a service. |
| `password_hash` | string | yes | `shared/password.ts`'s output: `scrypt$N$r$p$salt$key`, all base64url. **Never a plain password, in any environment.** Self-describing so the parameters can be raised without invalidating existing hashes. |
| `must_change_password` | bool | yes | True while the account is on a password it did not choose. The one flag that gates the whole panel. |
| `temporary_password_expires_at` | timestamp | no | When a generated password stops working; null once the admin has chosen their own. An expired temporary password needs a reset — it is never re-sent. |
| `status` | enum | yes | `ACTIVE` \| `SUSPENDED`. A suspended account cannot sign in or hold a session. |
| `role_code` | string(32) | yes | References `AdminRole.code`. See [§4](#4-roles-and-permissions). |
| `access_expires_at` | date | yes | Calendar date, no time, no zone, ISO `YYYY-MM-DD`. Access lasts to the **end** of that day, evaluated in `Asia/Tehran`. The UI collects it in the Jalali calendar and `packages/shared/format/jalali.ts` converts; storing a non-ISO calendar would put the conversion into every future query. |
| `last_login_at` | timestamp | no | Null until the first sign-in. |
| `password_changed_at` | timestamp | no | Last time the admin chose a password. Null while they are still on one somebody else generated, which is what makes it an honest answer to "has this account ever been secured?". |
| `credentials_version` | int | yes | Starts at 1, incremented on **every** password write. See [§3](#3-adminsession). |
| `failed_login_attempts` | int | yes | Consecutive wrong passwords. Cleared by a successful sign-in and by any password write. |
| `locked_until` | timestamp | no | Set when the attempts run out. Sign-in is refused until it passes, with the right password too. |
| `created_at` / `updated_at` | timestamp | yes | |

### Constraints and indexes

| | |
| --- | --- |
| `UNIQUE (username_key)` | The identity of an admin. The reason it is a separate column rather than a rule in a service: a race between two creations has to be settled by the database. |
| `INDEX (username_key)` | Covered by the unique constraint. Every sign-in starts with this lookup. |
| `INDEX (status)`, `INDEX (access_expires_at)` | Only if the panel grows a filter for them. The list is small and searched across several fields, so today neither earns its keep. |

### What is deliberately absent

- **No plain password, and no recoverable one.** There is no column a password
  could be read out of, which is what makes "the old password is never
  re-sent" a property of the schema rather than a promise in a service.
- **No `email`.** Credentials go by SMS, and an unused contact column is a
  field that drifts out of date.
- **No editable `username`.** It is what credentials were sent against; the
  schema allows an update, and `updateAdminUserSchema` does not offer one.

### Lifecycle

```
created by another admin ──→ ACTIVE, must_change_password = true
                                        │
                              first sign-in + change
                                        │
                                ACTIVE, must_change_password = false
                                   │              │            │
                          reset by an admin   SUSPENDED   access_expires_at
                                   │          (an edit)      passes
                          back to must_change_password
```

Nothing is ever deleted by the panel. An admin who should no longer have access
is suspended or allowed to expire, which keeps `created_at`, `last_login_at` and
the account's history intact — and is what an audit trail will want when there
is one.

---

## 3. AdminSession

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token_hash` | string(64) | yes | Primary key. SHA-256 of the token. **Never the token** — see below. |
| `admin_user_id` | uuid | yes | `FK → AdminUser(id)`, `ON DELETE CASCADE`. |
| `credentials_version` | int | yes | The account's `credentials_version` when the session was issued. |
| `created_at` | timestamp | yes | |
| `expires_at` | timestamp | yes | `created_at + ADMIN_SESSION_MAX_AGE_HOURS` (12h). |

### Constraints and indexes

| | |
| --- | --- |
| `PRIMARY KEY (token_hash)` | Every authenticated request is this lookup. |
| `INDEX (admin_user_id)` | To end every session an account has, and to answer "who is signed in". |
| `INDEX (expires_at)` | For the sweep. A TTL index where the store has one. |

### Store a hash, not the token

The token is 256 random bits, so SHA-256 with no salt and no stretching is
enough — there is nothing to brute-force. **The stand-in already hashes it**, so
unlike the product's session store there is no "and the real one must remember
to": the contract is hashed on both sides.

### Invalidation is a counter, not a timestamp

A session is refused when its `credentials_version` no longer matches the
account's. Every password write — a reset by another admin, or the admin
choosing their own — increments the account's version, so:

- resetting a temporary password signs that account out of every device, with
  no session rows to find and delete;
- an admin changing their own password is handed a session stamped with the new
  version in the same response, so they stay signed in and nobody else does.

It is a counter rather than a "sessions issued before this time are invalid"
timestamp because two writes inside one millisecond are indistinguishable by
clock, and a session issued a moment before a reset is exactly the one that must
not survive.

The increment has to be atomic — `UPDATE … SET credentials_version =
credentials_version + 1 … RETURNING *` — which is why `setPassword` /
`setUserPassword` own it rather than accepting a value a caller read first.

---

## 4. Roles and permissions

### Today: a catalogue in code

`packages/shared/rbac/admin-rbac.ts` holds the roles, and both `apps/api` and
`apps/admin` read it. There is no table and no endpoint, because there is no
database — and because a role catalogue that both sides read from one file
cannot drift the way two copies would.

| Role | `code` | Permissions |
| --- | --- | --- |
| مدیر ارشد | `super_admin` | all |
| مدیر کاربران | `user_manager` | `dashboard.view`, `users.view`, `users.create`, `users.edit`, `users.reset_password` |
| پشتیبان | `support` | `dashboard.view` |

Permissions are strings of the form `<area>.<action>`:

```
dashboard.view
users.view
users.create
users.edit
users.reset_password
```

Nothing is inferred from a name. `users.edit` grants what the route guarded by
`users.edit` does, and adding a permission means adding it to `AdminPermission`
and putting it on a route.

### Later: the table

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | Primary key. |
| `code` | string(32) | yes | **Unique.** What `AdminUser.role_code` references. Stable — it is what the code and the rows agree on, so it must not be renamed. |
| `name` | string(64) | yes | Persian, shown in the UI. |
| `permissions` | json (string[]) | yes | A list of permission strings. A join table (`admin_role_permissions`) is the alternative; it buys referential integrity over a set that is enumerated in TypeScript anyway, and costs a join on every request. Start with the array. |
| `created_at` / `updated_at` | timestamp | yes | |

Seeding it from the catalogue is what makes the move a no-op for stored data:
an account references a role by `code`, so no `AdminUser` row changes. Two
things have to happen together with it:

- `adminRolePermissions()` becomes a repository call (with a cache — it is read
  on every request);
- `AdminRoleCode` stops being a union of literals, or adding a row means
  editing TypeScript. `adminRolePermissions` already fails closed for a code it
  has never heard of, which is the behaviour a database-driven catalogue needs.

Until then, `FOREIGN KEY (role_code) REFERENCES admin_role(code)` is the
constraint to add when the table arrives.

---

## 5. Temporary password metadata

No entity of its own, and deliberately. Everything a temporary password needs is
three fields on the account:

| | |
| --- | --- |
| `password_hash` | the password itself, hashed, replaced by the next one |
| `must_change_password` | it has to be replaced before anything else works |
| `temporary_password_expires_at` | after this, it is dead and needs a reset |

A separate `temporary_password` row would be a second place a credential lives,
a second thing to expire and a second thing to forget to delete — for a value
that is, by design, only ever one per account. The one thing the current design
does **not** record is *who* issued it and *when*, which belongs in an audit
trail rather than here ([§6](#6-what-is-not-modelled-yet)).

---

## 6. What is not modelled yet

- **An audit trail.** Who created, edited, suspended or reset whom is not
  recorded anywhere but the log. It is a fourth entity —
  `admin_audit_log(id, actor_admin_id, action, target_admin_id, metadata,
  created_at)` — and should be designed as one rather than bolted onto
  `AdminUser`. The guard already resolves the acting admin onto the request, so
  the data is at hand.
- **Login history.** Only `last_login_at` survives; failed attempts are a
  counter, not a record. Same answer as above if it becomes a requirement.
- **Password history.** Nothing stops an admin from reusing the password they
  just replaced. Enforcing otherwise means storing previous hashes, which is a
  real decision with a real retention cost — not something to add by accident.
- **Sessions per device.** A session has no user agent, IP or label, so "sign
  out of my other devices" can only be all-or-nothing (which is what a password
  write already does).

---

## Applying this later

Per `RULES.md`, no schema may be created or changed without being handed over
first. When a database is chosen:

1. write the migration from this document;
2. hand it over for review and execution — it is not run from here;
3. implement `AdminUsersRepository` and `AdminAuthRepository` against it,
   keeping session tokens hashed, incrementing `credentials_version` inside the
   password write, and letting the database enforce the username uniqueness;
4. bind both in `apps/api/src/server.ts`, delete
   `createInMemoryAdminUsersRepository`, `createInMemoryAdminAuthRepository`,
   `createInMemoryAdminUserStore` and `seedDevelopmentAdmin` with the block in
   `app.ts` that calls them;
5. create the first admin account as part of provisioning — with no seed in
   production, nothing else can.

Nothing in the services, controllers or routes should need to change. See
`database/README.md`.
