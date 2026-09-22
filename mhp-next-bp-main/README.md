# {{PROJECT_NAME}}

RTL-first (Persian/Farsi) web application boilerplate built with Next.js 16, React 19, Tailwind CSS 4, and Prisma.

## Quick Start

```bash
# 1. Run the setup script (replaces placeholders, installs deps)
./setup.sh

# 2. Configure your database
#    Edit .env with your PostgreSQL connection string

# 3. Create database tables
npx prisma migrate dev --name init

# 4. Seed default admin user
npx tsx prisma/seed.ts

# 5. Start development server
npm run dev
```

Default admin credentials: `admin` / `admin123`

### No Database? No Problem

Set `SKIP_AUTH=true` in `.env` to bypass authentication and run without a database. Useful for UI development and component previewing.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js Server Actions + API Routes |
| Database | PostgreSQL via Prisma ORM |
| UI Components | Parto Design System + custom RTL-safe components |
| Auth | Cookie-based sessions with bcrypt |
| Deployment | Docker (standalone Next.js output) |

## Project Structure

```
src/
  app/           # Next.js App Router pages and layouts
  actions/       # Server actions (thin wrappers calling services)
  services/      # Business logic (add your domain logic here)
  components/
    ui/          # Base UI components (Button, Card, Input, etc.)
    layout/      # Layout components (Sidebar, Header, ThemeToggle)
    common/      # Shared components (SectionHeader)
    UiComponents.tsx  # Central re-export with RTL wrappers
  lib/           # Utilities (auth, prisma, i18n, logger, fonts)
  types/         # TypeScript type definitions
prisma/          # Database schema and seed
e2e/             # Playwright end-to-end tests
docs/            # PRD and checklists
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:rtl` | Check for RTL violations (no physical ml/mr/pl/pr) |
| `npm run lint:all` | Run all linters |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |

## Features

- **RTL-first** — All UI is right-to-left safe, primary language Persian (Farsi)
- **Dark & Light mode** — Theme toggle with localStorage persistence, no flash
- **Authentication** — Cookie-based session auth with admin/analyst roles
- **Component library** — Battle-tested UI components at `/components`
- **Persian typography** — Yekan Bakh variable font with optimized line heights
- **Security headers** — X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- **Docker ready** — Dockerfile with standalone output, docker-compose template

## Placeholders

The following placeholders are replaced by `setup.sh`:

| Placeholder | Where | What |
|---|---|---|
| `{{PROJECT_NAME}}` | package.json, layout.tsx, CLAUDE.md, docker-compose.yml, docs/PRD.md | Project name (kebab-case) |
| `{{SERVICE_NAME}}` | .gitlab-ci.yml | Helm service name for K8s deploy |

## Architecture Rules

- **Services** hold all business logic — never in components or actions
- **Server Actions** are thin wrappers calling services
- **UI imports** always go through `@/components/UiComponents` or `@/components/ui/*`
- **Path alias** `@/*` maps to `./src/*` — no deep relative imports
- **Database** — new tables use `v2_` prefix; never force-reset
