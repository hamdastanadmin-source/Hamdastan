# Critical Rules

## Database

**PostgreSQL**, reached from `apps/api` through the `pg` driver. No ORM —
repositories write SQL against the pool in `apps/api/src/data`. Do not add
one (Prisma, Drizzle, TypeORM, Sequelize, Mongoose) without being asked.

The schema is `database/migrations/*.sql`, applied by `npm run db:migrate`.
Every backend module reaches it only through the repository port in
`apps/api/src/modules/<m>/<m>.repository.ts`. See `database/README.md`.

The rules below are what the migration runner enforces — read them before
writing a migration, not after.

1.  **DATA SAFETY — ZERO DATA LOSS:**
    *   NEVER run a schema-push or sync command that can drop existing tables
        (for example a force-reset flag on any ORM's push command).
    *   Before writing a migration, look at the live database as it actually
        is. A migration written against an assumed state is how a table the
        code does not know about gets dropped.
    *   If a migration warns about "Data Loss" or "Dropping tables", STOP
        IMMEDIATELY and review.
    *   Migrations are reviewed files in `database/migrations/`, applied in
        order. Never edit one that has already been applied — the runner
        checksums them and will refuse the run.
    *   A destructive statement needs an explicit
        `-- allow-destructive: <reason>` comment in the file. Writing one is
        the review, not a formality.

2.  **Schema Management:**
    *   New tables use the `v2_` prefix.
    *   A migration touches only what it names. There is no schema-sync step
        that reconciles the database against a file, which is precisely why a
        table the app does not use is in no danger from one.

3.  **Where the client may live:**
    *   The database client is a dependency of `apps/api` only. Nothing in
        `apps/web`, `apps/admin` or `packages/` may import it — that is what
        keeps the front-end unable to reach the data layer.

## Authentication

4.  **Authentication lives in `apps/api`.** Users, one-time codes, sessions
    and tokens are rows in `v2_users`, `v2_otp_challenges`, `v2_sessions` and
    the two token tables. `apps/web` holds no session store of its own:
    `features/auth/services/session.service.ts` forwards the request's cookies
    to `GET /me` and returns the answer.

5.  **The code echo is a development switch.** `OTP_DEBUG_DISPLAY=true`
    returns the freshly issued one-time code in the API response and puts it
    on the verification screen. With it on, anyone who can ask for a code for
    a number can also read it. It exists so the flow is usable before
    Kaveh-Negar is connected; turning it off is the whole deployment step on
    the day it is, and the API warns loudly at boot if it is on in production.

6.  **The client never decides where a user goes.** `nextStep` comes from the
    server on every response that carries a session, and `apps/web/src/
    proxy.ts` obeys it. Inferring "this profile looks complete" in the browser
    is what would let a half-finished account walk past its step by editing a
    URL.

## Front-end network access

7.  The front-end apps call `apps/api` and nothing else. No component, hook or
    store calls the network directly; requests go through `src/services`. If
    the product needs a third-party service, the backend fronts it. Enforced by
    `npm run lint`.

## Deployment

8.  `deploy/.env.production` holds real credentials and is gitignored. Never
    commit it, and never send the repository root's `.env` to a server — it is
    a developer's machine, with `NODE_ENV=development` and the development
    one-time-code echo switched on.

9.  The deployed stack publishes **one** door, nginx. `web` and `api` are reachable
    only on the private compose network; nginx on :80 and :443 is the whole public
    surface. Adding a `ports:` entry to either is what quietly re-opens the
    backend to the internet.
