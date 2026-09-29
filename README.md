# Hamdastan

RTL-first (Persian/Farsi) product built with Next.js 16, React 19, Tailwind
CSS 4 and shadcn/ui, as an npm-workspaces monorepo.

## Quick Start

```bash
./setup.sh          # or: npm install && cp .env.example .env
npm run dev         # apps/web    → http://localhost:3000
```

The other two apps run the same way:

```bash
npm run dev:admin   # apps/admin  → http://localhost:3001
npm run dev:api     # apps/api    → http://localhost:4000/health
```

Or the whole stack: `docker compose up --build`.

There is **one** `.env`, at the repo root. Next only reads the app's own
directory, so `setup.sh` symlinks `apps/web/.env` and `apps/admin/.env` to it —
edit the root file and both apps see the change. `apps/api` reads the same file
via `--env-file-if-exists`, and `docker compose` via `env_file`.

`.env.example` ships with `OTP_DEBUG_DISPLAY=true`, so the sign-in flow works
without an SMS gateway: the six-digit code is returned by the API and shown on
the verification screen. Sign in with any valid-looking mobile number while
building UI.

There are no seed credentials: the product has no passwords. `apps/admin`
still signs in with a username and a password and is a separate story.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Front-end | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Fastify 5 (`apps/api`), layered route → controller → service → repository |
| UI Components | shadcn/ui (Radix) behind RTL-safe wrappers in `packages/ui` |
| Validation | zod, shared between front-end and backend |
| Database | PostgreSQL 17 via `pg`, no ORM — see `database/README.md` |
| Auth | Cookie sessions, in-memory skeleton (`apps/web/src/features/auth`) |
| Deployment | Docker Compose behind nginx, one host — see `deploy/` |

## Project Structure

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
├── assets/         design sources (PSD/AI/Figma) — never served
├── database/       PostgreSQL schema: migrations, seeds
├── deploy/         the production stack: nginx, the server's environment
├── docs/           PRD, architecture, checklists
├── e2e/            Playwright, drives the real apps
└── scripts/
```

**`docs/ARCHITECTURE.md` says where every kind of file goes.** Read it before
adding one.

## Scripts

Run from the repo root; they cover every workspace.

| Command | Description |
|---------|-------------|
| `npm run dev` / `dev:admin` / `dev:api` | Start one app |
| `npm run build` | Production build of every app |
| `npm run typecheck` | TypeScript across every workspace |
| `npm run lint` | ESLint, including the architecture boundaries |
| `npm run lint:rtl` | RTL violations and stray Radix imports |
| `npm run lint:all` | Both linters |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run db:migrate` | Applies pending migrations; safe to re-run |
| `./scripts/deploy.sh` | Builds and restarts the stack on the server |

## Features

- **RTL-first** — all UI is right-to-left safe, primary language Persian, with a
  lint rule that fails the build on physical direction utilities
- **Enforced architecture** — the layering rules in `docs/ARCHITECTURE.md` are
  ESLint rules, not conventions: a component cannot call `fetch`, a controller
  cannot reach a repository, an app cannot import another app
- **Dark & light mode** — `.dark` class on `<html>`, persisted to localStorage
  and applied before first paint, so there is no flash
- **Single-knob theming** — change `--brand-hue` in `packages/ui/tokens/tokens.css`
  and the whole brand scale follows
- **Persian typography** — Yekan Bakh variable font with line heights tuned for
  Persian
- **Component gallery** — every component rendered at `/components`
- **Security headers** — X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- **Docker ready** — standalone output, compose stack with health checks
- **One-command deploy** — `./scripts/deploy.sh` rsyncs the source and rebuilds
  on the server, behind nginx on a single published port

## Database

PostgreSQL, reached from `apps/api` alone through `pg`. There is no ORM:
repositories write SQL against the pool in `apps/api/src/data`.

```bash
npm run db:migrate   # applies database/migrations/*.sql; safe to re-run
```

An applied migration is **never** edited — the runner checksums them and
refuses a file that has changed. A schema change is a new file. See
`database/README.md`, and `RULES.md` §1 before writing one.

## Deployment

One host, three containers on a private network, and nginx as the only
published port:

```
:80 → nginx ─┬─ /api/v1/ → api:4000
             └─ /         → web:3000
```

```bash
cp deploy/env.production.example deploy/.env.production   # then fill it in
./scripts/deploy.sh
```

The script rsyncs the source over SSH, uploads `deploy/.env.production` as the
server's `.env`, builds the images there and waits for `/_up` to answer.
Nothing is destroyed — containers are replaced, and the database is a managed
instance the script never touches.

Because both apps are served from one origin, the browser calls the API on the
host it loaded the page from: the session cookie is first-party and CORS does
not arise. Pointing a domain at the server means changing `PUBLIC_BASE_URL`
and **redeploying** rather than restarting — `NEXT_PUBLIC_` variables are baked
into the browser bundle at build time.

## Theming

The colour system has one input. In `packages/ui/tokens/tokens.css`:

```css
--brand-hue: 142;        /* 0-360 on the HSL wheel */
--brand-saturation: 69%; /* 0% grey → 100% vivid */
```

The brand scale, `--primary` and `--success` all derive from those two values.
TypeScript consumers read the same tokens through `@hamdastan/ui/tokens`, which
references the custom properties rather than copying them.

## Adding UI components

```bash
npx shadcn@latest add <component>
```

Components land in `packages/ui/primitives/`. Check three things afterwards —
the CLI gets all of them wrong here:

1. It writes `import { cn } from "cn"` and installs a stray `cn` package. Change
   the import to `@hamdastan/shared/cn` and run `npm uninstall cn`.
2. It writes `@/components/ui/*` for sibling primitives. Change those to
   relative imports (`./button`).
3. Its components ship physical direction utilities. Run `npm run lint:rtl` and
   convert them to logical ones (`ms/me/ps/pe/start/end`).

Then export it from `packages/ui/components/index.tsx` so apps can reach it.

## Architecture Rules

`docs/ARCHITECTURE.md` has the full set. The short version:

- **Business logic never lives in a React component** — it belongs in a service
- **The front-end never calls the network directly** — every request goes
  through `src/services` to `apps/api`, and nowhere else
- **Data access never happens in a controller or a service** — only in a
  repository
- **Design values are never hard-coded** — they come from `packages/ui/tokens`
- **UI imports** go through `@hamdastan/ui`; Radix is imported only inside
  `packages/ui/primitives`
- **A feature is opaque** — import it as `@/features/<name>`, never past it
- **No circular dependencies, and no app imports another app**
