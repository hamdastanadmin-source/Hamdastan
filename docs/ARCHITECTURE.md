# Architecture

Where every kind of file lives, and why. When you are unsure where something
goes, the answer is here; if it is not, add it here before writing the code.

Most of these rules are enforced by `npm run lint` and `npm run lint:rtl`, so a
misplaced import fails CI rather than quietly becoming the new convention.

---

## 1. The tree

```
hamdastan/
├── apps/
│   ├── web/        Next.js — the product
│   ├── admin/      Next.js — the admin panel
│   └── api/        Fastify — the backend
│
├── packages/
│   ├── ui/         design system: components, patterns, tokens
│   ├── types/      types the front-end and backend both depend on
│   ├── validation/ schemas both sides validate against
│   ├── config/     shared config: app constants, tsconfig, eslint
│   └── shared/     utilities that are genuinely shared
│
├── assets/         design sources (PSD/AI/Figma exports) — never served
├── database/       PostgreSQL schema: migrations, seeds
├── docs/
├── deploy/         the production stack: nginx, the server's environment
├── e2e/            Playwright, drives the real apps
└── scripts/
```

One `npm install` at the root covers everything — npm workspaces links
`packages/*` into `node_modules/@hamdastan/*`. The packages ship TypeScript
source rather than a build artifact, so there is no build step to run before
the apps can use them; Next compiles them via `transpilePackages`.

---

## 2. Where does this file go?

| What you are writing | Where it goes |
| --- | --- |
| A component two apps could use | `packages/ui` |
| A component one feature uses | that feature's `components/` |
| A component the whole app's shell needs | `apps/<app>/src/components` |
| A call to the backend | `apps/<app>/src/services` |
| Business logic (backend) | the module's `*.service.ts` |
| A pure computation a service delegates to (scoring, a derived read-model) | beside the service, as `<module>.<name>.ts` — e.g. `onboarding.scoring.ts` |
| Data access | the module's `*.repository.ts` |
| SQL, a pool, a migration | `apps/api/src/data` |
| A schema change | a new file in `database/migrations` |
| A type the front-end and backend both use | `packages/types` |
| A type only one app uses | that app's `src/types` |
| A validation rule both sides apply | `packages/validation` |
| A number both sides must agree on (a timeout, an age limit) | `packages/config/app` |
| An outbound call to somebody else's service | `apps/api/src/integrations` |
| A rate-limit policy for a route | `rateLimits` in `apps/api/src/middleware/rate-limit.ts`, named in the route's `config.rateLimit` |
| A permission an admin route needs | `ADMIN_PERMISSIONS` / `ADMIN_ROLE_PERMISSIONS` in `packages/types/admin.ts`, guarded with `requireAdminPermission` |
| Making a write safe to retry | an `Idempotency-Key` claimed through `apps/api/src/data/idempotency.ts`, on the write's own transaction |
| A job that runs on a timer | `apps/api/src/modules/maintenance`, started from `server.ts` |
| How a front-end client retries and times out | `packages/shared/http.ts` (the rule); the numbers in `packages/config/app/http.config.ts` |
| A helper one feature uses | that feature's `utils/` |
| A helper genuinely shared | `packages/shared` |
| A colour, spacing or radius value | `packages/ui/tokens` |
| A design source file (PSD, AI, Figma export) | `assets/` |
| An image the browser loads | `apps/<app>/public/images/…` |

Two rules cover the rest:

- **Every file has one responsibility.** If you cannot name it in a sentence,
  it is two files.
- **No circular dependencies.** Dependencies point one way:
  `apps → packages`, and inside `packages`, `ui → shared → types`.
  Nothing in `packages/` imports from `apps/`, and no app imports another app.

---

## 3. Front-end (`apps/web`, `apps/admin`)

```
src/
├── app/         routes only — a page composes, it does not implement
├── components/  shared across this app's features (the shell)
├── features/    one directory per product area
├── hooks/       hooks used by more than one feature
├── lib/         app-local infrastructure
├── services/    the only place that knows a backend route
├── stores/      client state shared across features
├── styles/      the stylesheet entry point
├── types/       types this app alone uses
└── proxy.ts     the routing table, run before every navigation
```

### `proxy.ts`

Next's request proxy (what earlier versions called middleware). In `apps/web`
it holds **the routing table** — the rule that decides, on every navigation,
whether this visitor belongs on Welcome, on the profile form, in onboarding or
at home.

It is here rather than in a guard on each page for two reasons. It runs before
anything renders, so an unfinished account never sees a flash of the page it
is about to be redirected off; and the rule exists once, so adding a page
cannot forget it.

