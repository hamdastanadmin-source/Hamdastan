# Critical Rules

## Database

**There is no database or ORM in this project yet.** These rules carried over
from the boilerplate and take effect the moment one is introduced — read them
before adding a schema, not after.

1.  **DATABASE SAFETY — ZERO DATA LOSS:**
    *   NEVER use `prisma db push` with `--force-reset`, or any command that
        might drop existing tables.
    *   Before applying any schema change, always run `prisma db pull` first so
        the schema file reflects the current database state. This prevents
        accidentally dropping tables the ORM does not know about.
    *   If a migration warns about "Data Loss" or "Dropping tables", STOP
        IMMEDIATELY and review.

2.  **Schema Management:**
    *   New tables use the `v2_` prefix.
    *   The schema file must include ALL existing tables in the database, even
        ones the app does not use, so the ORM never tries to delete them.

## Authentication

3.  `src/lib/auth.ts` is an in-memory skeleton — sessions do not persist across
    restarts and do not work across multiple instances. Do not deploy it as a
    real authentication boundary. See the file header for what to replace.
