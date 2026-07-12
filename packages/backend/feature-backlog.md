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

## Platform
- ✨ **PayloadTooLarge → 413** — GlobalExceptionFilter maps body-parser's
  PayloadTooLargeError to a generic 500. Should return 413 with a friendly
  "file too large (max 10 MB)" message. Users are hitting this today via
  branding logo uploads (see pm2 error log 2026-07-12).

## IPD
- 🏥 **Discharge planning / expected discharge date** — bed board already shows
  `expectedDischarge`; a simple "planned discharges today" list would help ward
  managers free beds proactively.
- ✨ **Nurse shift-handover summary** — nursing notes + med schedule + latest
  vitals per admission already exist; a single handover endpoint/printout is
  low-effort, high-value.
- 💰 **Bed rate defaulting** — auto bed-billing posts unitPrice 0 ("admin sets
  price via settings"); wiring `bed.dailyRate` into the admission charge would
  capture revenue that's currently entered manually or lost.

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

## Surgery
- 🏥 **WHO Surgical Safety Checklist (sign-in / time-out / sign-out)** — only a
  free-form pre-op checklist exists today; the three-phase WHO checklist is
  the standard theatre-safety instrument.
- 💰 **Consumables → invoice** — `getConsumablesSummary` computes billableTotal
  but nothing posts it to billing (same pattern as pharmacy→invoice already
  shipped). Revenue leak for theatre supplies.
- ✨ **Stock return on consumable delete** — deleting a stock-deducted
  consumable currently leaves inventory short; needs a compensating return.
