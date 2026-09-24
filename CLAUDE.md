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
- Colours come from one place: `--brand-hue` and `--brand-saturation` at the top
  of `packages/ui/tokens/tokens.css`. The brand scale, `--primary` and
  `--success` all derive from them. Change the hue, not the individual colours.
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

`apps/web/src/features/auth/services/session.service.ts` is a skeleton: users
and sessions are in memory, passwords are plain text, and nothing survives a
restart. It is deliberately the only module that knows this. When a real backend
arrives, rewrite the bodies there and leave the exported signatures
(`getSession`, `requireAuth`, `requireAdmin`, `login`, `logout`) alone.

It still lives in the web app rather than in `apps/api/src/modules/auth`, which
is a skeleton. Moving it is a separate task: the in-memory session store cannot
simply be split across two processes.

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
- `npm run test:e2e` — end-to-end tests (Playwright). Starts its own dev server
  with `SKIP_AUTH=false` so the real login flow is exercised.

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
