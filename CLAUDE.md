# CLAUDE.md — Hamdastan

## Product Context

**`docs/PRD.md` is the single source of truth** for what this product is, how it
works, and what it includes. Read it before making architectural decisions or
adding features, and keep it updated when a change affects product scope (a new
feature, changed behaviour, new module, new route, changed data model). Pure
bugfixes, internal refactors and style changes do not need a PRD update.

**`docs/ARCHITECTURE.md` is the single source of truth for where code goes.**
Read it before creating a file. If a new kind of file has no home there, add
the rule to that document before writing the code.

---

## Critical Coding Rules

### UI & Layout

- **RTL-first.** All UI must be RTL-safe. The primary language is Persian
  (Farsi), locale `fa-IR`.
- **Logical utilities only.** Use `ms/me/ps/pe/start/end`, never `ml/mr/pl/pr/
  left/right`. `npm run lint:rtl` enforces this. When a physical direction is
  genuinely correct — centring via `translate`, or an API whose contract names a
  physical edge such as `Sheet`'s `side` — put an `rtl-ok: <reason>` comment on
  the line or the line above it.
- **UI wrappers.** Import UI from `@hamdastan/ui`. Never import Radix
  primitives (`radix-ui`, `@radix-ui/*`) outside `packages/ui/primitives` — the
  wrappers there are what apply RTL defaults such as `dir` on portalled
  content. `lint` and `lint:rtl` both enforce this.
- **Imports.** Within an app, use the `@/*` path alias. Across workspaces, use
  the package name (`@hamdastan/ui`). Never relative paths that climb more than
  one level, and never a relative path into another workspace.

### Theming

- Dark mode is a `.dark` class on `<html>`, applied before first paint by
  `THEME_INIT_SCRIPT` and toggled through `packages/ui/tokens/theme.store.ts`.
  Both live in `packages/ui/tokens/` so the pre-paint script and `applyTheme`
  cannot drift. Each app's `globals.css` redefines the `dark:` variant to follow
  that class. Do not add `next-themes` — it would fight the same class.
- Colours come from one place: `--brand-hue`, `--brand-saturation` and
  `--brand-lightness` at the top of `packages/ui/tokens/tokens.css`. The brand
  scale and `--primary` derive from them — the brand is navy, `hsl(240 100% 25%)`
  = `#000080`. Change those three, not the individual colours.
- The semantic colours do **not** follow the brand: `--success` has its own
  `--success-hue` (green), alongside `--destructive-hue`, `--warning-hue` and
  `--info-hue`. Success means "this worked", not "this is us".
- **Never hard-code a design value.** In a `className`, use the Tailwind
  utility. Where a real CSS string is needed, import from
  `@hamdastan/ui/tokens` — those files reference the custom properties rather
  than copying them. If a value is missing, add it to `tokens.css` first.
- There is no `tailwind.config.ts`. Tailwind v4 is configured CSS-first through
  `@theme` in `tokens.css`.

### Architecture

`docs/ARCHITECTURE.md` is authoritative. The rules the linter enforces:

- **Business logic never lives in a React component.** A component renders;
  decisions belong in a service.
- **The front-end never calls the network directly.** `fetch` is banned in
  `app/`, `components/` and `stores/`. Requests go
  `component → hook → service → apiClient → apps/api`. The front-end talks to
  our backend and to nothing else.
- **Backend layering is one-way:** route → controller → service → repository →
  data layer. A route may not import a service; a controller may not import a
  repository.
- **Data access happens only in a repository.** That is the seam the (not yet
  chosen) data layer plugs into.
- **A feature is opaque.** Import it as `@/features/<name>` or
  `@/features/<name>/server`, never past those.
- **No app imports another app**, and no circular dependencies.
- **Naming.** camelCase for variables and functions, PascalCase for components
  and types, kebab-case for files. Backend modules use `<module>.<layer>.ts`.

### Authentication

Sign-in is passwordless: a mobile number, then a four-digit code. There are no
passwords or usernames anywhere in the product.

`apps/api/src/modules/auth` owns all of it — users, codes and sessions — and is
the only thing that decides anything. `apps/web/src/features/auth` renders the
steps; `services/session.service.ts` there reads the session cookie and asks the
backend who it belongs to, and exports `getSession`, `requireAuth` and
`requireAdmin` for server components. It stores nothing.

The session cookie is issued and cleared by `apps/api`, so signing in and
signing out are browser-to-backend calls. Clearing the cookie from the web app
would leave a usable session on the server.

Users and sessions live in memory: `createInMemoryAuthRepository()` in
`auth.repository.ts`, bound in `app.ts` and only when `NODE_ENV` is not
`production` — in production the slot stays empty and auth answers 501 rather
than silently serving a per-instance user store. Nothing survives a restart and
nothing is shared between processes. That function is deliberately the only place that
knows it — when a data layer arrives, implement `AuthRepository` against it,
bind it in `server.ts`, and delete the stand-in. The schema to build is in
`docs/architecture/auth-data-model.md`; session tokens must be stored hashed.

