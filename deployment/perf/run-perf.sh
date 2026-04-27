#!/usr/bin/env bash
# Run k6 smoke or load against a deployed stack and persist results.
#   ./run-perf.sh smoke
#   ./run-perf.sh load
#   BASE_URL=https://x USER=elvis PASS=Admin@123 ./run-perf.sh load
set -euo pipefail
cd "$(dirname "$0")/../.."

MODE="${1:-smoke}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
USER="${USER:-admin}"
PASS="${PASS:-Admin@123}"

OUT_DIR="deployment/perf/results"
mkdir -p "$OUT_DIR"
TS=$(date +%Y%m%d-%H%M%S)
JSON="$OUT_DIR/${MODE}-${TS}.json"
MD="deployment/docs/PERF_RESULTS.md"

if ! command -v k6 >/dev/null; then
  cat <<'EOF'
k6 is not installed. On Debian/Ubuntu:
  sudo gpg -k
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
       --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
       | sudo tee /etc/apt/sources.list.d/k6.list
  sudo apt-get update && sudo apt-get install -y k6
EOF
  exit 1
fi

case "$MODE" in
  smoke) SCRIPT="deployment/perf/k6-smoke.js" ;;
  load)  SCRIPT="deployment/perf/k6-load.js"  ;;
  *) echo "Unknown mode: $MODE (smoke|load)"; exit 1 ;;
esac

echo "Running $MODE against $BASE_URL"
BASE_URL="$BASE_URL" USER="$USER" PASS="$PASS" \
  k6 run --summary-export "$JSON" "$SCRIPT"

{
  echo "# Performance Results"
  echo
  echo "_Last run: $(date -u +'%Y-%m-%dT%H:%M:%SZ')_  ·  mode=**$MODE**  ·  target=$BASE_URL"
  echo
  echo '```json'
  cat "$JSON"
  echo
  echo '```'
} > "$MD"

echo "✅ Wrote $MD"
