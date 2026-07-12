# Feature Backlog

Ideas spotted during the systematic module review. These are **not bugs** —
correctness/safety issues get fixed immediately. This list is for product
decisions: pick what to build.

Legend: 💰 revenue/compliance · 🏥 clinical value · ✨ UX polish

## Discharge / IPD
- 🏥 **Discharge summary lifecycle** — add draft → finalized → signed states
  (like med reconciliation). Today summaries are editable forever with no
  sign-off, weakening their standing as legal documents.
- 🏥 **30-day readmission rate** — discharge stats already compute AMA rate;
  readmission is a core hospital KPI and the encounter data already exists.
- 🏥 **Discharge checklist gate** — block discharge until pending lab results
  acknowledged, invoices settled or debt-flagged, and med reconciliation
  signed. All three exist today but are unenforced/independent.
- ✨ **Patient-facing discharge instructions** — print payload already exists
  (`printDischargeSummary`); surface it in the patient portal + SMS follow-up
  appointment reminders.
- 🏥 **Discharge planning / expected discharge date** — bed board already shows
  `expectedDischarge`; a simple "planned discharges today" list would help ward
  managers free beds proactively.
- ✨ **Nurse shift-handover summary** — nursing notes + med schedule + latest
  vitals per admission already exist; a single handover endpoint/printout is
  low-effort, high-value.

## Platform
- ✨ **Platform number generators unserialized** — SaaS quotation
  (`nextQuotationNumber`) and contract (`nextContractNumber`) use unlocked
  MAX+1. Single-operator today, but add advisory locks if multiple platform
  admins ever work concurrently.

## Maternity
- 🏥 **Partograph charting** — labour progress records dilation/station but has
  no WHO partograph time-series view or alert-line breach detection (major
  clinical safety feature for labour wards).
- ✨ **Postponed surgery re-confirmation** — POSTPONED cases hold a new
  date/time but nothing moves them back to SCHEDULED; they never appear on
  day lists. Needs a "reconfirm" action (also applies to Surgery module).
- 🏥 **EPI defaulter SMS reminders** — defaulter list exists
  (`getImmunizationDefaulters`); hooking it to the notifications module would
  directly improve vaccination coverage.

## Portal / Biometrics
- 🏥 **Biometric template encryption at rest** — fingerprint templates are
  stored plaintext in `biometric_data.templateData`; unlike passwords they
  can never be rotated. Encrypt with pii-crypto.
- ✨ **`POST /biometrics/verify` is spoofable** — any users.read caller can
  stamp lastVerifiedAt without an actual match; deprecate in favour of
  verify-proxy which stamps server-side.
- ✨ **Portal discharge instructions + follow-up view** — pairs with the
  discharge backlog item; the portal now has working lab results.

## POS / Payments
- 💰 **Shift report scoped by time window only** — `getShiftReport` aggregates
  payment splits tenant-wide between openedAt/closedAt; overlapping shifts on
  other registers pollute the numbers. Splits need a shiftId link.
- 💰 **MoMo late-success after timeout** — a transaction marked TIMEOUT whose
  money later lands at the provider has no refund/replay flow; needs a
  reconciliation report for TIMEOUT txs that succeeded gateway-side.

## Surgery
- 🏥 **WHO Surgical Safety Checklist (sign-in / time-out / sign-out)** — only a
  free-form pre-op checklist exists today; the three-phase WHO checklist is
  the standard theatre-safety instrument.

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
