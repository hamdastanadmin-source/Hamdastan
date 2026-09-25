#!/bin/bash
set -e

# ─── Hamdastan — first-run setup ──────────────────────────────
# Gets a fresh clone of the monorepo to a running dev stack.

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BOLD}${GREEN}🔧 Hamdastan setup${NC}\n"

# ─── Environment file ─────────────────────────────────────────

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "  ✓ Created .env from .env.example"
else
  echo "  ⏭ .env already exists, skipping"
fi

# ─── Per-app .env links ───────────────────────────────────────
# Next reads .env from the app's own directory, not from the monorepo root.
# These symlinks give both apps the single root .env, so there is one file to
# edit and docker-compose's env_file keeps pointing at the same one.

for app in web admin; do
  if [[ ! -e "apps/$app/.env" ]]; then
    ln -s ../../.env "apps/$app/.env"
    echo "  ✓ Linked apps/$app/.env → .env"
  else
    echo "  ⏭ apps/$app/.env already exists, skipping"
  fi
done

# ─── Dependencies ─────────────────────────────────────────────
# One install at the root covers every workspace.

echo -e "\n${CYAN}Installing dependencies...${NC}"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
echo "  ✓ Dependencies installed"

# ─── Playwright browser (for npm run test:e2e) ────────────────

echo -e "\n${CYAN}Installing Playwright browser...${NC}"
npx playwright install chromium || echo "  ⚠ Skipped — run 'npx playwright install chromium' before npm run test:e2e"

# ─── Done ─────────────────────────────────────────────────────

echo -e "\n${BOLD}${GREEN}✅ Ready.${NC}\n"
echo "Start the product:"
echo "  npm run dev          # apps/web :3000 + apps/api :4000, together"
echo ""
echo "Or one at a time:"
echo "  npm run dev:web      # apps/web    http://localhost:3000"
echo "  npm run dev:api      # apps/api    http://localhost:4000/health"
echo "  npm run dev:admin    # apps/admin  http://localhost:3001"
echo ""
echo "Or the whole stack:  docker compose up --build"
echo ""
echo "Sign-in is by mobile number and a 4-digit code. There is no SMS gateway"
echo "yet, so with SHOW_DEV_OTP=true the code is shown on the verify screen"
echo "(and written to the apps/api log). There are no seed accounts — the first"
echo "number you type registers."
echo ""