An unfinished account is pinned to its step's page *and the pages beneath
it* — onboarding is several screens under `/onboarding/` — and to nothing
else.

It is also the only place in a Next app that can set a cookie on the way to a
page, which makes it the only place a fifteen-minute access token can be
refreshed without the visitor noticing. A server component reads the session;
`proxy.ts` is what keeps it fresh.

The decision is always the server's: the proxy reads `nextStep` out of
`GET /me` and obeys it. It never infers "this profile looks complete" from the
user object, because then the browser would be deciding.

### Features

```
features/
├── auth/  onboarding/  home/  worlds/  play/  community/
└── profile/  activities/  events/  commerce/  notifications/  search/
```

`activities` is Engagement Studio's product side: the cards on home and
`/activities`, and the player at `/activities/:id`. It collects answers and
shows what the API answered — it decides nothing about access or XP.

A feature grows the directories it needs and no others:

```
feature/
├── components/  hooks/  services/  types/  utils/
├── index.ts     public, client-safe
└── server.ts    public, server-only (optional)
```

`index.ts` and `server.ts` are the feature's entire surface. Reaching past them
(`@/features/auth/hooks/use-auth`) is a lint error — it is what turns a feature
into a tangle. `auth` is the worked example; the rest are empty on purpose.

Splitting `index.ts` from `server.ts` keeps a client component from pulling
server-only code into its bundle. `apps/web/src/features/auth` shows the shape:
the provider and hooks in `index.ts`, the session lookup and route guards in
`server.ts`.

### `apps/admin`

Same tree, minus `proxy.ts`: the `(panel)` route group's layout calls
`requireAdminSession()` (`@/features/auth/server`), which forwards the cookies
to `GET /admin/me` and redirects to `/login` without a live session. That is a
convenience — every panel call is checked again by `authenticateAdmin` in
`apps/api`. `AdminShell` (`src/components`) is a dashboard: the section menu is
shadcn's `Sidebar` on the reading-start side (`side="right"` — the right, in
RTL), with the admin, the theme switch and sign-out at its foot, and a top bar
with the `SidebarTrigger` (Ctrl/⌘+B folds it away). On a phone the same menu
opens as a sheet from the right. A new section is an entry in its `NAV` list
and a route under `(panel)/`.

