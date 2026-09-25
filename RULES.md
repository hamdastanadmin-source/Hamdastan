# Critical Rules

## Database

**No database, ORM or data-persistence technology has been chosen for this
project.** Do not introduce one without being asked — not Prisma, Drizzle,
TypeORM, Sequelize, Mongoose, or a raw driver.

The architecture already has the seam it will plug into: every backend module
declares a repository port in
`apps/api/src/modules/<module>/<module>.repository.ts`, and business logic only
ever calls through it. See `database/README.md` for the wiring steps.

The rules below take effect the moment a schema exists — read them before
adding one, not after.

1.  **DATA SAFETY — ZERO DATA LOSS:**
    *   NEVER run a schema-push or sync command that can drop existing tables
        (for example a force-reset flag on any ORM's push command).
    *   Before applying a schema change, introspect the live database first so
        the schema file reflects its actual state. This is what prevents
        dropping tables the ORM does not know about.
    *   If a migration warns about "Data Loss" or "Dropping tables", STOP
        IMMEDIATELY and review.
    *   Migrations are reviewed files in `database/migrations/`, applied in
        order. Never edit one that has already been applied.

2.  **Schema Management:**
    *   New tables use the `v2_` prefix.
    *   The schema file must include ALL existing tables in the database, even
        ones the app does not use, so the ORM never tries to delete them.

3.  **Where the client may live:**
    *   The database client is a dependency of `apps/api` only. Nothing in
        `apps/web`, `apps/admin` or `packages/` may import it — that is what
        keeps the front-end unable to reach the data layer.

## Authentication

4.  Users, one-time codes and sessions are held in memory by
    `createInMemoryAuthRepository()` in
    `apps/api/src/modules/auth/auth.repository.ts`. Nothing persists across a
    restart and nothing is shared between processes, so this is not a real
    authentication boundary and must not be deployed as one. Replacing it means
    implementing `AuthRepository` against a data layer — the schema is in
    `docs/architecture/auth-data-model.md`.

5.  A persistent session store keeps **hashes** of session tokens, never the
    tokens. A persistent challenge store keeps **hashes** of one-time codes,
    never the codes. The in-memory stand-in already hashes codes; it keeps
    tokens in plain because the map dies with the process.

6.  `SHOW_DEV_OTP` echoes a one-time code back to the client. It is ignored
    when `NODE_ENV=production`, and that guard is not to be loosened.

## Front-end network access

7.  The front-end apps call `apps/api` and nothing else. No component, hook or
    store calls the network directly; requests go through `src/services`. If
    the product needs a third-party service, the backend fronts it. Enforced by
    `npm run lint`.
