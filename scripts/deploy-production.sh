#!/usr/bin/env bash
#
# Deploy the current origin/main onto the production host.
#
# Usage, on the production box:
#     bash scripts/deploy-production.sh            # deploy
#     bash scripts/deploy-production.sh --check    # preflight only, changes nothing
#
# Written after a dry run of the pending migrations against a schema-only
# replica of production. What that established, and why this script is shaped
# the way it is:
#
#   * The 26 files that show as modified/untracked in the production checkout
#     are byte-identical to origin/main. They are fixes that were made on the
#     box and later committed upstream, so a fast-forward overwrites nothing.
#     This script still refuses to run if anything ACTUALLY differs — see
#     check_tree_matches_upstream. Do not replace that with `git checkout .`.
#   * Migrations run as DB_MIGRATION_USERNAME, which owns every table. Running
#     them as the app's runtime role fails with "must be owner of table ...".
#   * The frontend is served from packages/frontend/dist by something other
#     than pm2; only glide-hims-backend is a pm2 process. Rebuilding the
#     frontend is not enough on its own if that server caches — see the note
#     printed at the end.
#
# Every step is checked. The script stops at the first failure and tells you
# what state it stopped in, because a half-applied deploy is worse than a
# refused one.

set -Eeuo pipefail

REPO="${REPO:-/root/glide-Hims/current}"
BRANCH="${BRANCH:-main}"
PM2_APP="${PM2_APP:-glide-hims-backend}"
# Derived from the app's own .env below, not guessed. A hardcoded :3001 (a dev
# port; production listens on 3000) made the health loop silently never pass,
# so a deploy that left the backend errored still exited 0. A health check that
# cannot fail is worse than none.
HEALTH_URL="${HEALTH_URL:-}"
CHECK_ONLY=0
IF_CHANGED=0
case "${1:-}" in
  --check)      CHECK_ONLY=1 ;;
  --if-changed) IF_CHANGED=1; QUIET_UNTIL_DECIDED=1 ;;
esac

# Deploy window. --if-changed runs unattended from cron, and this system is a
# hospital's: an automatic restart in the middle of a clinic is a worse outcome
# than a deploy landing a few hours later. Outside the window the poller notices
# the change, says so, and waits. DEPLOY_ANYTIME=1 overrides for a deliberate
# out-of-hours push.
DEPLOY_WINDOW_START="${DEPLOY_WINDOW_START:-1}"
DEPLOY_WINDOW_END="${DEPLOY_WINDOW_END:-5}"

# What the poller is allowed to deploy TO.
#
#   tag     (default) the newest tag matching DEPLOY_TAG_PATTERN. Merging to
#           main no longer ships anything; tagging does. "This code is on main"
#           and "this goes to patients" become separate decisions, and the tag
#           records who made the second one and when.
#   branch  the tip of origin/$BRANCH — continuous deployment. Every merge
#           reaches production unattended, inside the window, with nobody
#           watching at 02:00.
#
# Default is tag because this is a hospital's system. Set DEPLOY_GATE=branch to
# opt into the other behaviour deliberately rather than by omission.
DEPLOY_GATE="${DEPLOY_GATE:-tag}"
DEPLOY_TAG_PATTERN="${DEPLOY_TAG_PATTERN:-deploy-*}"

# In --if-changed the common case is "nothing moved", and that runs every few
# minutes from cron. Preflight chatter on every quiet run buries the one line
# that matters, so output stays suppressed until there is something to report.
log()   { [ "${QUIET_UNTIL_DECIDED:-0}" = "1" ] && return 0; echo "[$(date +%H:%M:%S)] $*"; }
speak() { QUIET_UNTIL_DECIDED=0; }
die()  { QUIET_UNTIL_DECIDED=0; echo "[$(date +%H:%M:%S)] FAILED: $*" >&2; exit 1; }
step()  { [ "${QUIET_UNTIL_DECIDED:-0}" = "1" ] && return 0; echo; echo "── $* ──"; }

trap 'echo; echo "Stopped at line $LINENO. Nothing further was attempted."; echo "The pre-deploy backup, if it was taken, is under $REPO/../backups/predeploy/."' ERR

cd "$REPO" || die "no repo at $REPO"

# Single-instance lock. Two of these running at once took production down for
# four minutes: `nest build` clears dist before compiling, so the second run
# deleted the output the first had just produced, pm2 restarted into a missing
# dist/main.js and gave up after 11 attempts. Concurrency is not a theoretical
# risk here — it is the observed failure.
LOCK="/tmp/glide-deploy.lock"
exec 9>"$LOCK" || die "cannot open $LOCK"
if ! flock -n 9; then
  die "another deploy is already running (holding $LOCK). Wait for it to finish; do NOT run two at once."
