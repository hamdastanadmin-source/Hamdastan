# CLAUDE.md - {{PROJECT_NAME}}

## Beads-First Workflow (MANDATORY)

**Every task MUST go through beads (`bd`). No exceptions. No feature, fix, or refactor may happen without a tracked beads issue.**

When the user asks you to do anything (feature, bugfix, refactor, chore), follow this exact sequence:

### 1. Define in Beads
- Search existing issues first: `bd search "<keywords>"` or `bd list --status=open`
- If an existing issue matches, use it. Otherwise create one:
  ```bash
  bd create --title="<concise title>" --description="<what and why>" --type=<bug|feature|task|chore> --priority=<0-4>
  ```
- If the user references a specific issue ID, use `bd show <id>` to understand it first.

### 2. Claim and Start
- Claim the issue: `bd update <id> --claim`
- This marks it `in_progress` and assigns it to you.

### 3. Implement
- Do the work. If you discover related work, create linked issues:
  ```bash
  bd create --title="..." --description="..." --type=task --deps discovered-from:<parent-id>
  ```
- Do NOT scope-creep the current issue.

### 4. Verify
- Run `npm run build` (covers TypeScript checks).
- Run `npm run lint:all` for non-trivial changes.
- Test the feature manually or describe what you tested.

### 5. Ask Before Closing (CRITICAL)
- **NEVER close an issue without explicit user approval.**
- After implementation and verification, report to the user:
  - What was done
  - What was tested
  - The beads issue ID
- Wait for the user to say it can be closed.
- Only then: `bd close <id> --reason="<summary>"`

### 6. Update PRD (on close)
- After an issue is closed, check if the change affects product scope (new feature, changed behavior, new module, new route, changed data model).
- If yes, update `docs/PRD.md` to reflect the change. Keep it concise — PRD is a living reference, not a changelog. Update the `Last Updated` date.
- If no (pure bugfix, internal refactor, style change), skip this step.

### Quick Reference
```bash
bd ready                    # Find work with no blockers
bd list --status=open       # All open issues
bd show <id>                # Issue details
bd update <id> --claim      # Claim (in_progress + assign)
bd create --title="..." --description="..." --type=task --priority=2  # New issue
bd close <id> --reason="..."  # Close (ONLY after user approval)
bd search "<query>"         # Search issues
bd prime                    # Load full workflow context
```

### Beads Rules
- Use `bd` for ALL task tracking. Never use TodoWrite, markdown TODOs, or external trackers.
- Always claim before starting work.
- Always create an issue BEFORE writing code.
- Always ask the user before closing ANY issue, regardless of size.
- Use `--json` flag when you need to parse output programmatically.
- Do NOT use `bd edit` — it opens an interactive editor that blocks agents.

---

## Product Context

**`docs/PRD.md` is the single source of truth** for what this product is, how it works, and what it includes. Read it before making architectural decisions or adding features. Keep it updated (see step 6 above).

---

## Critical Coding Rules

### UI & Layout
- **RTL-first**: All UI must be RTL-safe. Primary language is Persian (Farsi), locale `fa-IR`.
- **UI wrappers**: Always use local wrappers from `@/components/UiComponents` or `@/components/ui/*` — never import directly from `@parto-system-design/ui`.
- **Imports**: Use `@/*` path alias. Never relative paths that go more than one level up.

### Database Safety
- **NEVER** run `prisma db push --force-reset`.
- **ALWAYS** run `prisma db pull` before schema changes to avoid dropping legacy tables.
- New tables use `v2_` prefix only. Existing tables are untouched.
- See `RULES.md` for full database constraints.

### Architecture
- **Services** (`src/services/`) hold all business logic — never put it in components or actions.
- **Server Actions** (`src/actions/`) are thin wrappers that call services.
- **Naming**: camelCase for variables/functions, PascalCase for components/types, kebab-case for files.

---

## Tooling — When to Use What

Use the right tool for the job. Don't wait for the user to ask — proactively reach for these when the context matches.

### MCP Servers

| MCP | When to use |
|-----|-------------|
| **Context7** | Before writing code that uses **Next.js, React, Tailwind, Prisma, or any npm library** APIs. Use `resolve-library-id` → `get-library-docs` to get current docs. Especially important for: new component patterns, middleware, metadata API, Prisma schema/client changes, Tailwind v4 classes. Skip for trivial edits (typos, config tweaks, string changes). |
| **Prisma** | When working on **database schema, migrations, or data model** questions. Use it to introspect the current schema, understand relations, or generate queries — before manually reading `schema.prisma`. |
| **Playwright** | When the user asks to **test, verify, or interact with the running web app** in a browser. Use for visual verification, form testing, screenshot capture, and debugging UI behavior at `localhost:3000`. |

### Skills (invoke via `/skill-name` or proactively via Skill tool)

| Skill | When to use |
|-------|-------------|
| **next-best-practices** | When creating or modifying **pages, layouts, routes, server components, metadata, error boundaries, loading states, or API routes**. Invoke before implementing to get current Next.js patterns right. |
| **shadcn** | When **adding, composing, or fixing UI components** from shadcn/ui. Use for component search, docs, and usage examples. |
| **ui-ux-pro-max** | When making **design decisions** — color palettes, spacing, layout structure, responsive design, dark mode, RTL considerations. Use for building new pages or redesigning existing UI. |
| **playwright-best-practices** | When **writing or fixing Playwright tests** — selectors, assertions, POM patterns, flaky test debugging, CI config. |
| **webapp-testing** | When needing to **visually verify** the running app — take screenshots, check UI state, debug rendering issues in the browser. |
| **supabase-postgres-best-practices** | When writing or optimizing **SQL queries, indexes, or schema design** — especially for performance-sensitive operations. |
| **simplify** | After completing implementation — invoke `/simplify` to **review changed code** for reuse opportunities, quality issues, and efficiency improvements before reporting done. |

### Decision Flow

```
About to write framework-dependent code?
  → Context7: fetch latest docs first

Touching database schema or queries?
  → Prisma MCP for introspection
  → supabase-postgres-best-practices for optimization

Building or modifying UI?
  → shadcn for component patterns
  → ui-ux-pro-max for design decisions
  → next-best-practices for page/layout structure

Done implementing?
  → simplify to review quality
  → webapp-testing to visually verify if UI changed
```
