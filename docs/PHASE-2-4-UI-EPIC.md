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
| `ConflictResolutionEngine` | 3-way merge for sync conflicts | `/sync/conflicts`, `/sync/conflicts/:id/resolve` |
| `HealthMetricsCollectorService` | Per-deployment metrics ingest + anomaly detect | `/deployments/:id/health-metrics` (POST), `/deployments/:id/health-history` |
| `AlertingService` | Multi-channel alert delivery | `/deployments/alerts`, `/deployments/:id/alerts`, `/deployments/alerts/:id/resolve` |

## UI surfaces to build
1. **Deployment detail page** at `/system/deployments/:id` with tabs:
   - **Overview** — license, version, status, last-seen, tier
   - **Updates** — package list, current rollout % per phase, abort/rollback buttons
   - **Health** — sparkline charts (CPU, RAM, queue depth), recent anomalies
   - **Sync** — last master-data push, conflict count, resolve queue
   - **Alerts** — open alerts with severity, channel, ack/resolve
2. **Rollouts dashboard** at `/system/updates` — global view of all in-progress rollouts.
3. **Conflicts queue** at `/system/sync/conflicts` — table of unresolved conflicts with diff viewer.
4. **Alerts inbox** at `/system/alerts` — global alerting board with filtering.

## Acceptance criteria
- Each service callable from the UI without curl.
- Long-running ops (rollout start, sync dispatch) show progress with toast on completion.
- All pages gated by `isSystemAdmin`.

## Out of scope (existing)
- Backend logic — already done in Phase 2-4.
- Authentication & permissions — already enforced server-side.
