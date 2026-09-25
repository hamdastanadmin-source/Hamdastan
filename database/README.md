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

`auth` is the one module whose storage has been designed, because the product
cannot be used without it. Entities, fields, constraints, indexes and lifecycles
are in `docs/architecture/auth-data-model.md`, and
`apps/api/src/modules/auth/auth.repository.ts` holds an in-memory implementation
of that contract — bound in `app.ts`, lost on every restart, and deleted the
moment a real one exists.

Two things in that document are requirements rather than suggestions: session
tokens are stored **hashed**, and one-time codes are stored **only** as a hash.

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
   For `auth`, this replaces the `setAuthRepository(createInMemoryAuthRepository())`
   call in `app.ts` — delete the stand-in with it.
4. Put the connection string in `DATABASE_URL` and parse it in
   `apps/api/src/config/env.ts` so a missing value fails at boot.

No service, controller or route should need to change.
