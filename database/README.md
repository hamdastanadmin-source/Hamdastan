# database

The schema, as reviewed files. **PostgreSQL**, reached from `apps/api` through
the `pg` driver.

## Layout

| Directory     | Contents                                              |
| ------------- | ----------------------------------------------------- |
| `migrations/` | Ordered migration files. This *is* the schema.        |
| `schema/`     | A dump of the live schema, when one is useful to read |
| `seeds/`      | Seed data for local development and tests             |

There is no separate schema file to keep in step with the migrations: applying
`migrations/` in order is the definition of what the database looks like.

## Applying them

```sh
npm run db:migrate
```

Reads `DATABASE_URL` from the root `.env`, applies anything not yet applied,
and records it in `v2_migrations`. Running it again is a no-op, so it is safe
in a deploy script — and the deployed stack does exactly that, through
`DATABASE_MIGRATE_ON_BOOT=true`.

The runner is `apps/api/src/data/migrate.ts`. It enforces `RULES.md` §1 rather
than leaving it to review:

- **Each file runs in a transaction the runner opens.** A file that fails
  half-way leaves nothing behind. Migration files therefore carry no `BEGIN`
  or `COMMIT` of their own, and one that does is refused.
- **An applied file is never edited.** Each is checksummed; a file that has
  changed since it was applied stops the run. A schema change is a new file.
- **A statement that can destroy data is refused** — `DROP TABLE`,
  `DROP COLUMN`, `TRUNCATE` and friends — unless the file says why in an
  `-- allow-destructive: <reason>` comment. That is the "stop and review" of
  RULES.md §1, made mechanical.
- **An advisory lock serialises runners**, so two instances booting at once
  cannot apply the same file twice.

## What `0001` sets up

The sign-in flow, end to end: `v2_users`, `v2_otp_challenges`, `v2_otp_sends`,
`v2_sessions`, `v2_access_tokens` and `v2_refresh_tokens`. `docs/PRD.md` §6
explains why each table is shaped the way it is.

**It has not been applied anywhere yet.** Until it is, `apps/api` boots with
`DATABASE_URL` unset, the repositories stay unbound, and every auth endpoint
answers 501 — which means the sign-in screens render and the flow stops at
"دریافت کد". Applying it is the one step between here and a working sign-in:

```sh
npm run db:migrate        # or paste the file into psql
```

Because it is unapplied, it is still editable. The moment it runs anywhere
that stops being true — the runner checksums it and refuses a changed file,
and a schema change becomes `0002`.

## Writing one

Name it `NNNN_what_it_does.sql`, in sequence. New tables take the `v2_` prefix
(RULES.md §2). Write the reasoning into the file — `0001` is the worked
example.

## Where the client may live

`pg` is a dependency of `apps/api` and of nothing else. Nothing in `apps/web`,
`apps/admin` or `packages/` may import it, and `apps/api/src/data` may be
imported only by a module's `*.repository.ts`. That chain is what keeps the
front-end unable to reach storage — see `docs/ARCHITECTURE.md` §4.

## Binding a repository

Each backend module declares a repository port in
`apps/api/src/modules/<m>/<m>.repository.ts`. Until an implementation is bound,
a call throws `DataLayerNotConfiguredError` (HTTP 501) rather than returning
fake data. To bind one:

1. Write an adapter satisfying the module's `<Module>Repository` interface,
   using `query` / `queryOne` / `withTransaction` from `../../data`.
2. Register it in `apps/api/src/server.ts`, before `listen`:
   ```ts
   setUsersRepository(new SqlUsersRepository());
   ```

No service, controller or route changes.
