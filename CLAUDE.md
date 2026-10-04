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
- Colours come from one place: the variables at the top of
  `packages/ui/tokens/tokens.css`. The brand scale and `--primary` derive from
  `--brand-hue` and `--brand-saturation`; change the hue, not the individual
  colours.
- **Violet (the brand) is for the primary action only** — the one main button
  on a screen. Never for surfaces, borders, focus rings, tabs, chips,
  selected states, icons, progress/XP bars or glows; those are neutral
  (selection = foreground border + check). Success is green. The one
  exception: a `Switch`'s "on" track is the stock `primary`.
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

**Sign-in is passwordless and lives in `apps/api`.** A mobile number, a
six-digit code, and two `httpOnly` cookies. `docs/PRD.md` §4.1 and §5 are the
specification; `RULES.md` §4–6 are the rules that must not be broken.

Three things are easy to get wrong here:

- **The account is created when the code verifies**, not when the profile form
  is submitted. Somebody who abandons the form still has a verified number on
  file and comes back to the same account.
- **The client never decides where a user goes.** Every session response
  carries `nextStep`; `apps/web/src/proxy.ts` obeys it. Do not add a "looks
  complete" check in a component.
- **`OTP_DEBUG_DISPLAY` is the only thing standing between the flow and an SMS
  provider.** When Kaveh-Negar is connected, set `SMS_PROVIDER=kavenegar` and
  turn the echo off; no code changes.

`apps/web/src/features/auth/services/session.service.ts` no longer stores
anything — it forwards the request's cookies to `GET /me`. `apps/admin` still
has its own username/password story; moving that into `apps/api` is a separate
task.

### Screens

The product is a mobile app wherever it is opened — on a laptop it is the same
phone screen, centred, not a dashboard. `docs/ARCHITECTURE.md` §3 and §6 are
authoritative; the four rules that get broken most often:

- Every screen renders inside `MobileShell`, the **only file in `apps/web`
  allowed to contain a breakpoint**. Do not put `sm:`, `md:`, `lg:` or a width
  cap in a page — write it for one width. Anything that portals out of the
  column (toast, sheet, overlay) is constrained to `max-w-shell` where it is
  used.
- Use `Screen` / `ScreenHeader` / `ScreenBody` / `ScreenFooter` rather than a
  new layout. The footer is `sticky`, never `fixed`.
- Where shadcn has a component, use it — `Button`, `Input`, `Label`, `Form`,
  `InputOTP`, `Select`, `ToggleGroup`, `Alert`, `Separator`, `Toaster`.
  Restyle it with token utilities; do not rewrite it. Validation state comes
  from `Form` setting `aria-invalid`, which the stock controls react to.
- Never name a colour in a page. The token, through the Tailwind utility.

### Database

**PostgreSQL, reached through `pg`.** No ORM — repositories write SQL against
the pool in `apps/api/src/data`. Do not add one (Prisma, Drizzle, TypeORM,
Sequelize, Mongoose) without being asked.

- `apps/api/src/data` is the only place that opens a connection, and only a
  module's `*.repository.ts` may import it. A service that writes SQL has
  collapsed two layers that exist to be separable.
- `pg` is a dependency of `apps/api` alone. Nothing in `apps/web`,
  `apps/admin` or `packages/` may import it.
- The schema is `database/migrations/*.sql`, applied with `npm run db:migrate`.
  **An applied migration is never edited** — the runner checksums them and
  refuses a changed file. A schema change is a new file, and new tables take
  the `v2_` prefix.
- **Never apply a migration by hand or edit `v2_migrations`.** `db:migrate`
  compares the live schema with `database/schema/snapshot.txt` and fails on
  drift; a new migration needs `npm run db:snapshot` and the updated snapshot
  committed with it.
- Until a module binds an implementation with `set<Module>Repository(...)` in
  `server.ts`, its repository throws 501. That is the expected state of most
  modules; they are still skeletons.

`database/README.md` has the wiring steps; `RULES.md` §1 has the data-safety
constraints.

### Deployment

The stack runs on one Ubuntu host as three containers behind nginx, which is
the only published port: `:80` serves the product at `/` and the API at
`/api/v1`. `./scripts/deploy.sh` rsyncs the source, uploads
`deploy/.env.production` as the server's `.env`, and rebuilds there.

`NEXT_PUBLIC_` variables are baked into the browser bundle at **build** time,
so changing the public URL means a rebuild, not a restart. That is why
`PUBLIC_BASE_URL` is a Docker build argument in `docker-compose.prod.yml`.

Never commit `deploy/.env.production`, and never ship the root `.env` to a
server — it is a development environment.

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
- `npm test` — unit tests (Vitest). `apps/api` also runs the sign-in flow
  against a real PostgreSQL built from the migrations; it needs
  `TEST_DATABASE_URL` (a throwaway `*_test` database — `createdb
  hamdastan_test`) and skips without it. It resets that schema every run.
- `npm run db:migrate` — applies pending migrations. Safe to re-run.
- `npm run test:e2e` — end-to-end tests (Playwright), at 390×844 and
  1440×900. It starts its own `apps/web` dev server. The specs that walk the
  sign-in flow need `apps/api` running against a migrated database with
  `OTP_DEBUG_DISPLAY=true`; without it they **skip with a reason** rather than
  passing vacuously.

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
