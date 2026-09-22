#!/bin/bash
set -e

# ─── hamdastan — first-run setup ──────────────────────────────
# Gets a fresh clone to a running dev server.

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BOLD}${GREEN}🔧 hamdastan setup${NC}\n"

# ─── Environment file ─────────────────────────────────────────

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "  ✓ Created .env from .env.example"
else
  echo "  ⏭ .env already exists, skipping"
fi

# ─── Dependencies ─────────────────────────────────────────────

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
echo "Next steps:"
echo "  npm run dev      # http://localhost:3000"
echo ""
echo "SKIP_AUTH=true in .env signs you in as a mock admin."
echo "Set it to false to use the login form: admin / admin123"
echo ""
