# syntax=docker/dockerfile:1.7
#
# Build context is the MONOREPO ROOT:
#   docker build -f apps/api/Dockerfile .
#
# The API runs its TypeScript sources through tsx rather than compiling to
# dist/, because it imports the workspace packages as source. When the service
# grows past a skeleton, swap this for a bundle step.

FROM node:20-slim AS base

WORKDIR /app

ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000

FROM base AS deps

COPY package.json package-lock.json ./
COPY apps/web/package.json        apps/web/
COPY apps/admin/package.json      apps/admin/
COPY apps/api/package.json        apps/api/
COPY packages/ui/package.json         packages/ui/
COPY packages/types/package.json      packages/types/
COPY packages/shared/package.json     packages/shared/
COPY packages/config/package.json     packages/config/
COPY packages/validation/package.json packages/validation/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund

FROM base AS runner

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 api

COPY --from=deps --chown=api:nodejs /app/node_modules ./node_modules
COPY --chown=api:nodejs package.json ./
COPY --chown=api:nodejs apps/api ./apps/api
COPY --chown=api:nodejs packages ./packages

USER api

EXPOSE 4000

ENV API_PORT=4000 \
    API_HOST=0.0.0.0

CMD ["node_modules/.bin/tsx", "apps/api/src/server.ts"]
