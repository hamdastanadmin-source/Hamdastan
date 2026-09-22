# CLAUDE.md — hamdastan

## Product Context

**`docs/PRD.md` is the single source of truth** for what this product is, how it
works, and what it includes. Read it before making architectural decisions or
adding features, and keep it updated when a change affects product scope (a new
feature, changed behaviour, new module, new route, changed data model). Pure
bugfixes, internal refactors and style changes do not need a PRD update.

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
- **UI wrappers.** Import UI from `@/components/UiComponents` or
  `@/components/ui/*`. Never import Radix primitives (`radix-ui`,
  `@radix-ui/*`) outside `src/components/ui` — the wrappers there are what apply
  RTL defaults such as `dir` on portalled content. `lint:rtl` enforces this too.
- **Imports.** Use the `@/*` path alias. Never relative paths that climb more
  than one level.

### Theming

- Dark mode is a `.dark` class on `<html>`, applied before first paint by the
  inline script in `src/app/layout.tsx` and toggled through `src/lib/theme.ts`.
  `globals.css` redefines the `dark:` variant to follow that class. Do not add
  `next-themes` — it would fight the same class.
- Colours come from one place: `--brand-hue` and `--brand-saturation` at the top
  of `src/app/globals.css`. The brand scale, `--primary` and `--success` all
  derive from them. Change the hue, not the individual colours.
- There is no `tailwind.config.ts`. Tailwind v4 is configured CSS-first through
  `@theme` in `globals.css`.

### Architecture

- **Services** (`src/services/`) hold all business logic — never in components
  or actions.
- **Server Actions** (`src/actions/`) are thin wrappers that call services.
- **Naming.** camelCase for variables and functions, PascalCase for components
  and types, kebab-case for files.

### Authentication

`src/lib/auth.ts` is a skeleton: users and sessions are in memory, passwords are
plain text, and nothing survives a restart. It is deliberately the only module
that knows this. When a real backend arrives, rewrite the bodies there and leave
the exported signatures (`getSession`, `requireAuth`, `requireAdmin`, `login`,
`logout`) alone.

### Database

There is no database or ORM yet. `RULES.md` records the constraints that apply
the moment one is added — read it before introducing a schema.

---

## Verifying Changes

- `npm run build` — production build, includes TypeScript checking.
- `npm run lint:all` — ESLint plus the RTL check. Run for non-trivial changes.
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

`npx shadcn@latest add <name>` works, but check two things afterwards, because
the CLI gets both wrong in this project:

1. It writes `import { cn } from "cn"` and installs a stray `cn` package.
   Rewrite the import to `@/lib/utils` and `npm uninstall cn`.
2. Its components ship physical direction utilities (`right-4`, `pl-8`,
   `ml-auto`). Run `npm run lint:rtl` and convert them to logical ones.
