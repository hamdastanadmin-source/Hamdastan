# syntax=docker/dockerfile:1.7
#
# Build context is the MONOREPO ROOT, not this directory:
#   docker build -f apps/web/Dockerfile .
# The app depends on the workspace packages, so the whole tree has to be in
# the context for the install and the build to resolve them.

FROM node:20-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000

# ── Iranian Mirror: replace Debian sources ────────────────────
# deb.debian.org is unreachable from Iranian IaaS providers.
# Replace with an Iranian Debian mirror before apt-get.
# Alternatives if this one doesn't work:
#   - mirror.iranserver.com
#   - repo.iut.ac.ir
#   - mirror.pars.host
# RUN sed -i 's|deb.debian.org|mirror.arvancloud.ir|g' /etc/apt/sources.list.d/debian.sources \
RUN apt-get -o Acquire::Check-Valid-Until=false update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# ── Dependencies ──────────────────────────────────────────────
# Every workspace manifest is copied first so this layer is cached until one
# of them actually changes.
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

# ── Build ─────────────────────────────────────────────────────
FROM base AS builder

# NEXT_PUBLIC_ variables are substituted into the browser bundle during the
# build, so they have to arrive as build arguments — setting them at run time
# is too late and leaves the development defaults baked in.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WEB_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_WEB_BASE_URL=$NEXT_PUBLIC_WEB_BASE_URL

# The whole tree, not just the root node_modules: npm nests a dependency under
# its workspace (apps/web/node_modules) when versions conflict, and leaving
# those out fails the build with "module not found".
COPY --from=deps /app ./
COPY . .

RUN npm run build --workspace @hamdastan/web

# ── Runtime ───────────────────────────────────────────────────
FROM base AS runner

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# `outputFileTracingRoot` is the monorepo root, so the bundle *contents* keep
# the workspace layout — the server sits at apps/web/server.js with the
# hoisted node_modules beside it. The bundle itself, though, is written under
# the app's own .next/, which is why the source path below is
# apps/web/.next/standalone and not /app/.next/standalone.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000 \
    HOSTNAME=0.0.0.0

# No migrations to run — there is no database yet. When one is added,
# reintroduce an entrypoint script that applies migrations before this.
CMD ["node", "apps/web/server.js"]
