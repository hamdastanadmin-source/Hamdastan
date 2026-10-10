# Deployment runbook — security and reliability release

The release that adds the trusted proxy, rate limits, retries and timeouts,
idempotent submissions, session lifetimes and management, admin roles, CSRF
checks and the nginx gateway hardening (migrations `0011`–`0014`).

Everything here runs **on the production server or against the production
database**. Each step needs the operator's explicit go-ahead; none of it has
been run. The commands assume the stack lives in `/srv/hamdastan` (the
`DEPLOY_PATH` in `deploy/.env.production`) and use this alias:

```bash
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
```

---

## 0. Immediate mitigation — before any release

Production today runs with `OTP_DEBUG_DISPLAY=true` and `SMS_PROVIDER=console`:
the API returns every one-time code to whoever asks for it, product and admin
alike, and the admin API is public through nginx. This is independent of the
release and should be closed first.

1. Get Kaveh-Negar credentials (`KAVENEGAR_API_KEY`, the verify template).
2. Edit **both** copies of the environment — the server's and the local
   source, or the next `deploy.sh` uploads the old value again:

   ```bash
   # local: deploy/.env.production   and   server: /srv/hamdastan/.env
   OTP_DEBUG_DISPLAY=false
   SMS_PROVIDER=kavenegar
   KAVENEGAR_API_KEY=<key>
   KAVENEGAR_TEMPLATE=<template>
   ```

3. Recreate the API only — `env_file` is read when a container is created,
   so a `restart` is not enough; no build is needed:

   ```bash
   cd /srv/hamdastan && dc up -d --no-deps --force-recreate api
   ```

4. Verify with a number you own: the response has no `debugCode`, the SMS
   arrives.

   ```bash
   curl -s -X POST -H 'Content-Type: application/json' \
     -d '{"phone":"09XXXXXXXXX"}' https://hamdaastaan.ir/api/v1/auth/otp/request
   ```

**Without Kaveh-Negar**, setting only `OTP_DEBUG_DISPLAY=false` stops the
response leak but leaves sign-in impossible — and the *current* code still
writes codes to the container log with `SMS_PROVIDER=console`. The new
release closes that too (console is never bound in production; requests
answer 503), but it cannot make sign-in work without a provider.

---

## 1. Go criteria

All of these, before step 2:

| | Check |
|---|---|
| ☐ | Step 0 done; Kaveh-Negar sends codes in production |
| ☐ | `npm run typecheck`, `npm run lint:all`, `npm test`, `npm run build` pass on the release commit |
| ☐ | The release is committed and the commit hash noted (it is what a rollback returns from) |
| ☐ | The previous production commit is noted (it is what a rollback returns to) |
| ☐ | A database backup taken in step 2 |
| ☐ | `10.250.250.0/29` is free on the host (step 2) |
| ☐ | nginx config validated on the server (step 2) |
| ☐ | A quiet hour; someone watching for 30 minutes after |

---

## 2. Pre-flight (server, read-only apart from the backup)

```bash
# Backup — the arvandbaas host is reached through the server (see database/README.md).
pg_dump --no-owner --no-privileges "$PROD_DATABASE_URL" > hamdastan-$(date +%F-%H%M).sql

# The edge network's range must not be in use.
docker network ls -q | xargs docker network inspect -f '{{.Name}} {{range .IPAM.Config}}{{.Subnet}}{{end}}'
ip route | grep -F 10.250.250. || echo "10.250.250.0/29 free"
# If it collides: set EDGE_SUBNET and NGINX_EDGE_IP in deploy/.env.production.
```

Validate the **new** nginx config with the real certificate, before it
replaces the running one — copy the two files from the release to a temp
directory on the server first:

```bash
docker run --rm --add-host api-edge:127.0.0.1 --add-host web:127.0.0.1 \
  -v /tmp/release/nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  -v /tmp/release/nginx-api.inc:/etc/nginx/conf.d/hamdastan-api.inc:ro \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  nginx:1.27-alpine nginx -t
```

---

## 3. Deploy — staged

`./scripts/deploy.sh` does all of this in one go, and that is acceptable:
the migrations are additive and the old code runs on the new schema. The
staged version below is preferred because it separates the database change
from the code switch, so each can be watched on its own.

| Stage | What | Downtime | If it fails |
|---|---|---|---|
| 3.1 | Sync source and env, **build** images — nothing switches | none | nothing changed; fix and retry |
| 3.2 | **Migrate** with the new image while the old API keeps serving | none | the transaction rolls back; old API unaffected |
| 3.3 | **Switch** `api`, `web`, `admin` (creates the `edge` network) | seconds per container | rollback (§5) |
| 3.4 | **Restart nginx** onto the new config | a few seconds | `dc logs nginx`; rollback (§5) |
| 3.5 | Health check and smoke test | — | rollback (§5) |

