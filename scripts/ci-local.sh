#!/usr/bin/env bash
#
# Run the CI suite locally, because GitHub Actions cannot run.
#
# The account is locked for a billing reason, which disables Actions
# account-wide — including on this repo, which is public and whose Actions
# minutes are free and unlimited. A self-hosted runner does not help: the jobs
# are never dispatched, so there is nothing for a runner to pick up. The only
# way to actually execute these checks is to execute them.
#
# Every job here mirrors one in .github/workflows/. When you change a workflow,
# change this too — a local CI that has drifted from the real one is worse than
# none, because it reports green for work the real pipeline would reject.
#
#   ci.yml                    -> test-backend, schema-check, lint-frontend,
#                                build-backend, build-frontend
#   security-compliance.yml   -> dependency-audit, secret-scan, sbom,
#                                compliance-evidence-check
#
# Usage:
#     bash scripts/ci-local.sh            # everything
#     bash scripts/ci-local.sh fast       # skip schema-check and sbom (the slow two)
#     bash scripts/ci-local.sh <job> ...  # named jobs only
#
# Exits non-zero if any job fails, and prints a summary naming which.

set -uo pipefail   # deliberately NOT -e: a failing job must not stop the rest

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASSED=(); FAILED=(); SKIPPED=()
LOGDIR="${LOGDIR:-/tmp/glide-ci-local}"
mkdir -p "$LOGDIR"

run_job() {
  local name="$1"; shift
  printf '── %-26s ' "$name"
  local log="$LOGDIR/$name.log"
  if "$@" >"$log" 2>&1; then
    echo "PASS"
    PASSED+=("$name")
  else
    echo "FAIL   (log: $log)"
    FAILED+=("$name")
    tail -12 "$log" | sed 's/^/      /'
  fi
}

skip_job() { printf '── %-26s SKIP  (%s)\n' "$1" "$2"; SKIPPED+=("$1"); }

# ----------------------------------------------------------------- ci.yml ---

job_test_backend()   { pnpm -C packages/backend test; }
job_lint_frontend()  { pnpm -C packages/frontend lint; }
job_build_backend()  { pnpm -C packages/backend build; }
job_build_frontend() { pnpm -C packages/frontend build; }

# schema-check needs a throwaway database: it migrates from empty and then
# asserts the entities still match the resulting schema. It must never point at
# a database anyone cares about, so it builds its own and drops it after.
job_schema_check() {
  local db="glide_ci_$$"
  local su="${CI_PG_SUPERUSER:-avis}"
  local host="${CI_PG_HOST:-127.0.0.1}" port="${CI_PG_PORT:-5433}"
  export PGGSSENCMODE=disable

  psql -h "$host" -p "$port" -U "$su" -d postgres -tAc "CREATE DATABASE $db" >/dev/null || return 1
  # shellcheck disable=SC2064
  trap "psql -h '$host' -p '$port' -U '$su' -d postgres -tAc 'DROP DATABASE IF EXISTS $db' >/dev/null 2>&1" RETURN

  # Make uuid_generate_v4() exist before anything that runs ahead of the
  # migration chain (the chain creates its own too). Prefer the real extension:
  # uuid-ossp loads here as of 2026-08-26, once libossp-uuid16 was unpacked into
  # pgsql/lib-compat. Fall back to a shim on a host where it still cannot load.
  #
  # The shim uses gen_random_uuid(), built into Postgres 13+. The older
  # md5(random()||clock_timestamp())::uuid is not a v4 uuid at all — it has no
  # version or variant bits — which passes a schema check but is wrong to leave
  # in a database that then generates its own ids.
  psql -h "$host" -p "$port" -U "$su" -d "$db" -q -c \
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' >/dev/null 2>&1 \
  || psql -h "$host" -p "$port" -U "$su" -d "$db" -q -c \
    "CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS uuid LANGUAGE sql VOLATILE AS \$\$
       SELECT gen_random_uuid() \$\$;" >/dev/null 2>&1

  DB_HOST="$host" DB_PORT="$port" DB_NAME="$db" \
  DB_USERNAME="$su" DB_PASSWORD="" \
  DB_MIGRATION_USERNAME="$su" DB_MIGRATION_PASSWORD="" \
  NODE_ENV=development \
    pnpm -C packages/backend db:migrate || return 1

  DB_HOST="$host" DB_PORT="$port" DB_NAME="$db" \
  DB_USERNAME="$su" DB_PASSWORD="" NODE_ENV=development \
    pnpm -C packages/backend test:schema
}

