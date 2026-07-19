# Module 09 — Surgery / Theatre

Reviewed and largely built 2026-07-19 (frontend review Block 9). Full case
lifecycle E2E-verified live on tesy, API + browser.

## Overview

`/ipd/theatre` (sidebar "Theatre", Doctor route, module `ipd`) — three tabs
(Dashboard / Schedule / Theatres) over the surgery backend (27 endpoints):

```
Add theatre (setup) → Schedule case (patient, procedure, theatre, lead surgeon)
  → Pre-op checklist (items + consent + blood) — case → PRE_OP
  → WHO Surgical Safety Checklist (sign-in → time-out → sign-out phases)
  → Start surgery  ⟵ HARD GATES: pre-op complete, consent for electives,
                      WHO sign-in + time-out (per-tenant enforcement, ON)
  → record consumables (stock items, per phase, billable, auto stock deduction)
  → Complete (findings/notes/blood loss/destination) — case → POST_OP,
    theatre → cleaning
  → Discharge from recovery — case → COMPLETED
  (or Cancel / Postpone with reason + optional new date/time)
```

## Views & actions

### Dashboard tab
Today's schedule count, in-progress (live list), post-op recovery, theatre
availability; theatre status cards. ✅

### Schedule tab
Day navigator + surgery list (time, duration, priority/status chips, patient,
theatre, surgeon). Row → detail panel:

| Action | Endpoint | Gate behaviour | Verified |
|---|---|---|---|
| WHO Safety Checklist | GET/PUT `…/who-checklist/:phase` | 3-phase panel (19 WHO items); phase locks when completed | ✅ |
| Complete Pre-Op Checklist | PUT `…/pre-op` | 8 standard items + consent + blood availability; case → pre_op | ✅ |
| Start Surgery | PUT `…/start` | 400s with readable reason until pre-op/consent/WHO done; theatre → in_use | ✅ (both gates observed) |
| Complete Surgery | PUT `…/complete` | findings/notes required; blood loss; destination; → post_op | ✅ |
| Discharge from Recovery | PUT `…/discharge-recovery` | → completed | ✅ |
| Cancel / Postpone | PUT `…/cancel` | reason required; optional new date/time = postpone | 🔎 |
| Consumables section | POST/GET/DELETE `…/consumables` | stock-item search, qty, phase; totals; deducts stock; billable | ✅ (2 × 5,000 = 10,000) |

### Theatres tab
Theatre cards with status; **Add Theatre** (name/code/type — onboarding
setup); Schedule (opens booking); Mark Ready for cleaning/maintenance. ✅

### Schedule Surgery modal
Patient search, procedure + code, indication, type (major/minor/day case),
priority, theatre, **lead surgeon picker** (required by the API — its absence
made every booking 400 before), date/time/duration, anesthesia type. ✅
(verified: SUR20260719-0001/0002)

## Fixes shipped in this block

**P0s:**
1. **Same unreachable-page class as Block 8**: the full surgery page (with
   `WhoChecklistPanel`) was lazy-imported in App.tsx but never routed;
   `/ipd/theatre` served a parallel implementation instead. Now one merged
   page; duplicate deleted.
2. **Neither page could actually run a surgery.** The routed page's booking
   omitted the required `leadSurgeonId` (every schedule 400'd) and its Start
   button could never pass the backend gates — it had no pre-op checklist UI,
   no consent capture, and no WHO checklist, while WHO enforcement is ON for
   all tenants. The unrouted page had the WHO panel but dead lifecycle buttons
   and a "coming soon" scheduler. Merged and completed: real scheduler,
   pre-op modal, wired start/complete/discharge/cancel with gate errors
   surfaced verbatim.
3. **No consumables UI existed** (backend complete, incl. stock deduction and
   billing flags). Built into the case panel.
4. **No theatre setup UI** — a new customer could never create a theatre, so
   scheduling was impossible from day one. Add Theatre modal built;
   Mark Ready wired.
5. `SurgeryCase` frontend type lacked `caseNumber` (same fantasy-type class as
   Block 8's `ancNumber`).

`WhoChecklistPanel` itself (recently rebuilt) verified clean — 3 phases, 19
items, per-phase completion locking; no changes needed.

## Known gaps (deferred)
- Intra-op notes endpoint (`PUT …/intra-op`) has no dedicated UI (operative
  findings captured at completion instead).
- `reconfirm` (un-postpone) endpoint unused by UI.
- Conflict check endpoint (`/surgery/check-conflicts`) not called by the
  scheduler — backend still rejects double-booking; a pre-submit warning would
  be nicer.
- Consumables report (`/surgery/reports/consumables`) has no UI.
- E2E artifacts on tesy: theatre OT1 (available), SUR20260719-0001 completed
  (full WHO checklist + consumable), SUR20260719-0002 scheduled (Caesarean,
  urgent) for demos.
