# hamdastan

RTL-first (Persian/Farsi) web application built with Next.js 16, React 19,
Tailwind CSS 4 and shadcn/ui.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

The app runs at http://localhost:3000.

`.env.example` ships with `SKIP_AUTH=true`, which bypasses the login screen and
signs you in as a mock admin — convenient while building UI. Set it to `false`
to exercise the real login flow.

Seed credentials: `admin` / `admin123` (admin) and `analyst` / `analyst123`
(analyst).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js Server Actions + API Routes |
| UI Components | shadcn/ui (Radix) with local RTL-safe wrappers |
| Database | None yet — see `RULES.md` before adding one |
| Auth | Cookie sessions, in-memory skeleton (see `src/lib/auth.ts`) |
| Deployment | Docker (standalone Next.js output) |

## Project Structure

```
src/
  app/           # App Router pages and layouts
  actions/       # Server actions (thin wrappers calling services)
  services/      # Business logic (add your domain logic here)
  components/
    ui/          # Base UI components — shadcn/ui plus local ones
    layout/      # Sidebar, Header, ThemeToggle, providers
    common/      # Shared components (SectionHeader)
    UiComponents.tsx  # Central barrel with RTL wrappers
  lib/           # Utilities (auth, theme, i18n, logger, fonts, format)
  types/         # TypeScript type definitions
  __tests__/     # Unit tests (Vitest) and MSW setup
e2e/             # Playwright end-to-end tests
docs/            # PRD and checklists
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (includes TypeScript checking) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:rtl` | Check for RTL violations and direct Radix imports |
| `npm run lint:all` | Run all linters |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |

## Features

- **RTL-first** — all UI is right-to-left safe, primary language Persian, with a
  lint rule that fails the build on physical direction utilities
- **Dark & light mode** — `.dark` class on `<html>`, persisted to localStorage
  and applied before first paint, so there is no flash
- **Single-knob theming** — change `--brand-hue` in `globals.css` and the whole
  brand scale follows
- **Persian typography** — Yekan Bakh variable font with line heights tuned for
  Persian
- **Component gallery** — every component rendered at `/components`
- **Security headers** — X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- **Docker ready** — standalone output, compose file with a health check

## Theming

The colour system has one input. In `src/app/globals.css`:

```css
--brand-hue: 142;        /* 0-360 on the HSL wheel */
--brand-saturation: 69%; /* 0% grey → 100% vivid */
```

The brand scale, `--primary` and `--success` all derive from those two values.

## Adding UI components

```bash
npx shadcn@latest add <component>
```

Then check two things — the CLI gets both wrong here:

1. It writes `import { cn } from "cn"` and installs a stray `cn` package. Change
   the import to `@/lib/utils` and run `npm uninstall cn`.
2. Its components ship physical direction utilities. Run `npm run lint:rtl` and
   convert them to logical ones (`ms/me/ps/pe/start/end`).

## Architecture Rules

See `CLAUDE.md` for the full set. The short version:

- **Services** hold all business logic — never in components or actions
- **Server Actions** are thin wrappers calling services
- **UI imports** go through `@/components/UiComponents` or `@/components/ui/*`;
  Radix primitives are only imported inside `src/components/ui`
- **Path alias** `@/*` maps to `./src/*` — no deep relative imports
- **Logical CSS properties only** — enforced by `npm run lint:rtl`