Like `apps/web`, the admin root layout wraps everything in
`DirectionProvider`. Radix writes `dir` on its own roots — `ToggleGroup`,
`Tabs` — and on portalled overlays, and without the provider it writes
`ltr`: a toggle group of cards then lays out and punctuates left-to-right
inside an RTL page.
There are three: `users` (the admin allow-list and roles), `engagement`
(Engagement Studio — the builder, the list and the results dashboard) and
`sessions` (a product account's live sessions, ended one or all at once).

**What an admin sees follows their role.** `src/lib/access.ts` holds the
sections and `can(role, permission)`, read from the same
`ADMIN_ROLE_PERMISSIONS` table the API enforces. The menu shows only the
sections the role opens; a page calls `requireAdminPermission(...)`
(`@/features/auth/server`), which sends an admin without it to their first
permitted section; inside a screen, `useAdminCan()` (`@/features/auth`,
provided by `AdminShell`) hides the buttons the API would refuse. None of it
is access control — `requireAdminPermission` in `apps/api` is. The builder reads
and writes the question spreadsheet in the browser with `read-excel-file` and
`write-excel-file` (dependencies of `apps/admin` alone, loaded on demand); the
row → question mapping is `packages/validation/engagement-import.ts`, so it
is checked by the same schema as the builder and tested with the API's
suite. Reading a local file is not a network call — nothing leaves the
browser until the activity is saved through `apps/api`. Formatting shared
by both features — Jalali dates, Persian counts and percentages — is
`src/lib/format.ts`.

The admin panel is **not** a mobile column. It is an ordinary responsive app,
so `sm:`/`md:`/`lg:` are allowed in it — the rules under *Desktop is mobile*
below are `apps/web`'s. Everything else here holds: shadcn components from
`@hamdastan/ui`, token colours only, violet for the one primary action.

### Desktop is mobile

The product is a mobile app wherever it is opened. On a laptop it does not
become a dashboard, a two-column form or a wider version of itself — it is the
same phone screen, centred.

`components/layout/MobileShell.tsx` is where that happens, and it is **the only
file in `apps/web` allowed to contain a breakpoint**:

```
w-full  max-w-shell (430px)  min-h-dvh  mx-auto  bg-background
                                  ↑
      outside the column: bg-surface-0, a shade darker, and from
      the `shell:` breakpoint up, a border and a soft shadow
```

Pages below it have **no `sm:`, `md:`, `lg:` or `xl:`** of their own. They are
written for one width and they get one width, so a page cannot quietly grow a
desktop layout. Two things follow from that:

- A width cap inside a page (`max-w-2xl`, `w-[600px]`) is redundant at best
  and a second, competing layout at worst. The shell is the cap.
- Anything that leaves the column in the DOM — a toast, a `Sheet`, any
  portalled overlay — has to be constrained to `max-w-shell` where it is used,
  because a portal is not a descendant of that div. The `Toaster` in
  `layout.tsx` is the worked example: Sonner's `--width` is the column less
  its gutters, and its `mobileOffset` (used below Sonner's own 600px
  breakpoint) insets it by the column's margin plus the same gutter.
  Overriding the toaster's own `width` instead leaves the toast anchored to
  one edge of the column in RTL.

`e2e/shell.spec.ts` asserts the column is exactly `MOBILE_SHELL_MAX_WIDTH` and
centred at 1440, 1920 and 2560, so a stray breakpoint fails CI rather than
review.

### The page scaffold

Every screen is `Screen` → `ScreenHeader` / `ScreenBody` / `ScreenFooter`
(`components/layout/Screen.tsx`): a short header, a body, and the primary
action pinned to the bottom edge. Two more pieces come from the same file and
one from beside it:

- **`ScreenTitle`** is the `h1` plus its supporting line. There is exactly one
  per screen, and it is the only place that decides what size a page title is
  (`size="page"`, the default, or `size="prompt"` for a question put to the
  person — smaller and lighter, as in the onboarding questionnaire)
  — six screens each hand-rolling the same `<header><h1><p>` is how a type
  scale drifts.
- **`ScreenBody center`** centres the body's content in the space between the
  header and the footer. A one-field form left top-aligned leaves two thirds
  of a phone empty above the action bar, which reads as a page that failed to
  load. A form long enough to fill the column leaves the flag off — centring
  one only moves it down on a tall device, and moves it again the moment a
  validation message appears.
- **`ScreenBack`** (`components/layout/ScreenBack.tsx`) is the header's back
  control. It and `SignOutButton` both use `Button size="touch"` — the 44px
  header-control size — because the touch minimum is a property of the size
  scale, not something each header re-tunes. Its arrow points the way the
  reader came from, which in an RTL product is rightwards.

**`BottomNav`** (`components/layout/BottomNav.tsx`) ends the top-level
screens — home and the profile — in place of a `ScreenFooter`: sticky for
the same reason, with the current tab told by weight rather than colour.
A screen one level down has `ScreenBack` instead and no bottom nav.

**`XpAmount`** (`components/xp/`) is the app's one way to write an amount
of XP — isolated as an LTR run so «+۵۰ XP» does not reorder inside Persian
text. Shared here because both the questionnaire and the profile use it.

`MobileShell` draws the column's one ambient gradient (`--gradient-shell-glow`,
via the `shell-ambient` class, which carries its own position, height and
z-index). It is decorative, `aria-hidden` and `pointer-events-none`; screens
do not draw their own. The matching `hero-glow` class is the halo behind
artwork or an icon — it carries the paint and the stacking but not the inset,
because a 64px tile and full-width artwork need opposite spreads and one of
them would otherwise push the column into a horizontal scroll.

The icon-in-a-tinted-tile mark at the top of an empty, error or confirmation
state is `IconBadge` (`@hamdastan/ui`), not three hand-built divs.

The footer is `sticky`, not `fixed`. A fixed bar is measured against the
viewport, so on a laptop it would span the whole browser — which is the usual
way a "mobile layout on a desktop" gives itself away. Its bottom padding is
`max(1.25rem, env(safe-area-inset-bottom))`, which clears the iOS home
indicator without adding a gap on a device that has none.

Page metrics, all of them tokens or plain utilities, never ad-hoc values:
20px side gutter, 24px/800 titles, 16px body, 14px secondary, 48px controls,
`--radius` of 0.75rem.

### Two rules the linter enforces

**Business logic does not live in a React component.** A component renders.
Decisions belong in a service; state machinery belongs in a hook or a store.

**A component never calls the network.** `fetch` is banned in `app/`,
`components/`, `stores/` and a feature's `components/` and `hooks/`. Requests
go through `src/services`, which is the single egress to `apps/api`:

```
component → hook → service → apiClient → apps/api
```

