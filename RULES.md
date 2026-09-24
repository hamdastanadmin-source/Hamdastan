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

4.  `apps/web/src/features/auth/services/session.service.ts` is an in-memory
    skeleton — sessions do not persist across restarts and do not work across
    multiple instances. Do not deploy it as a real authentication boundary. See
    the file header for what to replace.

## Front-end network access

5.  The front-end apps call `apps/api` and nothing else. No component, hook or
    store calls the network directly; requests go through `src/services`. If
    the product needs a third-party service, the backend fronts it. Enforced by
    `npm run lint`.
