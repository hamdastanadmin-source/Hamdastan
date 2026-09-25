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
├── database/       foundation only; no database chosen yet
├── docs/
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
| A type the front-end and backend both use | `packages/types` |
| A type only one app uses | that app's `src/types` |
| A validation rule both sides apply | `packages/validation` |
| A helper one feature uses | that feature's `utils/` |
| A helper genuinely shared | `packages/shared` |
| A date shown to a user (Jalali) or stored (ISO Gregorian) | `packages/shared/format/jalali.ts` |
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
└── types/       types this app alone uses
```

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
├── __tests__/   unit tests for the above (optional)
├── index.ts     public, client-safe
└── server.ts    public, server-only (optional)
```

A feature's own unit tests go in its `__tests__/`, next to what they cover, and
import it by relative path. `apps/web/src/__tests__/` is for the app as a whole
— the test setup, MSW, anything that is not one feature's.

`index.ts` and `server.ts` are the feature's entire surface. Reaching past them
(`@/features/auth/hooks/use-auth`) is a lint error — it is what turns a feature
into a tangle. `auth` is the worked example; the rest are empty on purpose.

Splitting `index.ts` from `server.ts` keeps a client component from pulling
server-only code into its bundle. `apps/web/src/features/auth` shows the shape:
the flow, the provider and the hooks in `index.ts`, the session lookup and
route guards in `server.ts`. Its `/login` route renders `<AuthFlow />` and
passes it nothing, so the steps and their order stay inside the feature — see
`docs/architecture/auth-flow.md`.

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
├── integrations/  outbound adapters (SMS, payment, storage)
├── shared/        errors, the repository seam, response and request helpers
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

### Request validation

Fastify's own `schema` option takes JSON Schema, and no zod type provider is
wired up, so a module's `*.schema.ts` holds zod schemas and the **controller**
parses the body with them through `parseRequest` in `shared/validate.ts` — one
helper, so every module reports a malformed body with the same code and the same
`details` shape. Validation stays in the
HTTP layer, where it belongs, and the rules stay in `packages/validation`, so
the front-end and the backend cannot drift. `modules/auth` is the worked
example. If a zod type provider is added later, the schemas move into the route
declarations and the controllers stop parsing — the schemas themselves do not
change.

### Outbound adapters

`integrations/` is the outbound mirror of the repository seam: an interface per
capability, one implementation per vendor, chosen by environment in that
directory's `index.ts`. A service depends on the capability and never on the
vendor.

```
integrations/
└── otp/   delivery of one-time codes — mock only; no gateway contracted
```

The front-end never calls an external service itself. If the product needs one,
it goes here and `apps/api` exposes a route. See
`docs/architecture/auth-sms-integration.md`.

### The data layer seam

**No database, ORM or persistence technology has been chosen.** Nothing in the
repository assumes one, and the architecture is built so the choice can be made
later without touching business logic.

Each module declares its data needs as an interface — a *port* — in
`<module>.repository.ts`, written in the language of the domain
(`findActiveByWorld`), not of a store (`query`, `execute`). A service calls
`usersRepository()` and knows nothing more. Until an implementation is bound,
the call throws `DataLayerNotConfiguredError` (HTTP 501) rather than returning
fake data, so an unimplemented endpoint cannot pass for a working one.

`auth` is the exception, because the product cannot be used at all without it:
its `*.repository.ts` also exports `createInMemoryAuthRepository()`, a
development stand-in bound in `app.ts`. Binding it there rather than in
`server.ts` means the tests drive the same wiring the process does. A module may
ship such a stand-in in its port file, and only there — it is deleted when a real
data layer is bound. Its schema is designed in
`docs/architecture/auth-data-model.md`.

The binding is guarded by `!env.isProduction`: a stand-in that loses every user
on restart must not quietly serve traffic, so in production the slot stays empty
and the 501 above is what answers. A stand-in is a development convenience, and
the guard is what keeps it one.

Binding one later is three lines in `server.ts`:

```ts
setUsersRepository(new SqlUsersRepository(db));
```

No service, controller or route changes. See `database/README.md`.

---

## 5. Design system (`packages/ui`)

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

The whole colour system has one input: `--brand-hue`, `--brand-saturation` and
`--brand-lightness` at the top of `tokens.css`. The brand ramp and `--primary`
derive from them; the brand is navy, `#000080`.

The semantic colours are deliberately independent of it — `--success-hue`,
`--destructive-hue`, `--warning-hue` and `--info-hue` sit beside the brand
inputs, so a green success state survives a change of brand.

---

## 6. Graphics

| | |
| --- | --- |
| `assets/` | Design **sources** — PSD, AI, Figma exports, master SVGs. Never served, never imported by application code. |
| `apps/<app>/public/` | **Runtime** files the browser loads: `images/{brand,worlds,badges,avatars,backgrounds,placeholders}`, `icons/`, `fonts/`. |

Exporting from `assets/` into `public/` is a deliberate step. Nothing under
`assets/` reaches a bundle.

---

## 7. Checks

| Command | What it covers |
| --- | --- |
| `npm run typecheck` | TypeScript across every workspace |
| `npm run lint` | ESLint, including every boundary above |
| `npm run lint:rtl` | Logical utilities only; Radix confined to primitives |
| `npm test` | Vitest |
| `npm run build` | Production build of both Next apps |
| `npm run test:e2e` | Playwright against the real `apps/web` **and** `apps/api` |
