#!/usr/bin/env bash
#
# Deploy the stack to the server.
#
#   ./scripts/deploy.sh
#
# What it does: copy the source over SSH, upload deploy/.env.production as the
# stack's .env, then build and start the containers on the server. The images
# are built there rather than here, so a workstation's architecture never
# matters and nothing has to be pushed to a registry.
#
# Where it deploys to comes from deploy/.env.production — DEPLOY_HOST,
# DEPLOY_USER, DEPLOY_PATH — or from the environment, which wins:
#
#   DEPLOY_HOST=203.0.113.10 ./scripts/deploy.sh
#
# Nothing is destroyed: containers are replaced, and the database lives on a
# managed instance this script never touches.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE="deploy/.env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  cat >&2 <<MSG
$ENV_FILE is missing.

It holds the environment the deployed stack runs with, including real
credentials, and is gitignored for that reason. Start from the template:

  cp deploy/env.production.example $ENV_FILE
MSG
  exit 1
fi

# Read the target out of the env file, letting a variable already in the
# environment win. Only these three are read — everything else in the file
# belongs to the containers, not to this script.
read_target() {
  local key="$1" fallback="$2" value="${!key:-}"

  if [[ -z "$value" ]]; then
    value="$(sed -n "s/^${key}=//p" "$ENV_FILE" | tail -1 | tr -d $'\r"\'')"
  fi

  printf '%s' "${value:-$fallback}"
}

DEPLOY_HOST="$(read_target DEPLOY_HOST '')"
DEPLOY_USER="$(read_target DEPLOY_USER 'root')"
DEPLOY_PATH="$(read_target DEPLOY_PATH '/srv/hamdastan')"

if [[ -z "$DEPLOY_HOST" ]]; then
  echo "DEPLOY_HOST is not set — put it in $ENV_FILE or pass it in." >&2
  exit 1
fi

TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"
SSH_OPTS=(-o ConnectTimeout=15)

echo "▸ deploying to ${TARGET}:${DEPLOY_PATH}"

ssh "${SSH_OPTS[@]}" "$TARGET" "mkdir -p '$DEPLOY_PATH'"

# ── Source ────────────────────────────────────────────────────
# Build inputs only. Anything generated — dependencies, Next output, test
# artefacts — is rebuilt inside the image, and design sources are never
# served. --delete so a file deleted here disappears there too; excluded
# paths are left alone rather than deleted.
echo "▸ syncing source"
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '*.tsbuildinfo' \
  --exclude 'test-results' \
  --exclude 'playwright-report' \
  --exclude 'e2e/.auth' \
  --exclude '.claude' \
  --exclude 'assets' \
  -e "ssh ${SSH_OPTS[*]}" \
  ./ "${TARGET}:${DEPLOY_PATH}/"

# ── Environment ───────────────────────────────────────────────
# Sent separately, and last, so a half-finished rsync can never leave the
# stack running against the wrong environment. 0600 because it holds the
# database password.
echo "▸ uploading environment"
scp "${SSH_OPTS[@]}" -q "$ENV_FILE" "${TARGET}:${DEPLOY_PATH}/.env"
ssh "${SSH_OPTS[@]}" "$TARGET" "chmod 600 '$DEPLOY_PATH/.env'"

# ── Build and start ───────────────────────────────────────────
echo "▸ building and starting containers"
ssh "${SSH_OPTS[@]}" "$TARGET" "cd '$DEPLOY_PATH' && \
  docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    up -d --build --remove-orphans && \
  docker image prune -f >/dev/null"

# ── Verify ────────────────────────────────────────────────────
# /_up is nginx's proxy to the API's readiness probe, so a 200 here means the
# proxy, the backend and the database are all answering.
echo "▸ waiting for the stack to report healthy"
for _ in $(seq 1 60); do
  if body="$(ssh "${SSH_OPTS[@]}" "$TARGET" "curl -fsS --max-time 5 http://127.0.0.1/_up" 2>/dev/null)"; then
    echo "▸ healthy: $body"
    ssh "${SSH_OPTS[@]}" "$TARGET" "cd '$DEPLOY_PATH' && docker compose -f docker-compose.yml -f docker-compose.prod.yml ps"
    exit 0
  fi
  sleep 5
done

echo "✗ the stack did not report healthy. Recent logs:" >&2
ssh "${SSH_OPTS[@]}" "$TARGET" "cd '$DEPLOY_PATH' && docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=60" >&2
exit 1
