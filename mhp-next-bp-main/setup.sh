#!/bin/bash
set -e

# ─── Parto Project Boilerplate Setup ─────────────────────────
# This script initializes a new project from the boilerplate.
# It replaces all {{PLACEHOLDERS}} and sets up the environment.

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BOLD}${GREEN}🔧 Parto Project Boilerplate Setup${NC}\n"

# ─── Collect project info ─────────────────────────────────────

read -p "Project name (kebab-case, e.g. my-new-project): " PROJECT_NAME
if [[ -z "$PROJECT_NAME" ]]; then
  echo "Error: Project name is required."
  exit 1
fi

read -p "GitLab service name for Helm deploy (default: $PROJECT_NAME): " SERVICE_NAME
SERVICE_NAME="${SERVICE_NAME:-$PROJECT_NAME}"

# ─── Replace placeholders ────────────────────────────────────

echo -e "\n${CYAN}Replacing placeholders...${NC}"

# macOS-compatible sed (uses -i '' instead of -i)
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_CMD="sed -i ''"
else
  SED_CMD="sed -i"
fi

find . -type f \( -name "*.json" -o -name "*.yml" -o -name "*.yaml" -o -name "*.md" -o -name "*.ts" -o -name "*.tsx" -o -name "*.mjs" -o -name "*.sh" -o -name "*.css" \) \
  -not -path "./node_modules/*" \
  -not -path "./.next/*" \
  -not -path "./.claude/skills/*" \
  -exec $SED_CMD "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" {} \; 2>/dev/null

find . -type f \( -name "*.yml" -o -name "*.yaml" \) \
  -not -path "./node_modules/*" \
  -exec $SED_CMD "s/{{SERVICE_NAME}}/$SERVICE_NAME/g" {} \; 2>/dev/null

# Clean up macOS sed backup files
find . -name "*''" -delete 2>/dev/null

echo "  ✓ Placeholders replaced"

# ─── Environment file ─────────────────────────────────────────

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "  ✓ Created .env from .env.example (edit with your database credentials)"
else
  echo "  ⏭ .env already exists, skipping"
fi

# ─── Install dependencies ─────────────────────────────────────

echo -e "\n${CYAN}Installing dependencies...${NC}"
if [[ -f package-lock.json ]]; then
  npm ci --legacy-peer-deps
else
  npm install --legacy-peer-deps
fi
echo "  ✓ Dependencies installed"

# ─── Generate Prisma client ──────────────────────────────────

echo -e "\n${CYAN}Generating Prisma client...${NC}"
npx prisma generate
echo "  ✓ Prisma client generated"

# ─── Initialize Beads ─────────────────────────────────────────

echo -e "\n${CYAN}Initializing Beads issue tracker...${NC}"
if command -v bd &> /dev/null; then
  bd init 2>/dev/null || echo "  ⚠ Beads init failed (you can run 'bd init' manually later)"
else
  echo "  ⏭ Beads CLI not found (install it to use beads issue tracking)"
fi

# ─── Initialize Git ───────────────────────────────────────────

echo -e "\n${CYAN}Initializing Git repository...${NC}"
if [[ ! -d .git ]]; then
  git init
  git add -A
  git commit -m "Initial project from Parto boilerplate"
  echo "  ✓ Git initialized with initial commit"
else
  echo "  ⏭ Git already initialized"
fi

# ─── Done ─────────────────────────────────────────────────────

echo -e "\n${BOLD}${GREEN}✅ Project '$PROJECT_NAME' is ready!${NC}\n"
echo "Next steps:"
echo "  1. Edit .env with your database credentials"
echo "  2. Run: npx prisma migrate dev --name init"
echo "  3. Run: npx tsx prisma/seed.ts"
echo "  4. Run: npm run dev"
echo ""
echo "Default admin credentials: admin / admin123"
echo ""
