# Authentication data model

**Nothing here is implemented in a database.** No database, ORM or persistence
technology has been chosen for this project, and none has been added. This is
the design the eventual data layer has to satisfy, and the contract the
in-memory stand-in in
`apps/api/src/modules/auth/auth.repository.ts` already implements.

The port a data layer plugs into is `AuthRepository` in that file. Nothing
below is a migration — see [the rule on database changes](#applying-this-later).

---

## 1. Entities

Three, and the relationships between them are simple: a user has many
sessions, and a phone number has at most one live verification challenge.

```
+--------------------------+            +--------------------------+
|  User                    |            |  VerificationChallenge   |
|--------------------------|            |--------------------------|
| id            PK         |            | id            PK         |
| phone         UNIQUE     |<- phone ---| phone         UNIQUE     |
| first_name               |  (by value,| purpose                  |
| last_name                |   not a FK)| code_hash                |
| birth_date               |            | registration  nullable   |
| gender                   |            | issued_at                |
| role                     |            | expires_at               |
| status                   |            | resend_available_at      |
| phone_verified_at        |            | attempts                 |
| created_at               |            | send_count               |
| updated_at               |            | window_started_at        |
+--------------------------+            | verified_at   nullable   |
            |                           +--------------------------+
            | 1:N
+--------------------------+
|  Session                 |
|--------------------------|
| token_hash    PK         |
| user_id       FK → User  |
| created_at               |
| expires_at               |
+--------------------------+
```

A challenge references a phone number **by value, not by foreign key**: a code
is issued for a number before any user exists for it. That is the whole reason
registration can require a verified phone.

---

## 2. User

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | Primary key. |
| `phone` | string(11) | yes | **Unique.** Normalised to `09xxxxxxxxx` before it is ever stored or looked up. |
| `first_name` | string(50) | yes | 2–50 characters. |
| `last_name` | string(50) | yes | 2–50 characters. |
| `birth_date` | date | yes | Calendar date, no time, no zone. Stored as ISO `YYYY-MM-DD` — Gregorian, whatever the UI shows. The user picks it in the Jalali calendar and `packages/shared/format/jalali.ts` converts; storing a non-ISO calendar would put the conversion into every future query. |
| `gender` | enum | yes | `MALE` \| `FEMALE`. |
| `role` | enum | yes | `USER` \| `ADMIN`. Defaults to `USER`; nothing in the sign-up flow can set `ADMIN`. |
| `status` | enum | yes | `ACTIVE` \| `SUSPENDED`. A suspended user cannot receive a code or hold a session. |
| `phone_verified_at` | timestamp | yes | Not nullable **on purpose** — a row only comes into existence through a verified code, so there is no state in which it would be null. |
| `created_at` / `updated_at` | timestamp | yes | |

### Constraints and indexes

| | |
| --- | --- |
| `UNIQUE (phone)` | The identity of a user. Normalisation is what makes it meaningful: without it `+989…` and `09…` would be two accounts. |
| `INDEX (phone)` | Covered by the unique constraint. Every sign-in starts with this lookup. |
| `INDEX (status)` | Only if an admin screen needs to list by it. Not needed by this flow. |

### Lifecycle

```
(nothing)  ──register──→  a draft on a challenge  ──verify──→  ACTIVE
                                    │                            │
                              expires, leaves               SUSPENDED
                              nothing behind              (set by an admin)
```

There is no `PENDING` user state, and deliberately so. A pending user row is a
row that has to be cleaned up, cannot be told apart from a real one by a
careless query, and blocks the phone number in the unique index while it
exists. Holding the draft on the challenge avoids all three.

---

## 3. VerificationChallenge

One live challenge per phone number. Issuing a code replaces the row, which is
what invalidates the previous code.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | Primary key. |
| `phone` | string(11) | yes | **Unique** — the one-live-challenge rule, as a constraint rather than as code. |
| `purpose` | enum | yes | `LOGIN` \| `REGISTER`. Decided by the backend from the state of the number. |
| `code_hash` | string(64) | yes | SHA-256 of `phone:code`. **Never the code itself**, in any environment — the development echo is attached to the response that issues a code, never to this row. Binding the hash to the number stops it being replayed against another. |
| `registration` | json | no | The draft profile: first name, last name, birth date, gender. Present only when `purpose = REGISTER`. |
| `issued_at` | timestamp | yes | |
| `expires_at` | timestamp | yes | `issued_at + OTP_TTL_SECONDS` (120s). |
| `resend_available_at` | timestamp | yes | Equal to `expires_at`: resend opens when the countdown the user is watching runs out. |
| `attempts` | int | yes | Wrong guesses against the current code. Reset to 0 by a new code. Locked at `OTP_MAX_ATTEMPTS`. Incremented through `recordFailedAttempt` — see below. |
| `send_count` | int | yes | Codes issued in the current window. |
| `window_started_at` | timestamp | yes | Start of the rate-limit window, `OTP_SEND_WINDOW_MINUTES` long. Carried forward across resends so the limit cannot be reset by waiting out a single code. |
| `verified_at` | timestamp | no | See below. |

### Constraints and indexes

| | |
| --- | --- |
| `UNIQUE (phone)` | At most one live challenge per number. |
| `INDEX (expires_at)` | For the sweep that deletes dead rows. A TTL index where the store has one. |

### Single use, and `verified_at`

The in-memory implementation **deletes** the row on a successful verification,
before the session is created, so the code cannot be replayed even if something
later fails.

A real data layer may prefer to set `verified_at` and keep the row for audit.
If it does, two things become mandatory:

- `verifyOtp` must reject any challenge with a non-null `verified_at`, or a
  used code becomes a valid one;
- the `UNIQUE (phone)` constraint has to move to a partial index over unverified
  rows (`WHERE verified_at IS NULL`), or the next code for that number cannot be
  stored.

Deleting is the simpler of the two and is what the current design assumes.

### Increment the counter, do not rewrite the row

`AuthRepository.recordFailedAttempt(phone)` exists separately from
`saveChallenge` so that counting a wrong guess is one statement
(`UPDATE … SET attempts = attempts + 1 … RETURNING attempts`) rather than a
read-modify-write. Two devices guessing at once cannot lose a count that way. A
`Map` cannot lose the race, so the stand-in simply increments — but the port has
to allow the atomic form, or the data layer has no way to be correct.

### The send counters have the wrong lifetime

`send_count` and `window_started_at` describe a *phone number's* behaviour, but
they live on a row whose lifetime is one *code* — deleted on a successful
verification and on a cancel. If the send limit is to be an abuse control rather
than a courtesy, these two fields belong in their own row (keyed by phone, with
its own retention) or behind a throttle at the edge. Worth settling before the
schema is written, since it changes where they live.

### Retention

Expired and verified challenges carry a code hash, a phone number and possibly
a name and date of birth. They should be swept on a schedule rather than kept —
a day is generous. The rate-limit counters are the only reason to keep a row
past `expires_at`, and only for `OTP_SEND_WINDOW_MINUTES`.

---

## 4. Session

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token_hash` | string(64) | yes | Primary key. See below. |
| `user_id` | uuid | yes | `FK → User(id)`, `ON DELETE CASCADE` — deleting a user must end their sessions. |
| `created_at` | timestamp | yes | |
| `expires_at` | timestamp | yes | `created_at + SESSION_MAX_AGE_DAYS`. |

### Constraints and indexes

| | |
| --- | --- |
| `PRIMARY KEY (token_hash)` | Every authenticated request is this lookup. |
| `INDEX (user_id)` | To end every session a user has — after a suspension, or a "sign out everywhere". |
| `INDEX (expires_at)` | For the sweep. A TTL index where the store has one. |

### Store a hash, not the token

The in-memory implementation stores the token as it was issued, because the map
lives and dies with the process. **A persistent store must keep only a hash of
it** (SHA-256 is enough — the token is 256 random bits, so it needs no salt or
stretching). A leaked session table would otherwise be a set of working
sessions.

This is a change of one line in each direction inside the repository
implementation: hash on write, hash the incoming cookie before the lookup. No
service changes.

---

## 5. What is not modelled yet

- **Anything beyond authentication.** Progress, worlds, missions and the rest
  have their own repository ports and their own designs to write.
- **Trusted devices / "remember this device".** The flow does not have the
  concept, so there is no entity for it.
- **Login audit.** Neither a successful nor a failed sign-in is recorded
  anywhere but the log. If that is a requirement, it is a fourth entity and
  should be designed as one rather than bolted onto `Session`.

---

## Applying this later

Per `RULES.md`, no schema may be created or changed without being handed over
first. When a database is chosen:

1. write the migration from this document;
2. hand it over for review and execution — it is not run from here;
3. implement `AuthRepository` against it, hashing session tokens and honouring
   the constraints above;
4. bind it in `apps/api/src/server.ts` and delete
   `createInMemoryAuthRepository`.

Nothing in `auth.service.ts`, `auth.controller.ts` or `auth.routes.ts` should
need to change. See `database/README.md`.