The front-end talks to our backend and to nothing else. There is no direct call
to a third-party API, and no data access of any kind — if the product needs an
external service, `apps/api` fronts it and exposes a route.

**Retries and timeouts belong to the transport.** `createHttpClient`
(`packages/shared/http.ts`) gives every attempt a timeout and retries only
what cannot happen twice: `GET`/`HEAD`, and a write sent with an
`idempotencyKey` — never a `PUT` just because it is a `PUT`. It retries only
a network failure, a timeout, 502, 503, 504 or 429, with exponential backoff
and full jitter, honouring `Retry-After`. A service opts a write in by
passing an `idempotencyKey` it generated once per user action
(`createIdempotencyKey`); a component never retries anything itself.

---

## 4. Backend (`apps/api`)

```
src/
├── modules/       one directory per domain area
├── middleware/    cross-cutting request handling
├── config/        environment, parsed once at boot
├── data/          PostgreSQL: the pool, the migration runner
├── integrations/  outbound adapters (SMS, payment, storage)
├── shared/        errors, the repository seam, crypto, cookies, responses
├── app.ts         builds the server
└── server.ts      owns the process
```

### Modules

`auth`, `users`, `onboarding`, `account`, `worlds`, `content`, `missions`,
`trivia`, `community`, `progress`, `events`, `commerce`, `notifications`,
`search`, `admin`, `engagement` — each with the same seven files — and
`maintenance`, which has no HTTP surface (below):

```
module/
├── module.routes.ts      path + schema, then hand off
├── module.controller.ts  HTTP in, HTTP out
├── module.service.ts     the business logic
├── module.repository.ts  the data access port
├── module.schema.ts      request validation
├── module.types.ts       types internal to the module
└── index.ts              the module's public surface
```

`modules/index.ts` is the route table: one line per module and the path it
answers on. Most take a prefix of their own name; `users` takes the bare
prefix because every route it owns is about *the* current user and `/me` reads
better than `/users/me`. `onboarding` is mounted at `/me/onboarding` for the
same reason.

A module that **only composes other modules** has no repository, because
it owns no data. `account` is the one: its service reads the profile row
through `usersService`, the result through `onboardingService`, the ledger
through `progressService` and grants through `missionsService`, and holds
only the account's own rules (what makes a profile complete, which avatar
items a level allows). Nothing imports it, which is what keeps the module
graph acyclic — `onboarding → users, missions`, `missions → progress`.

Ownership in the account area: `users` stores the profile columns,
`progress` owns the XP ledger and the level arithmetic (`levelFor`,
`toProgress`), `missions` reads mission status off the ledger
(`missionsFor`), badges off the missions (`badgesFor`), and grants a
mission's reward once (`complete`).

A module may add files beside the seven when a service delegates a pure
computation: `onboarding` keeps its questionnaire scoring in
`onboarding.scoring.ts` and the result card in `onboarding.result.ts`;
`engagement` keeps assessment scoring and the XP rule in
`engagement.scoring.ts`, and the dashboard figures and the CSV in
`engagement.results.ts`. They import no repository and no HTTP, so they are
tested as plain functions.

**`maintenance`** is the cleanup job, and the one module with no routes,
controller or schema: nothing about it is reachable over HTTP. Its service
composes the purges the owning modules expose (`authService.purgeExpired`,
`adminService.purgeEnded`) plus the idempotency record, and its repository
holds the advisory lock that keeps two instances from running it at once.
`server.ts` starts its timer once the data layer is open.

**`engagement`** is Engagement Studio: one engine for surveys, missions and
assessments. It mounts two route plugins — `/admin/engagement` behind
`authenticateAdmin`, `/me/activities` behind `authenticate` — and depends on
`progress` (`engagement → progress`, one way). Its service decides
everything: visibility, completion, scoring, whether a submission earns XP.

**The XP ledger has two writers and one owner.** `progress` owns
`v2_xp_transactions`: the port (`grant`, `total`, `revoke`), the level
arithmetic and the reversal rule. Missions grant through
`progressService.grant`. Engagement grants through `grantWithin(client, …)`,
exported by `progress`, which runs on the caller's transaction — because a
response, its participation and its reward must land together or not at
all, and a port call would commit on a connection of its own. That is the
one sanctioned case of a repository using another module's repository code;
it never updates or deletes a ledger row. A revocation is
`progressService.revoke`: a new negative row, never an edit.

A module's `*.repository.ts` holds both its port (the interface) and the
PostgreSQL adapter that satisfies it. They live together because that file is
the one layer allowed to know both vocabularies — the domain's on the way in,
SQL's on the way out — and `server.ts` binds the adapter without any service
noticing.

