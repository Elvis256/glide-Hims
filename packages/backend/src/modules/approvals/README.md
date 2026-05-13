# Approvals Engine

Cross-cutting, module-agnostic approvals framework. Any module (procurement,
HR, finance, pharmacy, …) can hand off its "needs approval" workflow to this
engine and let the generic `/approvals/inbox` UI handle approve / reject /
recall, with audit logging, SLA escalation and in-app notifications "for
free".

## Quick start (consumer module)

```ts
// 1. In your module imports
imports: [forwardRef(() => ApprovalsModule)]

// 2. Inject and submit when a document needs approval
constructor(@Optional() private approvals?: ApprovalsService) {}

await this.approvals.submit({
  module: 'hr',           // free-form string, used to scope policies
  documentType: 'leave',  // your document discriminator
  documentId: leave.id,
  tenantId,
  requesterId: user.id,   // user.id, not employee.id
  amount: daysRequested,  // arbitrary numeric used in JSONLogic conditions
  departmentId: employee.departmentId ?? null,
  category: leave.leaveType ?? null,
});

// 3. Listen for completion / rejection to apply your side-effects
@OnEvent('approval.completed')
onCompleted(evt) {
  if (evt.documentRef.module !== 'hr' || evt.documentRef.documentType !== 'leave') return;
  // mark your document as approved, apply balances, send your own
  // domain-specific notification, etc.
}
```

## Policies

Policies live in `procurement_approval_policies` (despite the legacy table
name, the engine is module-aware via the `module` column). Each policy has
an ordered list of steps in `procurement_approval_policy_steps`. The
resolver (`OrgApprovalResolverService`) picks the highest-priority active
policy that matches `module + documentType + (optionally) facility / dept /
amount range`.

Each step can be one of:

| `approver_type`           | Picks                                              |
| ------------------------- | -------------------------------------------------- |
| `direct_manager`          | Requester's `Employee.managerId` chain (`levels_up`) |
| `department_head`         | Department head of the requester's dept            |
| `parent_department_head`  | Head of the parent department                      |
| `role`                    | Anyone holding `role_name` (`role:X` or `permission:X`) |
| `position`                | Anyone in `position_id`                            |
| `specific_user`           | Hard-coded `user_id`                               |
| `group`                   | Any member of `group_id`; honours quorum settings  |

### Conditions (JSONLogic, Sprint 2 Phase 2B)

Each step row has an optional `condition jsonb` evaluated by `json-logic-js`
against `{ amount, documentType, departmentId, facilityId, category,
requesterId }`. Falsy → step is skipped entirely. Examples:

```json
{ ">=": [{ "var": "amount" }, 1000000] }
{ "and": [{ "==": [{ "var": "category" }, "ANNUAL"] }, { ">": [{ "var": "amount" }, 5] }] }
```

### SLA + escalation (Sprint 2 Phase 2B)

If `sla_hours` is set on a step, the engine writes `sla_due_at = now() +
sla_hours * 1h` to the corresponding chain row. `ApprovalsSlaService` runs
every minute and finds breached pending steps; it stamps `escalated_at`,
records an `escalate` action, and emits `approval.step.escalated` (without
flipping status — the original approver can still act). Optional
`escalate_to_user_id` is forwarded so the notifier can fan out to the
escalation target. Disable with `APPROVALS_SLA_CRON=off`.

## Authorisation: who can approve a step?

`ApprovalsService.assertCanAct(step, userId)` accepts the act when **any**
of these holds:

1. `step.approverId === userId` (named approver).
2. The user is a member of `step.groupId`.
3. `step.requiredRole` is `permission:<code>` and the user holds that
   permission directly or via any of their roles.
4. `step.requiredRole` is `role:<name>` and the user holds that role.

Permissions are revocation-aware: revoking a permission (or the role that
grants it) immediately removes the user from the candidate set on the next
inbox refresh.

## Inbox

`GET /api/v1/approvals/inbox` returns every pending step the caller can act
on, across all modules. Frontend page lives at `/approvals/inbox`.

## Audit

`approval_actions` stores every `submit`, `approve`, `reject`, `escalate`,
`recall`. `ApprovalAuditListener` mirrors these into the central
`AuditService` for procurement docs (other modules can subscribe similarly).

## Notifications (Sprint 2 Phase 2B)

`ApprovalsNotifier` listens to the lifecycle events and creates
`InAppNotification` rows (`type=GENERAL`, `metadata.approvalKind` ∈
{pending, escalated, completed, rejected}, `metadata.link =
/approvals/inbox`):

- `approval.submitted` → every potential approver of step 1.
- `approval.step.escalated` → original approvers + `escalate_to_user_id`.
- `approval.completed` / `approval.rejected` → original requester (looked
  up from the `submit` action).

## Default policy seeds

`POST /api/v1/approvals/seed-defaults` (requires `system.admin`)
idempotently installs:

- `procurement / PR` and `procurement / PO`: Manager → Finance(>=1M) →
  CFO(>=10M)
- `hr / leave`: Manager (+ HR if leave > 5 days)
- `finance / journal`: CFO if amount >= 5M

Re-running is a no-op (matches existing policies by name).

## Events catalogue

| Event                       | Emitted by              | Payload                                                                                  |
| --------------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| `approval.submitted`        | `ApprovalsService`      | `{ documentRef, chainId, stepCount, source, tenantId }`                                  |
| `approval.step.approved`    | `ApprovalsService`      | `{ documentRef, chainStepId, approvalLevel, actorUserId, tenantId }`                     |
| `approval.step.rejected`    | `ApprovalsService`      | `{ documentRef, chainStepId, approvalLevel, actorUserId, tenantId }`                     |
| `approval.step.escalated`   | `ApprovalsService`      | `{ documentRef, chainStepId, escalateToUserId, tenantId }`                               |
| `approval.completed`        | `ApprovalsService`      | `{ documentRef, tenantId }` — fires when no pending steps remain                         |
| `approval.rejected`         | `ApprovalsService`      | `{ documentRef, reason, tenantId }`                                                      |
| `approval.recalled`         | `ApprovalsService`      | `{ documentRef, actorUserId, tenantId }`                                                 |
