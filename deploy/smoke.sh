#!/usr/bin/env bash
# Smoke test the locally running backend + nginx.
# Returns non-zero if any check fails.
set -uo pipefail

BASE="${SMOKE_BASE:-http://127.0.0.1:3000}"
NGINX_BASE="${SMOKE_NGINX_BASE:-http://127.0.0.1}"

fail=0
pass=0

check() {
  local name="$1" url="$2" expect="${3:-200}" method="${4:-GET}" body="${5:-}"
  local code
  if [ "$method" = "POST" ]; then
    code=$(curl -ks -o /dev/null -w "%{http_code}" --max-time 10 \
      -X POST -H "content-type: application/json" -d "${body:-{}}" "$url" 2>/dev/null) || code="000"
  else
    code=$(curl -ks -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null) || code="000"
  fi
  if [ "$code" = "$expect" ]; then
    printf "  ✅ %-45s %s\n" "$name" "$code"
    pass=$((pass + 1))
  else
    printf "  ❌ %-45s expected=%s got=%s\n" "$name" "$expect" "$code"
    fail=$((fail + 1))
  fi
}

echo "── Backend (direct on $BASE) ──"
check "Public plans"           "$BASE/api/v1/saas-revenue/public/plans"
check "Auth login (rejects empty)" "$BASE/api/v1/auth/login" "400" "POST" "{}"
check "Tenants public list"    "$BASE/api/v1/tenants/public/list"

echo "── Nginx ($NGINX_BASE) ──"
check "SPA index"              "$NGINX_BASE/" 200
check "API via nginx"          "$NGINX_BASE/api/v1/saas-revenue/public/plans"
check "Public pricing route"   "$NGINX_BASE/pricing"

echo "── PM2 ──"
if pm2 jlist 2>/dev/null | grep -q '"status":"online".*glide-hims-backend\|glide-hims-backend.*"status":"online"'; then
  printf "  ✅ %-45s online\n" "glide-hims-backend"
  pass=$((pass + 1))
else
  printf "  ❌ %-45s NOT online\n" "glide-hims-backend"
  fail=$((fail + 1))
fi

echo
echo "Result: $pass passed, $fail failed"
exit $fail