# ------------------------------------------------ security-compliance.yml ---

job_dependency_audit() {
  pnpm security:audit:root && pnpm security:audit:backend && pnpm security:audit:frontend
}

# The workflow uses gitleaks-action. Locally, use the gitleaks binary if it is
# installed; if it is not, say so rather than passing — a secret scan that
# silently does nothing is the worst possible green tick.
job_secret_scan() {
  if command -v gitleaks >/dev/null; then
    gitleaks detect --no-banner --redact --exit-code 1
  else
    echo "gitleaks not installed — cannot scan."
    echo "Install: https://github.com/gitleaks/gitleaks/releases"
    return 1
  fi
}

job_sbom() {
  mkdir -p compliance/evidence/releases/sbom
  npx -y @cyclonedx/cdxgen@11 -t pnpm --no-recurse \
    -o compliance/evidence/releases/sbom/sbom.json
}

job_compliance_evidence() {
  local missing=0 f
  for f in \
    docs/compliance/SECURITY_ARCHITECTURE_AND_APP_CONTROLS.md \
    docs/compliance/SECURE_SDLC_AND_CICD_CONTROLS.md \
    docs/compliance/VULNERABILITY_MANAGEMENT_POLICY.md \
    docs/compliance/MONITORING_AND_OPERATIONS_EVIDENCE.md \
    docs/compliance/CUSTOMER_ASSURANCE_AND_SLA.md \
    compliance/evidence/templates/vulnerability-register.csv \
    compliance/evidence/templates/incident-log.csv \
    compliance/evidence/templates/backup-restore-test-log.csv \
    compliance/evidence/templates/access-review-log.csv \
    compliance/evidence/templates/change-approval-log.csv \
    compliance/evidence/templates/sla-monthly-report.csv
  do
    [ -f "$f" ] || { echo "missing: $f"; missing=$((missing+1)); }
  done
  [ "$missing" -eq 0 ]
}

# --------------------------------------------------------------- dispatch ---

ALL=(test-backend lint-frontend build-backend build-frontend schema-check
     dependency-audit secret-scan sbom compliance-evidence)
FAST_SKIP=(schema-check sbom)

case "${1:-all}" in
  all)  WANTED=("${ALL[@]}") ;;
  fast) WANTED=(); for j in "${ALL[@]}"; do
          [[ " ${FAST_SKIP[*]} " == *" $j "* ]] || WANTED+=("$j"); done ;;
  *)    WANTED=("$@") ;;
esac

echo "glide-HIMS local CI  —  $(git rev-parse --short HEAD) on $(git rev-parse --abbrev-ref HEAD)"
echo "logs: $LOGDIR"
echo

for j in "${WANTED[@]}"; do
  case "$j" in
    test-backend)        run_job test-backend        job_test_backend ;;
    lint-frontend)       run_job lint-frontend       job_lint_frontend ;;
    build-backend)       run_job build-backend       job_build_backend ;;
    build-frontend)      run_job build-frontend      job_build_frontend ;;
    schema-check)        run_job schema-check        job_schema_check ;;
    dependency-audit)    run_job dependency-audit    job_dependency_audit ;;
    secret-scan)         run_job secret-scan         job_secret_scan ;;
    sbom)                run_job sbom                job_sbom ;;
    compliance-evidence) run_job compliance-evidence job_compliance_evidence ;;
    *) skip_job "$j" "unknown job" ;;
  esac
done

echo
echo "passed: ${#PASSED[@]}   failed: ${#FAILED[@]}   skipped: ${#SKIPPED[@]}"
if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "failed jobs: ${FAILED[*]}"
  exit 1
fi
echo "all green"
