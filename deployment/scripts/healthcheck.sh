#!/usr/bin/env bash
# Quick deployment health probe. Useful for cron / nagios / icinga2.
# Exit 0 if everything green, non-zero with reason otherwise.
set -u

ENDPOINT="${HEALTHCHECK_URL:-http://localhost/api/v1/health}"
TIMEOUT="${HEALTHCHECK_TIMEOUT:-5}"

resp=$(curl -fsS --max-time "$TIMEOUT" "$ENDPOINT" 2>&1) || {
  echo "CRITICAL: backend unreachable: $resp"
  exit 2
}

# Backend returns {"status":"ok",...}
status=$(echo "$resp" | grep -oE '"status":"[^"]+"' | head -1 | cut -d'"' -f4)
if [[ "$status" != "ok" ]]; then
  echo "WARNING: status=$status response=$resp"
  exit 1
fi

echo "OK: $resp"
exit 0
