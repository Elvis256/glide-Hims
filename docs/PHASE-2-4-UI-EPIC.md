# Phase 2-4 Operational UI — Engineering Epic

The backend services for advanced multi-deployment operations are complete and reachable
via REST. They currently have **no system-admin UI**. This epic captures the work
required to surface them.

## Backend services already shipped
| Service | Purpose | Endpoints (under `/api/v1`) |
|---|---|---|
| `UpdateDistributionService` | Phased 10/50/100 % rollout per package | `/updates/packages`, `/updates/rollouts`, `/updates/:id/start`, `/updates/:id/abort` |
| `RolloutOrchestrationService` | Schedules & auto-rollback | `/updates/rollouts/:id/orchestrate`, `/updates/rollouts/:id/health` |
| `MasterDataSyncService` | Push canonical reference data to deployments | `/sync/dispatch`, `/sync/jobs`, `/sync/deployments/:id/status` |
| `ConflictResolutionEngine` | Detects conflicting changeset pairs | `/deployments/sync-conflicts`, `/deployments/sync-conflicts/history`, `/deployments/sync-conflicts/resolve` |
| `HealthMetricsCollectorService` | Per-deployment metrics ingest + anomaly detect | `/deployments/:id/health-metrics` (POST), `/deployments/:id/health-history` |
| `MonitoringService` | Deployment alerts (list, raise, resolve) | `/deployments/alerts`, `/deployments/:id/alerts`, `/deployments/alerts/:id/resolve` |

## Status (2026-08-26)

All four surfaces exist. Two were already built; the alerts inbox and the
conflicts queue were added on `feat/system-conflicts-and-alerts`.

Two claims in the original table were wrong and are corrected above:

- `ConflictResolutionEngine` was **not** reachable over REST. It had no
  controller at all — `/sync/conflicts` belongs to the unrelated offline-sync
  controller. Its endpoints were written in `babb8621`.
- Alerts are served by `MonitoringService`, not `AlertingService`, and both its
  read and its resolve returned **every tenant's** alerts until `f5787029`.

Four engine methods are deliberately **not** exposed — `detect3WayConflict`,
`autoResolve`, `escalateConflict`, `applyStrategy` return hardcoded values.
`autoResolveConflicts` is not exposed either: it acts on severity `low` while
detection only ever emits `high`, so it always resolves nothing.

The rollouts dashboard lives at `/system/rollouts`, not `/system/updates`.

## UI surfaces to build
1. **Deployment detail page** at `/system/deployments/:id` with tabs:
   - **Overview** — license, version, status, last-seen, tier
   - **Updates** — package list, current rollout % per phase, abort/rollback buttons
   - **Health** — sparkline charts (CPU, RAM, queue depth), recent anomalies
   - **Sync** — last master-data push, conflict count, resolve queue
   - **Alerts** — open alerts with severity, channel, ack/resolve
2. **Rollouts dashboard** at `/system/updates` — global view of all in-progress rollouts.
3. **Conflicts queue** at `/system/sync-conflicts` — queue and history tabs; resolving
   opens both sides of the changeset pair with a strategy picker. ✅ shipped
4. **Alerts inbox** at `/system/alerts` — severity/status/hospital/text filters,
   resolve in place. ✅ shipped. No acknowledge action: the controller has no
   acknowledge route, only resolve.

## Acceptance criteria
- Each service callable from the UI without curl.
- Long-running ops (rollout start, sync dispatch) show progress with toast on completion.
- All pages gated by `isSystemAdmin`.

## Out of scope (existing)
- Backend logic — already done in Phase 2-4.
- Authentication & permissions — already enforced server-side.
