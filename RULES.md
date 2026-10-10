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
    to `GET /me` and returns the answer. The admin panel's allow-list and
    sessions are `v2_admin_users` and `v2_admin_sessions`, also in `apps/api`;
    an admin's access is decided there on every request, never only in
    `apps/admin`.

5.  **The code echo is a development switch.** `OTP_DEBUG_DISPLAY=true`
    returns the freshly issued one-time code in the API response (for the
    end-to-end tests; no screen shows it). With it on, anyone who can ask for a code for
    a number can also read it. **Production fails closed:** the echo is
    ignored, the console sender is never bound, and without
    `SMS_PROVIDER=kavenegar` asking for a code is a 503 — no code is issued,
    stored or logged. There is no production exception, for test numbers or
    anyone else.

6.  **The client never decides where a user goes.** `nextStep` comes from the
    server on every response that carries a session, and `apps/web/src/
    proxy.ts` obeys it. Inferring "this profile looks complete" in the browser
    is what would let a half-finished account walk past its step by editing a
    URL.

7a. **Admin access is a permission, checked in `apps/api`.** Every admin
    route that does something registers `requireAdminPermission(...)`, and
    the role → permission table is `ADMIN_ROLE_PERMISSIONS` in
    `@hamdastan/types`. A route never compares role names, and hiding a
    button in `apps/admin` is never the control.

7b. **A write is retried only if it is idempotent.** Clients retry reads,
    and writes that carry an `Idempotency-Key` the API claims on the write's
    own transaction. Anything that pays XP, stores a response or sends an
    SMS is never retried without one.

7c. **The client address comes from nginx alone.** `TRUST_PROXY` names
    nginx's address on the `edge` network and nothing wider — never `true`
    or a hop count, which the API refuses — and nginx *replaces*
    `X-Forwarded-For`. A `proxy_set_header` in an nginx location drops every
    inherited header; set headers once, at the top of `nginx.conf`.

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