```bash
# 3.1 — from the workstation: sync only (stop deploy.sh after the upload), or by hand:
rsync -az --delete --exclude .git --exclude node_modules --exclude .next \
  --exclude '.env' --exclude '.env.*' ./ root@$DEPLOY_HOST:/srv/hamdastan/
scp deploy/.env.production root@$DEPLOY_HOST:/srv/hamdastan/.env
ssh root@$DEPLOY_HOST 'chmod 600 /srv/hamdastan/.env && cd /srv/hamdastan && dc build'

# 3.2 — on the server: 0011–0014, additive, under the runner's advisory lock.
cd /srv/hamdastan && dc run --rm --no-deps api node_modules/.bin/tsx apps/api/src/data/migrate.ts
#   expected: "4 applied" and no drift. The running (old) API is unaffected.

# 3.3 — switch the apps. nginx keeps its old in-memory config, which still
#       reaches `api:4000` on the default network.
dc up -d --no-deps api web admin
dc ps            # api healthy?

# 3.4 — nginx onto the new config (edge network, api-edge, limits).
dc up -d --no-deps --force-recreate nginx

# 3.5
curl -fsS http://127.0.0.1/_up
```

From the workstation:

```bash
./scripts/smoke-test.sh https://hamdaastaan.ir
SMOKE_OTP_PHONE=09XXXXXXXXX ./scripts/smoke-test.sh https://hamdaastaan.ir   # sends one real SMS
```

---

## 4. After the deploy — first 30 minutes

```bash
dc logs -f api | grep -E '"level":(40|50|60)'            # warnings and errors
dc logs nginx | awk '{print $5}' | sort | uniq -c        # status codes
dc logs api | grep -c 'rate limit exceeded'              # refusals
dc logs api | grep '"csrf"'                              # forged writes refused
```

Expect a few 429s (abuse) and no 5xx. A burst of 429 on `/api/v1/me` or
`/api/v1/me/*` from ordinary users means a limit is too tight: raise it in
`.env` (`RATE_LIMIT_USER_READ_PER_MINUTE` etc.) and recreate `api` — or, at
worst, `RATE_LIMIT_ENABLED=false`.

---

## 5. Rollback

**Knobs first — no release, seconds** (edit `.env`, then
`dc up -d --no-deps --force-recreate api`):

| Symptom | Knob |
|---|---|
| Ordinary users rate-limited | raise the `RATE_LIMIT_*` value, or `RATE_LIMIT_ENABLED=false` |
| Sessions ending too soon | `SESSION_IDLE_TTL_SECONDS`, `SESSION_ABSOLUTE_TTL_SECONDS`, `ADMIN_SESSION_IDLE_SECONDS` |
| Slow queries cancelled | `DATABASE_STATEMENT_TIMEOUT_MS` |

**Code rollback** — redeploy the previous commit:

```bash
git checkout <previous-production-commit>
./scripts/deploy.sh
```

It is safe because:

- **The schema stays.** `0011`–`0014` only add a table, columns that are
  nullable or defaulted, and an enum. The old code never reads them; its
  inserts get the defaults (an admin created during a rollback becomes
  `SYSTEM_ADMIN` — review roles after rolling forward again).
- **The old migration runner tolerates it.** It applies only the files it
  has, ignores recorded migrations it does not know, and reports the schema
  difference from its older snapshot as a boot *warning*, not a failure.
- **Sessions survive both ways.** No token format changed; the new columns
  are ignored by the old code, and sessions it creates get their absolute
  end on their first refresh after rolling forward.
- **nginx and the network revert together.** The old `nginx.conf` proxies to
  `api:4000` on the default network, which the old compose file still
  provides; the unused `edge` network can be removed afterwards with
  `docker network rm hamdastan_edge`.

**Never** roll back by dropping the new tables or columns.

---

## 6. What needs access I do not have

All of §0 and §2–§5: editing the server's `.env`, Kaveh-Negar credentials,
the production database backup, `nginx -t` with the real certificate,
`docker compose` on the host, and the post-deploy log checks. Validated
locally instead: `nginx -t` and a functional test of the new nginx config in
Docker (request id, edge limits, forged `X-Forwarded-For`, 1 MB cap,
single HSTS header), the smoke test against that stack, migrations on a
throwaway database, and fail-closed sign-in on a production-mode process.