fi
echo $$ >&9

# ---------------------------------------------------------------- preflight --

step "Preflight"

command -v pnpm >/dev/null || die "pnpm not on PATH"
command -v pm2  >/dev/null || die "pm2 not on PATH"
log "node $(node -v), pnpm $(pnpm -v)"

if [ -z "$HEALTH_URL" ]; then
  APP_PORT=$(grep -hE '^PORT=' packages/backend/.env 2>/dev/null | head -1 | cut -d= -f2 | tr -d '[:space:]')
  [ -n "$APP_PORT" ] || die "no PORT in packages/backend/.env and no HEALTH_URL given; refusing to guess"
  HEALTH_URL="http://localhost:${APP_PORT}/api/v1/health"
fi
log "health endpoint: $HEALTH_URL"

FREE_MB=$(df -Pm . | awk 'NR==2 {print $4}')
[ "$FREE_MB" -ge 3000 ] || die "only ${FREE_MB}MB free; a build needs headroom"
log "disk: ${FREE_MB}MB free"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not a git checkout"
CUR_BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$CUR_BRANCH" = "$BRANCH" ] || die "on branch '$CUR_BRANCH', expected '$BRANCH'"

git fetch --quiet origin "$BRANCH" || die "fetch failed"
BEFORE=$(git rev-parse HEAD)

if [ "$IF_CHANGED" = "1" ] && [ "$DEPLOY_GATE" = "tag" ]; then
  git fetch --quiet --tags --force origin 2>/dev/null || true
  # Newest matching tag by commit date, and it must be on the branch — a tag
  # pointing at something never merged is not a release, it is a mistake.
  DEPLOY_TAG=$(git tag --list "$DEPLOY_TAG_PATTERN" --sort=-creatordate --merged "origin/$BRANCH" 2>/dev/null | head -1)
  if [ -z "$DEPLOY_TAG" ]; then
    # Nothing has been marked for release. Silence: this is the normal state
    # between releases, not a problem to report every five minutes.
    exit 0
  fi
  TARGET=$(git rev-parse "${DEPLOY_TAG}^{commit}")
else
  TARGET=$(git rev-parse "origin/$BRANCH")
fi

# Being at the target commit does NOT mean the deploy is done. The code can be
# pulled while dist is still the old build and migrations are still pending —
# which is exactly the state a merge outside this script leaves behind, and the
# reason the first production run of this script did nothing useful. The job is
# to make the RUNNING system match origin/main, not merely to pull.
ALREADY_AT_TARGET=0
if [ "$BEFORE" = "$TARGET" ]; then
  ALREADY_AT_TARGET=1
  # Unattended: nothing moved, so there is nothing to do and nothing to say.
  # A poller that logs on every quiet run buries the one line that matters.
  if [ "$IF_CHANGED" = "1" ]; then
    exit 0
  fi
  log "already at origin/$BRANCH ($(git rev-parse --short HEAD)) — still rebuilding, migrating and restarting"
fi

if [ "$IF_CHANGED" = "1" ] && [ "$ALREADY_AT_TARGET" = "0" ]; then
  HOUR=$(date +%-H)
  if [ "${DEPLOY_ANYTIME:-0}" != "1" ] \
     && ! { [ "$HOUR" -ge "$DEPLOY_WINDOW_START" ] && [ "$HOUR" -lt "$DEPLOY_WINDOW_END" ]; }; then
    speak
    log "origin/$BRANCH moved to $(git rev-parse --short "$TARGET") but it is ${HOUR}:00, outside the ${DEPLOY_WINDOW_START}-${DEPLOY_WINDOW_END} deploy window — waiting"
    exit 0
  fi
  speak
  if [ -n "${DEPLOY_TAG:-}" ]; then
    log "release tag $DEPLOY_TAG -> $(git rev-parse --short "$TARGET"); deploying from $(git rev-parse --short "$BEFORE")"
  else
    log "origin/$BRANCH moved: $(git rev-parse --short "$BEFORE") -> $(git rev-parse --short "$TARGET"); deploying"
  fi
fi

if [ "$ALREADY_AT_TARGET" = "0" ]; then
  # Name the actual target. With tag gating this check most often fires because
  # someone tagged a commit OLDER than what production is running, which would
  # be a rollback rather than a fast-forward — and a message blaming
  # "origin/$BRANCH" sends them to look at the wrong thing entirely.
  git merge-base --is-ancestor "$BEFORE" "$TARGET" \
    || die "$(git rev-parse --short "$BEFORE") is not an ancestor of ${DEPLOY_TAG:-origin/$BRANCH} ($(git rev-parse --short "$TARGET")) — that would be a rollback, not a fast-forward. Deploying backwards is deliberate work: do it by hand."
  log "$(git rev-list --count "$BEFORE".."$TARGET") commits to apply: $(git rev-parse --short "$BEFORE") -> $(git rev-parse --short "$TARGET")"
