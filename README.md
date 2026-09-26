# Hamdastan

RTL-first (Persian/Farsi) product built with Next.js 16, React 19, Tailwind
CSS 4 and shadcn/ui, as an npm-workspaces monorepo.

## Quick Start

```bash
./setup.sh          # or: npm install && cp .env.example .env
npm run dev         # apps/web → :3000 and apps/api → :4000, together
```

`npm run dev` starts both because signing in is a conversation between them —
`apps/api` owns the codes, the users and the sessions, so with it down the login
screen can only report that it cannot reach the server. Either half runs alone
if you want it to:

```bash
npm run dev:web     # apps/web    → http://localhost:3000
npm run dev:api     # apps/api    → http://localhost:4000/health
npm run dev:admin   # apps/admin  → http://localhost:3001
```

Or the whole stack: `docker compose up --build`.

There is **one** `.env`, at the repo root. Next only reads the app's own
directory, so `setup.sh` symlinks `apps/web/.env` and `apps/admin/.env` to it —
edit the root file and both apps see the change. `apps/api` reads the same file
via `--env-file-if-exists`, and `docker compose` via `env_file`.

### Signing in to the product

Sign-in is passwordless: a mobile number, then a four-digit code.

There is no SMS gateway yet. `.env.example` ships with `SHOW_DEV_OTP=true`, so
the generated code is shown on the verify screen (and written to the `apps/api`
log). It is ignored when `NODE_ENV=production`.

There are no seed accounts — the store starts empty, so the first number you
type registers. `docs/architecture/auth-flow.md` has the whole flow.

### Signing in to the admin panel

The panel is a different door: a username and a password, and no way to
register. Run it with the backend:

```bash
npm run dev:api & npm run dev:admin    # → http://localhost:3001
```

Outside production `apps/api` seeds one admin, because admins cannot create
themselves:

| | |
| --- | --- |
| Username | `Admin` |
| Password | `Admin1234` |

It starts owing a password change, so the first thing it does is send you to
`/change-password` — that is the flow working, not a problem. The new password
needs 8+ characters with an uppercase letter, a lowercase letter, a digit and a
special character.

Creating an admin from the panel generates a six-digit temporary password and
"texts" it (the mock gateway writes it to the `apps/api` log).
`.env.example` ships with `SHOW_DEV_CREDENTIALS=true`, so it is also shown in
the dialog — ignored when `NODE_ENV=production`, like `SHOW_DEV_OTP`.

`docs/architecture/admin-auth-flow.md` has the whole flow.

### Forms & surveys

The panel's «فرم‌ها و نظرسنجی‌ها» builds forms; the product is where people
answer them. `apps/api` ships seeded Persian sample data — four forms, six
templates and forty-eight responses — so the dashboard, the builder and the
charts all show something real on a fresh checkout.

A published form is answered at `http://localhost:3000/forms/{id}`, which is the
link the panel's share dialog gives you. Try
`/forms/form-support-satisfaction`. `docs/architecture/forms-module.md` has the
whole module.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Front-end | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Fastify 5 (`apps/api`), layered route → controller → service → repository |
| UI Components | shadcn/ui (Radix) behind RTL-safe wrappers in `packages/ui` |
| Validation | zod, shared between front-end and backend |
| Database | **None chosen yet** — see `database/README.md` |
| Auth | Product: mobile number + one-time code (`modules/auth`). Panel: username + password (`modules/admin-auth`, `modules/admin-users`) |
| Deployment | Docker (standalone Next.js output), one image per app |

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
├── database/       foundation only; no database chosen yet
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
| `npm run dev` | Start the product: `apps/web` and `apps/api` together |
| `npm run dev:web` / `dev:api` / `dev:admin` | Start one app |
| `npm run build` | Production build of every app |
| `npm run typecheck` | TypeScript across every workspace |
| `npm run lint` | ESLint, including the architecture boundaries |
| `npm run lint:rtl` | RTL violations and stray Radix imports |
| `npm run lint:all` | Both linters |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |

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

## Theming

The colour system has one input. In `packages/ui/tokens/tokens.css`:

```css
--brand-hue: 240;         /* 0-360 on the HSL wheel */
--brand-saturation: 100%; /* 0% grey → 100% vivid */
--brand-lightness: 25%;   /* how dark the brand colour itself is */
```

Together they are `#000080`, navy. The brand scale and `--primary` derive from
them, in both themes. The semantic colours deliberately do not — `--success-hue`
keeps success green whatever the brand becomes, and sits beside
`--destructive-hue`, `--warning-hue` and `--info-hue`.

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