### The request path

```
Route → Controller → Service → Repository → Data Layer
```

Each arrow is one-way, and each step is lint-enforced:

- A **route** declares a path and a schema and calls a controller. It may not
  import a service or a repository.
- A **controller** reads the request, calls the service, shapes the reply. It
  makes no decisions and may not import a repository.
- A **service** is the only layer that decides anything. It knows nothing about
  HTTP and nothing about storage.
- A **repository** is the only layer that touches data.

Skipping a step is what makes a backend impossible to test and impossible to
re-platform, which is why the linter refuses it rather than leaving it to
review.

Every response leaves as `ApiResponse<T>` from `@hamdastan/types` — `ok` and
`fail` in `shared/response.ts` build it. Services throw the domain errors in
`shared/errors.ts`; `middleware/error-handler.ts` is the one place a thrown
error becomes a status code.

### Validation, and why it is in the controller

A route's `schema` option in Fastify takes JSON Schema, which validates but
does not **transform** — and every schema in `@hamdastan/validation`
normalises as well as validates: `۰۹۱۲…` and `+98912…` have to become one
phone number, Arabic ي has to become Persian ی. So a controller's first line
is `parseBody(schemas.x.body, request.body)` (`shared/validate.ts`), which
runs the shared zod object and turns a failure into the API's own
`ValidationError` with per-field messages.

That is what lets the form in `apps/web` and the endpoint be built from one
definition of a field instead of two that drift.

### Authentication

`middleware/authenticate.ts` is the preHandler that turns the access cookie
into `request.user`. It sits in `middleware/` rather than in a module because
it is the same check on every protected route, and because a route file may
not reach a service directly — it registers this and stays a declaration.

It is registered **per route**, not as a hook on the plugin, so a public route
added later cannot inherit protection it never asked for, or lose it silently.

Refreshing is deliberately not done here: an expired access token is a 401,
and the caller presents its refresh token at `POST /auth/refresh`. Rotating
silently inside an arbitrary request would mean any handler could be the one
that issues cookies.

The data layer exports `DbClient` (the `pg` client a `withTransaction`
callback receives) so a helper such as `grantWithin` can be typed without a
repository importing `pg` itself.