Delivery is an adapter (`apps/api/src/integrations/otp/`). Only a mock exists —
it logs the code. With `SHOW_DEV_OTP=true` outside production the backend echoes
the code into the response and the verify screen shows it, which is how the flow
is walked locally and in the e2e tests. The front-end never generates a code.

`npm run dev` starts both apps, because the login screen is useless without
`apps/api` — `npm run dev:web` and `npm run dev:api` run either half alone.

Read `docs/architecture/auth-flow.md` before changing any of it.

### Dates

The UI is Persian, so a date a user picks or reads is **Jalali**; a date that
crosses the wire or gets stored is **ISO Gregorian** (`YYYY-MM-DD`), because
that is what every other system understands. `packages/shared/format/jalali.ts`
is the only place that converts, and it asks the platform's own Persian calendar
(`Intl` with `ca-persian`) rather than implementing leap rules. Do not add a
date library without being asked.

### Database

**No database, ORM or persistence technology has been chosen.** Do not add one
without being asked — not Prisma, Drizzle, TypeORM, Sequelize, Mongoose or a
raw driver.

The seam it plugs into already exists: each backend module declares a
repository port in `apps/api/src/modules/<m>/<m>.repository.ts`, and
`apps/api/src/shared/repository.ts` binds an implementation at boot. Until one
is bound, a repository call throws 501. `database/README.md` has the wiring
steps; `RULES.md` has the safety constraints that apply the moment a schema
exists.

---

## Verifying Changes

Run these from the repo root; they cover every workspace.

Environment: one `.env` at the root. `apps/web/.env` and `apps/admin/.env` are
symlinks to it (created by `setup.sh`) because Next only reads the app's own
directory. Do not add a second real `.env` inside an app — it would silently
shadow the root one.

- `npm run build` — production build of both Next apps.
- `npm run typecheck` — TypeScript across every workspace, including `apps/api`.
- `npm run lint:all` — ESLint (architecture boundaries included) plus the RTL
  check. Run for non-trivial changes.
- `npm test` — unit tests (Vitest).
- `npm run test:e2e` — end-to-end tests (Playwright). Starts both `apps/web`
  and `apps/api`, because signing in is a conversation between them, with
  `SHOW_DEV_OTP=true` so the tests can read the code off the screen.

---

## Task Tracking with Beads (optional)

Beads (`bd`) is not currently wired into this project. If you adopt it, install
the CLI, run `bd init`, and follow this flow:

1. **Define.** Search first (`bd search "<keywords>"`, `bd list --status=open`).
   Reuse a matching issue, otherwise
   `bd create --title="..." --description="..." --type=<bug|feature|task|chore> --priority=<0-4>`.
2. **Claim.** `bd update <id> --claim` — marks it `in_progress` and assigns it.
3. **Implement.** Do the work. File discovered work as linked issues
   (`--deps discovered-from:<parent-id>`) rather than scope-creeping the current
   one.
4. **Verify.** Run the commands under *Verifying Changes* above.
5. **Ask before closing.** Never close an issue without explicit user approval.
   Report what was done, what was tested, and the issue ID, then wait. Only then
   `bd close <id> --reason="..."`.
6. **Update the PRD** if the change affected product scope.

Notes: always create the issue before writing code; use `--json` when parsing
output; do not use `bd edit`, which opens an interactive editor that blocks
agents.

---

## Tooling — When to Use What

| Tool | When to use |
|------|-------------|
| **Context7 MCP** | Before writing code against Next.js, React, Tailwind or any npm library API. `resolve-library-id` → `get-library-docs`. Especially for new component patterns, the metadata API, and Tailwind v4 classes. Skip for typos and config tweaks. |
| **Playwright MCP** | When asked to test, verify or interact with the running app in a browser — visual verification, form testing, screenshots, debugging UI behaviour at `localhost:3000`. |
| **shadcn** | When adding, composing or fixing shadcn/ui components. New components arrive via `npx shadcn@latest add <name>`. |
| **ui-ux-pro-max** | For design decisions — colour, spacing, layout, responsive behaviour, dark mode, RTL considerations. |
| **playwright-best-practices** | When writing or fixing Playwright tests — selectors, assertions, POM patterns, flaky test debugging. |
| **simplify** | After implementing, to review the changed code for reuse and quality before reporting done. |

### Adding a shadcn component

`npx shadcn@latest add <name>` works, but components land in
`packages/ui/primitives/` and the CLI gets three things wrong in this project:

1. It writes `import { cn } from "cn"` and installs a stray `cn` package.
   Rewrite the import to `@hamdastan/shared/cn` and `npm uninstall cn`.
2. It writes `@/components/ui/*` for sibling primitives. Change those to
   relative imports (`./button`).
3. Its components ship physical direction utilities (`right-4`, `pl-8`,
   `ml-auto`). Run `npm run lint:rtl` and convert them to logical ones.

Then export it from `packages/ui/components/index.tsx`.
