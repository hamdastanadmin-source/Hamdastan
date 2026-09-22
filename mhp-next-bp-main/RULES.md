# Critical Rules

1.  **DATABASE SAFETY - ZERO DATA LOSS:**
    *   NEVER use `prisma db push` with `--force-reset` or any command that might drop existing tables.
    *   Before applying any schema change, always run `prisma db pull` first to ensure the schema file reflects the current database state, preventing accidental drops of tables that Prisma doesn't know about.
    *   If a migration warns about "Data Loss" or "Dropping tables", STOP IMMEDIATELY and review.

2.  **Schema Management:**
    *   New tables use `v2_` prefix.
    *   The `schema.prisma` file must include ALL existing tables in the database, even if they are not used in the app. This ensures Prisma doesn't try to delete them.