**CSRF** is `middleware/csrf.ts`, an `onRequest` hook: a state-changing
request with a foreign or `null` `Origin`, or `Sec-Fetch-Site: cross-site`,
is a 403 before routing; and Fastify's `text/plain` parser is removed, so a
body a form could send without a preflight is a 415. HSTS is left to nginx
(helmet's is turned off).

**Rate limits** are `middleware/rate-limit.ts`: `@fastify/rate-limit` with
a sliding-window store (`rate-limit-store.ts`), registered in `app.ts` before
any route. Every route gets exactly one policy — the one it names in
`config.rateLimit`, or the default, keyed by admin, else user, else address.
It runs as a `preHandler` after the route's own guard, which is what lets a
signed-in request be counted by account rather than by address. The address
is `request.ip`, which believes `X-Forwarded-For` only from `TRUST_PROXY`.

`middleware/authenticate-admin.ts` is the same idea for the admin panel: it
turns the `hd_admin` cookie into `request.admin`, re-reading the admin's status
on every call. The `admin` module owns `v2_admin_users` and
`v2_admin_sessions`, and borrows the one-time codes from `auth`
(`authService.requestOtp(…, 'admin')` and `authService.consumeOtp`), which
hash them under an `admin` scope so neither flow's code opens the other —
`admin → auth → users`, still one-way.

An admin route that does anything registers
`requireAdminPermission('<permission>')` instead — the session, then the
role's grant, from `ADMIN_ROLE_PERMISSIONS` in `@hamdastan/types`. A route
names a permission, never a role. Only `/admin/me` uses `authenticateAdmin`
alone.

Session lifetimes live in `SESSION` and `ADMIN_SESSION`
(`@hamdastan/config`), overridable from the environment through
`env.session`. The product session's idle limit is the refresh token's
rolling expiry and its absolute limit `v2_sessions.absolute_expires_at`,
both enforced by the auth repository at refresh and at every access-token
lookup; the admin session's idle limit is `last_seen_at`, checked by
`findBySessionToken`.

### Integrations

`src/integrations/` is the only place the API calls somebody else's service.
Each is a port plus one implementation per provider — `SmsSender` with a
console adapter for development and a Kaveh-Negar adapter for production —
bound once in `server.ts`. A service depends on the capability and never on
the vendor, which is the same rule as the repositories.

### The data layer seam

**PostgreSQL, reached through `pg`.** The driver is a dependency of `apps/api`
alone — nothing in `apps/web`, `apps/admin` or `packages/` may import it, and
that is what keeps the front-end unable to reach storage.

`src/data/` is the only place that opens a connection. It exports a pool, a
`query` that binds parameters, a `withTransaction`, and the migration runner:

```
routes → controller → service → repository → src/data → PostgreSQL
```

Each module still declares its data needs as an interface — a *port* — in
`<module>.repository.ts`, written in the language of the domain
(`findActiveByWorld`), not of a store (`query`, `execute`). A service calls
`usersRepository()` and knows nothing more. **`src/data` is imported by
repositories and by nothing else**: a service that writes SQL has collapsed
two layers that exist to be separable.

Until a module's implementation is bound with `setUsersRepository(...)` in
`server.ts`, the call throws `DataLayerNotConfiguredError` (HTTP 501) rather
than returning fake data, so an unimplemented endpoint cannot pass for a
working one.

Beside the pool, the data layer has two helpers a repository may use:

- **`idempotency.ts`** — `v2_idempotency_keys`, which no module owns.
  `claimIdempotency` runs on the caller's transaction (like `grantWithin`),
  so a key is claimed, the work done and the outcome recorded in one commit;
  a duplicate waits on the claim and then reads the outcome.
  `engagement`'s submit is the worked example.
- **`deleteInBatches`** — for the cleanup job: a large backlog deleted a
  batch at a time instead of in one long-locking statement.

Every pooled statement is bounded by `DATABASE_STATEMENT_TIMEOUT_MS`
(server-side, with a client-side timeout a little later); the migration
runner lifts it for its own session and resets it before returning the
connection.

The schema lives in `database/migrations/*.sql` and is applied by
`npm run db:migrate`. An applied file is never edited — the runner checksums
them and refuses one that has changed. See `database/README.md` for the rest,
and `RULES.md` §1 for the data-safety constraints.

---

## 5. Deployment

```
deploy/
├── nginx.conf              the reverse proxy's server block
├── nginx-api.inc           what every API location shares: limits, timeouts, gzip
├── env.production.example  the template
└── .env.production         real credentials; gitignored
```

One host, three containers on a private network, and nginx as the only
published port:

```
:443 → nginx ─┬─ /api/v1/  → api:4000
              └─ /          → web:3000
```

Serving both from one origin is deliberate: the browser calls the API on the
host it loaded the page from, so the session cookie is first-party and CORS
does not arise.

nginx is the gateway; there is no other. It replaces `X-Forwarded-For` with
the connecting address, sends its `$request_id` as `X-Request-ID`, limits
requests per address (`limit_req`, stricter on the sign-in routes, answering
429 in the API's envelope), caps API bodies at 1 MB and API calls at 30 s, and
logs latency without query strings. Every `proxy_set_header` is set once at
the top of `nginx.conf`: a location that set one of its own would inherit
none of them.

**Who may say who the client is.** nginx reaches the API over `edge`, a
compose network of its own on which nginx has a fixed address
(`NGINX_EDGE_IP`), through the alias `api-edge` that exists only there. The
API's `TRUST_PROXY` names that address and nothing else. `web` and `admin`
reach the API over the default network and are not trusted: their
server-side calls carry the visitor's cookie and are counted by session, so
they never need to relay a client address — and could not forge one.

`docker-compose.yml` is the local stack; `docker-compose.prod.yml` is an
overlay that removes the published ports, adds nginx, and builds the browser
bundle against the public URL. `scripts/deploy.sh` runs both against the
server over SSH.

`NEXT_PUBLIC_` variables are substituted into the browser bundle at **build**
time, which is why the public URL is a Docker build argument and not only a
runtime variable. Changing it means rebuilding, not restarting.

The API validates its environment at boot (`apps/api/src/config/env.ts`) and
refuses to start on an unknown value, so `.env.production` must use the names
in the template.

The site is `https://hamdaastaan.ir`. nginx terminates TLS with a Let's
Encrypt certificate that certbot on the host issues and renews into
`/etc/letsencrypt` (mounted read-only); :80 only redirects to the canonical
origin, apart from `/_up`, which the deploy script probes over plain HTTP from
the server itself. Session cookies default to `Secure` in production; were the
site ever served over plain HTTP again, `COOKIE_SECURE=false` would be
required, because a browser drops a `Secure` cookie on `http://`.

---

## 6. Design system (`packages/ui`)

```
packages/ui/
├── components/  the public barrel, with the RTL wrappers
├── primitives/  shadcn/Radix building blocks — the only place Radix is imported
├── patterns/    composed, reusable pieces (SectionHeader)
├── icons/       the dynamic icon loader
├── tokens/      colors, typography, spacing, radius, shadows
└── styles/      the shared base layer
```

Apps import from `@hamdastan/ui`. The one exception is the chart, which is
`@hamdastan/ui/chart`: the component barrel is a single client module, so
everything it exports ships with every screen, and Recharts (~200 KB gzipped)
belongs only to the screens that draw one. A heavy component added later goes
on an entry of its own the same way. Importing `radix-ui` anywhere but
`packages/ui/primitives` is a lint error: the wrappers are what set `dir` on
portalled content, and a primitive imported directly skips them.

### shadcn only

`primitives/` holds shadcn/ui's components, as shadcn ships them. **Where one
exists, it is used** — `Button`, `Input`, `Label`, `Form`, `InputOTP`,
`Select`, `ToggleGroup`, `Accordion`, `Alert`, `Separator`, the Sonner
`Toaster`, and `Chart` (shadcn's Recharts wrapper) for any chart — its colours
come from `@hamdastan/ui/tokens` through `ChartConfig`. A hand-written equivalent loses the keyboard handling and the ARIA wiring that
are most of what those components are, and it loses them silently.

Adapting one is fine and expected: a `className` of token utilities on a
`ToggleGroupItem` so the selected segment reads on a dark surface is styling,
not a replacement. Reimplementing its state and its roles is the line.

Two adaptations are deliberate and apply library-wide, because shadcn assumes
a product that gets wider and this one never does:

- **`md:text-sm` is removed** from `Input` and `Textarea`. It shrinks the text
  once the *viewport* passes 768px, inside a column that is 430px on a phone
  and 430px on a monitor — so a field would change size while nothing around
  it did. `e2e/welcome.spec.ts` asserts the size is stable across widths.
- **`Table` and `ToggleGroup` are logical.** shadcn's `TableHead` is
  `text-left`, which in RTL put every header at the far side of its column
  from its cells; it is `text-start` (and `pe-0`). `ToggleGroup`'s attached
  mode rounds and borders with `rounded-s`/`rounded-e`/`border-s`. The RTL
  lint only catches `left-`/`right-` with a dash, so check `text-left`,
  `rounded-l` and `border-l` by eye when adding a component.
- **`Card` is shadcn's earlier `Card`.** Its padding lives on `CardHeader`
  (`p-6`) and `CardContent` (`p-6 pt-0`), not on `Card` — so a card with
  only a `CardContent` must give it its own top padding (`p-4 sm:p-6`), and
  `gap-*`/`py-*` on `Card` itself do nothing.
- **`Sidebar`** is shadcn's stock component, used by the admin panel. Its
  `side` names a physical edge, like `Sheet`'s, so its side-keyed position
  classes carry `rtl-ok`; everything else in it was made logical (`end-*`,
  `pe-*`, `border-s`, `text-start`). Its `--sidebar-*` tokens alias the
  neutral surfaces in `tokens.css` and its "primary" is the foreground, so
  the active item is never violet. Its `use-mobile` hook is
  `packages/ui/hooks/use-mobile.ts`, read through `useSyncExternalStore`.
- **`Dialog` and `Sheet` are capped at `--shell-max-width`** and positioned
  against the column rather than the browser. They are portalled to `<body>`,
  outside `MobileShell`, so without it a panel would slide in from the edge of
  a laptop screen while the app it belongs to sat in the middle.

One adaptation is for direction rather than width: **`Progress` fills from
the reading start.** shadcn moves the indicator with an inline
`translateX(-n%)`, which fills from the left — backwards in RTL. The offset
rides in `--progress-gap` instead, so an `rtl:` variant can reverse it.

And one is for script: **the Sonner `Toaster` inherits the app font at
14px.** Sonner sets its own system font stack and a 13px size, which drops
Yekan Bakh from every toast and leaves Persian too small to read at a glance.
The same wrapper turns on `richColors` and points Sonner's `--success-*` and
`--error-*` at the soft feedback tokens in `tokens.css`, so success and error
are tinted while everything else stays on the neutral popover.

The local `Input` used to be a bespoke component: a wrapper `<div>` and a
`state="error" | "success"` prop. It is stock shadcn now, because the wrapper
broke layouts that expected the input to *be* the element they styled, and
because the prop meant the field never reacted to `aria-invalid` — which is
exactly what `Form` sets. A form could show its error message under a control
that still looked untouched.

`DirectionProvider` sits in the root layout. Radix renders overlays into a
portal, outside the subtree that carries `dir="rtl"`, and the provider is what
carries the direction across.

### Theme

One dark theme, as a `.dark` class on `<html>`, defined entirely by the shadcn
variables in `tokens.css`: `--background`, `--foreground`, `--card`,
`--primary`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`,
`--destructive` and the rest. Every `-foreground` is chosen against its own
surface and clears 4.5:1.

The surfaces are near-black charcoal with only a trace of cool hue, and
deliberately **not** tinted toward the brand: violet is spent on `--primary`
— the screen's main action — and on nothing else (not surfaces, borders,
focus rings, selection, progress, icons or glows), so the action is the only
colour on the screen. `--success` is green (`--success-hue`), never the
brand. A component that would otherwise draw selection in `primary` —
`Tabs`' underline and pill variants — is restyled to foreground where it is
used. The one exception is the stock `Switch`, whose "on" stays `primary`:
a foreground track disappears against the dark surfaces.
`--surface-0`, a shade darker than `--background`, is what sits behind the
mobile column.

**A page never names a colour.** No hex, no `rgb()`, no `bg-black`, no
`text-white` — the Tailwind utility that reads the token instead. The single
exception is `THEME_COLOR` in `tokens/theme.ts`: the browser reads it from
`<meta name="theme-color">` and the web manifest, both parsed before any
stylesheet, so it has to be a literal. It lives beside the tokens for that
reason, and `tokens.css` names it at `--background`.

### Tokens

`tokens/tokens.css` is the single source of truth for every design value in the
product — colours, surfaces, radii, the type scale. The TypeScript files beside
it (`colors.ts`, `spacing.ts`, …) **reference** those custom properties rather
than copying them, so a chart colour and a `bg-primary` class cannot drift:

```ts
export const colors = { primary: 'hsl(var(--primary))', … };
```

Never hard-code a design value in a component. In a `className`, use the
Tailwind utility; where a real CSS string is required (canvas, a chart
library), import from `@hamdastan/ui/tokens`. If a value is missing, add it to
`tokens.css` first.

The brand has one input: `--brand-hue` and `--brand-saturation` at the top
of `tokens.css`. The brand ramp and `--primary` derive from them; the
semantic colours have hues of their own beside them.

The avatar's palette is `--avatar-*` (skin tones, hair, muted clothing),
read in TypeScript as `avatarColors`. It is content colour — what a figure
wears — and is never used for interface.

---

## 7. Graphics

| | |
| --- | --- |
| `assets/` | Design **sources** — PSD, AI, Figma exports, master SVGs. Never served, never imported by application code. |
| `apps/<app>/public/` | **Runtime** files the browser loads: `images/{brand,worlds,badges,avatars,backgrounds,placeholders}`, `icons/`, `fonts/`. |

Exporting from `assets/` into `public/` is a deliberate step. Nothing under
`assets/` reaches a bundle.

The role characters are the worked example: the 1500×1500 PNG masters are
`assets/avatars/roles/<role>-<gender>.png`; the served copies are
`apps/web/public/images/avatars/<role>-<gender>.webp`, every one cropped to
the same 960×1200 box (so all fourteen share one scale) and resized to
640×800. A new or redrawn character keeps that name, crop and size. They
are shown only through `RoleCharacter` (`apps/web/src/components/artwork`),
which crops the head out of that one file — no second export per frame.

The detective owl is the loader in front of a social-profile result (the
questionnaire's processing step and `/profile/social`). The master is
`assets/illustrations/owl-detective.webp` (960×540, off-white backdrop);
the served copy `apps/web/public/images/brand/owl-detective.webp` is
prepared like the stage owls — backdrop lifted to white, owl scaled to the
same height and centred on 720×491 — and keeps the 60-frame, 5-second loop.
It is shown only through `OwlLoader` (`apps/web/src/components/artwork`),
on `bg-owl-backdrop`, white in both themes.

---

## 8. Checks

| Command | What it covers |
| --- | --- |
| `npm run typecheck` | TypeScript across every workspace |
| `npm run lint` | ESLint, including every boundary above |
| `npm run lint:rtl` | Logical utilities only; Radix confined to primitives |
| `npm test` | Vitest |
| `npm run build` | Production build of both Next apps |
| `npm run test:e2e` | Playwright against the real `apps/web` |
| `npm run db:migrate` | Applies pending migrations; safe to re-run |
| `./scripts/smoke-test.sh <url>` | Read-only checks of a running stack through nginx, after every deploy — see `docs/deploy-runbook.md` |
