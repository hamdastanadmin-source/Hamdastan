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
| Data access | the module's `*.repository.ts` |
| SQL, a pool, a migration | `apps/api/src/data` |
| A schema change | a new file in `database/migrations` |
| A type the front-end and backend both use | `packages/types` |
| A type only one app uses | that app's `src/types` |
| A validation rule both sides apply | `packages/validation` |
| A number both sides must agree on (a timeout, an age limit) | `packages/config/app` |
| An outbound call to somebody else's service | `apps/api/src/integrations` |
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
└── profile/  events/  commerce/  notifications/  search/
```

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
  `layout.tsx` is the worked example.

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
  — six screens each hand-rolling the same `<header><h1><p>` is how a type
  scale drifts.
- **`ScreenBody center`** centres the body's content in the space between the
  header and the footer. A one-field form left top-aligned leaves two thirds
  of a phone empty above the action bar, which reads as a page that failed to
  load. A form long enough to fill the column leaves the flag off — centring
  one only moves it down on a tall device, and moves it again the moment a
  validation message appears.
- **`ScreenProgress`** is the strip between the header and the body, for
  chrome that must stay pinned while the body is centred — today the sign-up
  step bar. Without it, every centred screen re-implements the same
  `flex-1 justify-center` wrapper *inside* the body to keep that bar out of
  the centring, which is `ScreenBody center` written again, per screen.
- **`ScreenBack`** (`components/layout/ScreenBack.tsx`) is the header's back
  control. It and `SignOutButton` both use `Button size="touch"` — the 44px
  header-control size — because the touch minimum is a property of the size
  scale, not something each header re-tunes. Its arrow points the way the
  reader came from, which in an RTL product is rightwards.

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

`auth`, `users`, `worlds`, `content`, `missions`, `trivia`, `community`,
`progress`, `events`, `commerce`, `notifications`, `search` — each with the
same seven files:

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
better than `/users/me`.

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

The schema lives in `database/migrations/*.sql` and is applied by
`npm run db:migrate`. An applied file is never edited — the runner checksums
them and refuses one that has changed. See `database/README.md` for the rest,
and `RULES.md` §1 for the data-safety constraints.

---

## 5. Deployment

```
deploy/
├── nginx.conf              the reverse proxy's server block
├── env.production.example  the template
└── .env.production         real credentials; gitignored
```

One host, three containers on a private network, and nginx as the only
published port:

```
:80 → nginx ─┬─ /api/v1/  → api:4000
             └─ /          → web:3000
```

Serving both from one origin is deliberate: the browser calls the API on the
host it loaded the page from, so the session cookie is first-party and CORS
does not arise.

`docker-compose.yml` is the local stack; `docker-compose.prod.yml` is an
overlay that removes the published ports, adds nginx, and builds the browser
bundle against the public URL. `scripts/deploy.sh` runs both against the
server over SSH.

`NEXT_PUBLIC_` variables are substituted into the browser bundle at **build**
time, which is why the public URL is a Docker build argument and not only a
runtime variable. Changing it means rebuilding, not restarting.

---

## 6. Design system (`packages/ui`)

```
packages/ui/
├── components/  the public barrel, with the RTL wrappers
├── primitives/  shadcn/Radix building blocks — the only place Radix is imported
├── patterns/    composed, reusable pieces (SectionHeader, ThemeToggle)
├── icons/       the dynamic icon loader
├── tokens/      colors, typography, spacing, radius, shadows
└── styles/      the shared base layer
```

Apps import from `@hamdastan/ui`. Importing `radix-ui` anywhere but
`packages/ui/primitives` is a lint error: the wrappers are what set `dir` on
portalled content, and a primitive imported directly skips them.

### shadcn only

`primitives/` holds shadcn/ui's components, as shadcn ships them. **Where one
exists, it is used** — `Button`, `Input`, `Label`, `Form`, `InputOTP`,
`Select`, `ToggleGroup`, `Alert`, `Separator`, the Sonner `Toaster`. A
hand-written equivalent loses the keyboard handling and the ARIA wiring that
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
- **`Dialog` and `Sheet` are capped at `--shell-max-width`** and positioned
  against the column rather than the browser. They are portalled to `<body>`,
  outside `MobileShell`, so without it a panel would slide in from the edge of
  a laptop screen while the app it belongs to sat in the middle.

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

The surfaces are tinted toward the brand hue rather than neutral grey, so a
violet primary sits on a screen that shares its hue instead of on a grey page.
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

The whole colour system has one input: `--brand-hue` and `--brand-saturation`
at the top of `tokens.css`. The brand ramp, `--primary` and `--success` all
derive from them.

---

## 7. Graphics

| | |
| --- | --- |
| `assets/` | Design **sources** — PSD, AI, Figma exports, master SVGs. Never served, never imported by application code. |
| `apps/<app>/public/` | **Runtime** files the browser loads: `images/{brand,worlds,badges,avatars,backgrounds,placeholders}`, `icons/`, `fonts/`. |

Exporting from `assets/` into `public/` is a deliberate step. Nothing under
`assets/` reaches a bundle.

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
