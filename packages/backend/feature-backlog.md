# Feature Backlog

Ideas spotted during the systematic module review. These are **not bugs** —
correctness/safety issues get fixed immediately. This list is for product
decisions: pick what to build.

Legend: 💰 revenue/compliance · 🏥 clinical value · ✨ UX polish

## Platform
- ✨ **Platform number generators unserialized** — SaaS quotation
  (`nextQuotationNumber`) and contract (`nextContractNumber`) use unlocked
  MAX+1. Single-operator today, but add advisory locks if multiple platform
  admins ever work concurrently.

## Maternity
- 🏥 **Partograph charting** — labour progress records dilation/station but has
  no WHO partograph time-series view or alert-line breach detection (major
  clinical safety feature for labour wards).

---

## Shipped (July 2026)
- ✅ **PayloadTooLarge → 413** — friendly size-limit message from the global
  exception filter.
- ✅ **Bed rate defaulting** — first night billed at `bed.dailyRate` on
  admission; discharge bed-day computation skips the pre-billed night.
- ✅ **Theatre consumables → invoice** — billable consumables post to the
  encounter invoice on surgery completion (idempotent per consumable).
- ✅ **Stock return on consumable delete** — deducted stock is returned with a
  ledger entry; deletion blocked once billed.
- ✅ **Manager PIN brute-force lockout** — 5 failures → 15-minute lockout.
- ✅ **Leave accrual idempotency** — `leave_last_accrued_month` marker
  (migration 69); balances converted to numeric(5,2) — the int columns were
  silently truncating the fractional monthly accrual.
- ✅ **Doctor duty auto-checkout** — nightly sweep closes stale ON_DUTY rows.
- ✅ **Discharge summary lifecycle** — draft → finalized → signed
  (migration 70); edits blocked once finalized; `POST /discharge/:id/finalize`
  and `/sign` endpoints.
- ✅ **30-day readmission rate** — added to `GET /discharge/stats`
  (`readmittedWithin30Days`, `readmissionRate30d`).
- ✅ **Postponed surgery re-confirmation** — `PUT /surgery/cases/:id/reconfirm`
  moves POSTPONED → SCHEDULED with a conflict re-check at the held slot.
- ✅ **EPI defaulter SMS reminders** — daily 09:00 cron texts caregivers of
  overdue doses (opt-out respected, 7-day dedup via
  `last_defaulter_reminder_at`, migration 71).
- ✅ **Nurse shift-handover summary** — `GET /ipd/wards/:id/handover`: per
  active admission — bed, allergies, latest vitals + NEWS, overdue/due-soon
  meds, latest nursing note.
- ✅ **Biometric template encryption at rest** — AES-256-GCM via pii-crypto
  transformer; migration 72 re-encrypted existing rows.
- ✅ **Spoofable `POST /biometrics/verify`** — restricted to system admins;
  verify-proxy is the real path.
- ✅ **Shift report scoping** — splits were already shift-stamped; the report
  now filters by shift_id (time-window fallback for legacy rows).
- ✅ **MoMo timeout reconciliation** — `POST /pos/sales/mobile-money/
  reconcile-timeouts` polls the gateway for TIMEOUT txs; late successes are
  claimed (TIMEOUT→SUCCESS) and sale completion attempted, with manual-refund
  flagging when the sale was paid another way.
- ✅ **Discharge checklist gate** — finalization blocked while critical
  results are unacknowledged, invoices unsettled (unless debt-flagged), or
  med reconciliation incomplete; AMA/deceased/absconded exempt; override
  requires a logged reason.
- ✅ **Portal discharge instructions** — `GET /portal/discharge-summaries`
  (finalized/signed only) with diet/activity/wound-care/warning-sign
  instructions, medications and follow-ups.
- ✅ **Discharge planning board** — `admissions.expected_discharge_date`
  (migration 73), `PATCH /ipd/admissions/:id/expected-discharge`, and
  `GET /ipd/discharge-planning` grouping overdue / today / upcoming /
  unplanned.
- ✅ **WHO Surgical Safety Checklist** — three-phase (sign-in / time-out /
  sign-out) per case (migration 74, RLS'd), full WHO item validation, phase
  ordering + workflow-position checks, exactly-once completion per phase with
  audit. `GET/PUT /surgery/cases/:id/who-checklist[/:phase]`. Workflow gating
  (start requires sign-in+time-out, complete requires sign-out) is opt-in via
  the `surgery.who_checklist.enforce` tenant setting for a safe rollout.
