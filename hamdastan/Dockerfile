# syntax=docker/dockerfile:1.7

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

# Build stage
FROM base AS builder

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci --prefer-offline --no-audit --no-fund; \
    else echo "Lockfile not found." && exit 1; \
    fi

COPY . .

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000 \
    HOSTNAME=0.0.0.0

# No migrations to run — there is no database yet. When one is added,
# reintroduce an entrypoint script that applies migrations before this.
CMD ["node", "server.js"]
