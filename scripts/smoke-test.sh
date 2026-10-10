#!/usr/bin/env bash
#
# Smoke test a running stack through its public door — after every deploy.
#
#   ./scripts/smoke-test.sh https://hamdaastaan.ir
#
# Read-only and harmless: it sends no SMS, creates no account and changes
# nothing. Every request it makes is one the API is expected to refuse or
# answer from memory. Exit code 0 means every check passed.
#
# SMOKE_RESOLVE=host:port:addr pins the host name to an address (curl
# --resolve), for checking a stack before DNS points at it, or a local copy.

set -uo pipefail

BASE="${1:-https://hamdaastaan.ir}"
API="$BASE/api/v1"
RESOLVE=()
[[ -n "${SMOKE_RESOLVE:-}" ]] && RESOLVE=(--resolve "$SMOKE_RESOLVE" -k)

fails=0
pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s — %s\n' "$1" "$2"; fails=$((fails + 1)); }

# curl wrapper: prints "status<TAB>headers-file<TAB>body-file"
req() {
  local headers body
  headers="$(mktemp)"; body="$(mktemp)"
  local status
  status="$(curl -s -m 10 "${RESOLVE[@]}" -D "$headers" -o "$body" -w '%{http_code}' "$@")"
  printf '%s\t%s\t%s' "$status" "$headers" "$body"
}
header() { grep -i "^$1:" "$2" | head -1 | cut -d' ' -f2- | tr -d '\r'; }
count_header() { grep -ci "^$1:" "$2"; }

echo "Smoke test: $BASE"

# 1. The whole stack is up: nginx → API → database.
IFS=$'\t' read -r s h b < <(req "$BASE/_up")
if [[ "$s" == 200 ]] && grep -q '"healthy"' "$b"; then pass "/_up healthy (nginx, API, database)"
else fail "/_up" "status $s: $(head -c 200 "$b")"; fi

# 2. The product renders.
IFS=$'\t' read -r s h b < <(req "$BASE/welcome")
[[ "$s" == 200 ]] && pass "/welcome renders" || fail "/welcome" "status $s"

# 3. Protected routes refuse without a session, and every answer carries an id.
IFS=$'\t' read -r s h b < <(req "$API/me")
rid="$(header x-request-id "$h")"
[[ "$s" == 401 ]] && pass "/me without a session is 401" || fail "/me" "status $s"
[[ "$rid" =~ ^[0-9a-f]{32}$ ]] && pass "X-Request-ID is nginx's id ($rid)" || fail "X-Request-ID" "got '$rid'"
n="$(count_header strict-transport-security "$h")"
[[ "$n" == 1 ]] && pass "exactly one HSTS header" || fail "HSTS" "$n headers"

IFS=$'\t' read -r s h b < <(req "$API/admin/me")
[[ "$s" == 401 ]] && pass "/admin/me without a session is 401" || fail "/admin/me" "status $s"

# 4. A forged cross-site write is refused before any handler.
IFS=$'\t' read -r s h b < <(req -X POST -H 'Origin: https://evil.example' "$API/auth/logout")
[[ "$s" == 403 ]] && grep -q CSRF_REJECTED "$b" && pass "cross-site write refused (CSRF)" || fail "CSRF" "status $s"

# 5. Non-JSON bodies are refused.
IFS=$'\t' read -r s h b < <(req -X POST -H 'Content-Type: text/plain' --data 'x' "$API/auth/otp/request")
[[ "$s" == 415 ]] && pass "text/plain body refused (415)" || fail "content type" "status $s"

# 6. Validation answers before any SMS: a malformed number is a 400 — no code is sent.
IFS=$'\t' read -r s h b < <(req -X POST -H 'Content-Type: application/json' --data '{"phone":"123"}' "$API/auth/otp/request")
[[ "$s" == 400 ]] && pass "malformed phone is 400 (no SMS sent)" || fail "otp validation" "status $s: $(head -c 200 "$b")"

# 7. Bodies over 1 MB stop at nginx.
big="$(mktemp)"; head -c 1100000 /dev/zero | tr '\0' 'a' > "$big"
IFS=$'\t' read -r s h b < <(req -X POST -H 'Content-Type: application/json' --data-binary "@$big" "$API/auth/otp/request")
rm -f "$big"
[[ "$s" == 413 ]] && pass "body over 1 MB refused (413)" || fail "body limit" "status $s"

# 8. Plain HTTP goes to HTTPS.
if [[ "$BASE" == https://* && -z "${SMOKE_RESOLVE:-}" ]]; then
  s="$(curl -s -m 10 -o /dev/null -w '%{http_code}' "http://${BASE#https://}/api/v1/me")"
  [[ "$s" == 301 ]] && pass "http redirects to https" || fail "http redirect" "status $s"
fi

# 9. In production, no code is ever echoed. Asks for a code only when told
#    to (SMOKE_OTP_PHONE, a number you own): it sends one real SMS.
if [[ -n "${SMOKE_OTP_PHONE:-}" ]]; then
  IFS=$'\t' read -r s h b < <(req -X POST -H 'Content-Type: application/json' --data "{\"phone\":\"$SMOKE_OTP_PHONE\"}" "$API/auth/otp/request")
  if grep -q debugCode "$b"; then fail "OTP echo" "the response contains debugCode"
  elif [[ "$s" == 200 ]]; then pass "OTP sent, no code in the response"
  elif [[ "$s" == 503 ]]; then fail "SMS provider" "503 SMS_UNAVAILABLE — production has no SMS provider (fails closed)"
  else fail "OTP request" "status $s: $(head -c 200 "$b")"; fi
fi

echo
if [[ "$fails" == 0 ]]; then echo "All checks passed."; exit 0; fi
echo "$fails check(s) failed."; exit 1