fi

# Refuse to discard real local work. Files that differ from upstream ONLY in
# the sense that upstream has since caught up are fine; files whose contents
# genuinely differ are not.
check_tree_matches_upstream() {
  local differing=0 f
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if ! git show "origin/$BRANCH:$f" >/dev/null 2>&1; then
      echo "    (new upstream-unknown file) $f"; differing=$((differing+1)); continue
    fi
    if ! git show "origin/$BRANCH:$f" | cmp -s - "$f"; then
      echo "    (content differs) $f"; differing=$((differing+1))
    fi
  done < <(git status --porcelain | awk '{print $2}')
  return "$differing"
}

if [ -n "$(git status --porcelain)" ]; then
  log "working tree is not clean; checking whether any of it actually differs from origin/$BRANCH"
  if check_tree_matches_upstream; then
    log "every changed file is byte-identical to origin/$BRANCH — safe to fast-forward over"
  else
    die "the files listed above genuinely differ from upstream. Capture them before deploying:
       mkdir -p ../divergence-capture/\$(date +%Y%m%d_%H%M%S) && git diff > ../divergence-capture/.../modified.patch"
  fi
fi

PENDING=$(git diff --name-only "$BEFORE" "$TARGET" -- packages/backend/src/database/migrations | wc -l)
log "migration files touched by this deploy: $PENDING"

if [ "$CHECK_ONLY" = "1" ]; then
  echo; log "--check: preflight passed, nothing changed"
  exit 0
fi

# ------------------------------------------------------------------- backup --

step "Backup"
bash scripts/backup.sh predeploy || die "backup failed — deploying without one is not worth it"

# --------------------------------------------------------------------- pull --

step "Fast-forward"
if [ "$ALREADY_AT_TARGET" = "1" ]; then
  log "nothing to fast-forward"
else
  git merge --ff-only "$TARGET" || die "fast-forward refused"
  log "HEAD now $(git rev-parse --short HEAD)"
fi

# ------------------------------------------------------------------ install --

step "Install"
# --frozen-lockfile so a deploy can never silently resolve to different
# versions than the ones that were reviewed and tested.
pnpm install --frozen-lockfile || die "install failed (HEAD is already moved; re-run this script to retry)"

# -------------------------------------------------------------------- build --

step "Build"
pnpm --filter backend build   || die "backend build failed; the OLD dist is still in place and the app is still serving it"
pnpm --filter frontend build  || die "frontend build failed; backend dist is new, frontend dist is old"

# ---------------------------------------------------------------- migrations --

step "Migrations"
# Must run as the table owner. The runtime role gets "must be owner of table".
pnpm --filter backend db:migrate || die "migration failed. The app has NOT been restarted, so it is still running the old code against a partially migrated database. Restore from the pre-deploy backup before retrying."
log "migrations applied"

# ------------------------------------------------------------------ restart --

step "Restart"
pm2 restart "$PM2_APP" --update-env || die "pm2 restart failed"

# Wait for health rather than assuming. A restart that comes back unhealthy is
# the case worth catching here, not after someone reports it.
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    log "healthy after ${i}s"
    HEALTHY=1; break
  fi
  sleep 1
done

if [ "${HEALTHY:-0}" != "1" ]; then
  pm2 logs "$PM2_APP" --lines 40 --nostream 2>/dev/null || true
  die "did not become healthy within 30s. Logs above. To roll the CODE back:
       git reset --hard $BEFORE && pnpm install --frozen-lockfile && pnpm --filter backend build && pm2 restart $PM2_APP
     Note that this does NOT undo the migrations; restore the pre-deploy backup if they must be reversed."
fi

pm2 list | grep -E "$PM2_APP" || true

# ------------------------------------------------------------------- finish --

step "Done"
log "deployed $(git rev-parse --short "$BEFORE") -> $(git rev-parse --short HEAD)"
echo
echo "Two things this script cannot verify for you:"
echo "  1. The frontend is served from packages/frontend/dist by something other than"
echo "     pm2. If that server caches aggressively, reload it so users get the new"
echo "     assets rather than a stale bundle against a new API."
echo "  2. Backups on this host are unencrypted unless /root/.glide-hims-backup-passphrase"
echo "     exists. They contain full patient records."
