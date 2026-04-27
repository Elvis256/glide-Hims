#!/usr/bin/env bash
# Fail CI if any controller method body checks `!req.user?.isSystemAdmin`
# without being declared at the route level — enforces uniform decorator use.
#
# Strategy (cheap, no AST): list controller .ts files, extract methods that
# perform the body-level check, then ensure each such file ALSO either:
#   - has @SystemAdminOnly() somewhere (preferred, future), OR
#   - is in the explicit allow-list (transitional, until #5 lands).
#
# Exits non-zero if a file does the body-level check without one of those.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/packages/backend/src"

ALLOW_LIST=(
  # Files that legitimately mix sysadmin + tenant flows and gate inline.
  # New files should prefer @SystemAdminOnly() instead of growing this list.
  "modules/deployments/deployment.controller.ts"
  "modules/setup/setup.controller.ts"
  "modules/system/system.controller.ts"
  "modules/support-access/support-access.controller.ts"
  "modules/updates/updates.controller.ts"
  "modules/tenants/tenants.controller.ts"
  "modules/licensing/license.controller.ts"
  "modules/licensing/phone-home.controller.ts"
  "modules/users/users.controller.ts"
  "modules/system-settings/system-settings.controller.ts"
)

fail=0
mapfile -t hits < <(grep -rlE "isSystemAdmin\s*\)" "$SRC" --include="*.controller.ts" || true)

for f in "${hits[@]}"; do
  rel="${f#$SRC/}"
  if grep -q "@SystemAdminOnly" "$f"; then
    continue
  fi
  ok=0
  for a in "${ALLOW_LIST[@]}"; do
    [[ "$rel" == "$a" ]] && ok=1 && break
  done
  if [[ $ok -eq 0 ]]; then
    echo "FAIL: $rel uses isSystemAdmin body check without @SystemAdminOnly() and is not allow-listed."
    fail=1
  fi
done

if [[ $fail -ne 0 ]]; then
  echo
  echo "Add @SystemAdminOnly() to the controller method, or update scripts/lint-system-admin-guards.sh ALLOW_LIST."
  exit 1
fi
echo "OK: system-admin guards consistent."
