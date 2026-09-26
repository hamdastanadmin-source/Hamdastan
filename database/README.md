# database

Foundation only. **No database, ORM or data-persistence technology has been
chosen for this project yet**, and nothing in this repository depends on one.

## Why it is empty

The architecture is built so the choice can be made later without rewriting
business logic. Every backend module declares what it needs from storage as an
interface — its *repository port* — in
`apps/api/src/modules/<module>/<module>.repository.ts`:

```
routes → controller → service → repository → (data layer goes here)
```

A service calls `usersRepository().findById(id)` and knows nothing else. Until
a data layer is bound, that call throws `DataLayerNotConfiguredError` (HTTP
501) rather than returning fake data, so an unimplemented endpoint cannot be
mistaken for a working one. See `apps/api/src/shared/repository.ts`.

## What is already designed

Three modules have their storage designed, because neither the product nor the
admin panel can be used without them:

| Module | Design | Stand-in |
| --- | --- | --- |
| `auth` | `docs/architecture/auth-data-model.md` | `auth.repository.ts` |
| `admin-users` | `docs/architecture/admin-data-model.md` | `admin-users.repository.ts` |
| `admin-auth` | `docs/architecture/admin-data-model.md` | `admin-auth.repository.ts` |
| `forms` | `docs/architecture/forms-data-model.md` | `forms.repository.ts` |

Each stand-in is bound in `app.ts` under `!env.isProduction`, lost on every
restart, and deleted the moment a real implementation exists. The two admin
ports describe **one** table between them — `admin-users` manages accounts,
`admin-auth` authenticates them — so both stand-ins are built over one store.

`forms` is the one whose design is not simply a set of columns: a form's pages,
questions, logic, audience and settings are JSON on the form row, because they
are always read and written together. The reasoning is in that document, and so
is the partial unique index that enforces «یک پاسخ برای هر کاربر».

Five things in those documents are requirements rather than suggestions:
session tokens are stored **hashed**; one-time codes are stored **only** as a
hash; admin passwords are stored **only** as a scrypt hash, with no column a
plain password could occupy; an admin's `credentials_version` is incremented
inside the password write, atomically, because it is what ends that account's
sessions; and a form's responses are removed with it, by cascade.

## What goes here when a choice is made

| Directory     | Contents                                          |
| ------------- | ------------------------------------------------- |
| `schema/`     | The schema definition, in whatever form the chosen tool takes |
| `migrations/` | Ordered, reviewed migration files                 |
| `seeds/`      | Seed data for local development and tests         |

## Wiring it up

1. Add the client/ORM as a dependency of `apps/api` only. Nothing else in the
   monorepo may import it — that is what keeps the front-end unable to reach
   the data layer.
2. Write one adapter per module that satisfies its `<Module>Repository`
   interface.
3. Bind them in `apps/api/src/server.ts`, before `listen`:
   ```ts
   setUsersRepository(new SqlUsersRepository(db));
   ```
   For `auth` and the two admin modules, this replaces the `set…Repository(…)`
   calls in `app.ts` — delete the stand-ins, the shared admin store and
   `seedDevelopmentAdmin` with them. Nothing seeds an admin in production, so
   creating the first admin account becomes part of provisioning.
4. Put the connection string in `DATABASE_URL` and parse it in
   `apps/api/src/config/env.ts` so a missing value fails at boot.

No service, controller or route should need to change.
