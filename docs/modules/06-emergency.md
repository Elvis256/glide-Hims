# Module 06 — Emergency Department

Reviewed 2026-07-18 (frontend review Block 6). Backend + frontend fixed and
deployed; all flows below E2E-verified live on tesy unless marked 🔎.

## Overview

The ED module manages the full emergency case lifecycle:

```
Register (pending) → Triage (triaged) → Start Treatment (in_treatment)
                                              ├→ Discharge   (discharged)
                                              ├→ Admit to IPD (admitted)  — creates a REAL IPD admission (ward+bed)
                     └──── at any active stage ┴→ Left AMA (left_ama) / Deceased (deceased)
```

Registering a case also creates an **emergency Encounter** (visit number
`EMV-…`, status TRIAGE→WAITING→IN_CONSULTATION→DISCHARGED/ADMITTED follows the
case). Triage vitals are mirrored into the canonical `vitals` table
(`VitalSource.EMERGENCY_TRIAGE`), so the patient timeline and critical-vital
alerting see them. Case numbers are `EMYYYYMMDD-NNNN`, per tenant per day,
generated under a pg advisory lock.

Backend surface (`/emergency`, module-gated `emergency`, permission-gated
`emergency.read|create|update`): POST `/cases`, GET `/cases` (`?status=`,
`?active=true`, `?triageLevel=`, `?facilityId=`, dates, pagination), GET
`/cases/:id`, PUT `/cases/:id/triage|start-treatment|discharge|admit`, GET
`/queue/triage`, GET `/queue/treatment`, GET `/dashboard` (all three take
required `facilityId`). A separate `/triage-assessments` controller serves the
OPD/nursing triage flow (Block 2) — do not conflate the two.

Statuses: `pending / triaged / in_treatment / discharged / admitted /
transferred / left_ama / deceased`. Triage levels 1–5 (1=Resuscitation …
5=Non-Urgent). Arrival modes: `walk_in / ambulance / private_vehicle / police /
carried / referred`.

## Views

### 1. `/emergency` — Emergency Cases (EmergencyPage) — Clinical roles
Main hub: dashboard stat cards (critical / awaiting triage / in treatment /
discharged today / total today), average wait times, case list (default =
**active cases only**, server-filtered, acuity-then-arrival order) with search
+ status filter, and a detail panel whose actions follow the case status.
Auto-refreshes every 30s. Accepts `?caseId=` deep link (auto-selects the case).

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Refresh | `refetch()` | reloads case list | emergency.read (route) | ✅ |
| New Emergency | opens register modal | — | emergency.create (backend) | ✅ |
| Register modal: patient search | `/patients?search=` | typeahead ≥2 chars, pick patient | emergency.read | ✅ |
| Register modal: Register Case | POST `/emergency/cases` | creates case+encounter, toast w/ case number | emergency.create | ✅ |
| Status filter | query `status`/`active` | switches worklist; closed views newest-first | — | ✅ |
| Case row click | `setSelectedCase` | opens detail panel | — | ✅ |
| Triage Patient (pending) | opens triage modal | manual level + full vitals, PUT `…/triage` | emergency.update | ✅ |
| Record Outcome (pending/triaged) | opens discharge modal, preset Left AMA | close case before treatment | emergency.update | ✅ |
| Start Treatment (triaged) | PUT `…/start-treatment` | status→in_treatment, encounter→IN_CONSULTATION | emergency.update | ✅ |
| Discharge (in_treatment) | discharge modal | outcome selector: Discharged home / Left AMA / Deceased; diagnosis required except Left AMA | emergency.update | ✅ |
| Admit to IPD (in_treatment) | admit modal | real ward picker (`/ipd/wards`) + available-bed picker (`/ipd/beds/available?wardId=`); creates **real IPD admission** then flips case | emergency.update | ✅ (ADM202607180001) |

### 2. `/emergency/queue` — Live Queue Board (EmergencyQueuePage) — Clinical roles
Wall-board view of triaged + in-treatment patients: acuity-sorted table with
live wait timers (1-min tick), stats, triage-level legend. Polls every 15s.
Meant for a screen in the ED.

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Refresh | `refetch()` | reload | emergency.read | ✅ |
| Row click | select highlight | visual only | — | ✅ |
| Start Treatment (waiting rows) | PUT `…/start-treatment` | moves to In Treatment, toast | emergency.update | ✅ |
| Manage Case (in-treatment rows) | `/emergency?caseId=` | opens hub with case selected | — | ✅ |

### 3. `/emergency/triage` — Triage Assessment wizard (EmergencyTriagePage) — Clinical roles
Queue of pending cases → 3-step assessment: (1) patient card (read-only, from
the case) + tap-select chief complaint, (2) vitals incl. blood glucose + AVPU,
(3) optional doctor/bay assignment + summary. The right panel computes a
suggested priority from complaint + vitals (hypoxia, tachycardia, hypotension,
reduced consciousness escalate it); **the nurse can override by tapping the
priority scale** — an override is recorded in the triage notes alongside the
suggestion. Accepts `?caseId=`.

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Queue row | select case | enters wizard | triage/emergency perms | ✅ |
| Complaint buttons | set complaint | drives suggested priority | — | ✅ |
| Vitals inputs + AVPU + glucose | local state | escalate suggestion | — | ✅ |
| Priority scale (right panel) | override priority | "Priority (set by nurse)" + reset link | — | ✅ |
| Doctor/Bay selects (optional) | recorded in triage notes | — | — | ✅ |
| Complete Triage | PUT `…/triage` | saves level+vitals, toast, → /emergency | emergency.update | ✅ |

### 4. `/emergency/billing` — Emergency Billing (EmergencyBillingPage) — Billing roles
Quick invoicing for patients currently in the ED: pick an active ED patient,
add services (live service catalog, searchable) and service packages, optionally
collect a deposit (cash / mobile money / card). "Create Bill" raises a real
invoice against the patient+encounter; a deposit is recorded as a **real
payment** against that invoice. All amounts in the configured currency (UGX by
default). Insurance and further payments are handled at the cashier.

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Patient chips | select ED patient | enables adding items | billing.create (route) | ✅ |
| Package cards | add package as line | — | — | 🔎 (no packages on tesy) |
| Service search + [+] | add/increment line | — | — | ✅ |
| [−] on bill line | decrement/remove | — | — | ✅ |
| Deposit + method | with Create Bill records payment | ledger + balance correct | billing.create | 🔎 |
| Create Bill | POST `/billing/invoices` (+ `/billing/payments`) | invoice (+deposit) toast w/ number+balance | billing.create | ✅ |

### 5. `/emergency/ambulance` — REMOVED (redirects to `/emergency`)
The old Ambulance Tracking page was a non-functional mock: hardcoded empty
fleet, a permanent "GPS Connected" badge, a Dispatch button that did nothing,
and no backend at all. It was removed rather than polished — `arrivalMode:
ambulance` on registration covers the real-world need. If a client asks for
fleet management, build it as a real feature (vehicle register + trip log; GPS
is not realistic hardware-wise for the target market).

## Fixes shipped in this block

**P0 (live-blocking):**
1. **Every case registration 500'd in production** — `generateCaseNumber` used
   `setLock('pessimistic_write')` with `getCount()`; Postgres rejects FOR
   UPDATE with aggregates. The module was unusable end-to-end. → advisory lock
   (`pg_advisory_xact_lock`) + plain count. *Found only by the live probe.*
2. **Admit to IPD never worked and never admitted** — ward dropdown was
   hardcoded slugs (`general-ward`…) vs `@IsUUID()` DTO → always 400; and the
   backend only flipped case status, no admission existed. → real ward/bed
   pickers + real `POST /ipd/admissions` (bed becomes occupied) then case flip;
   backend status guard added (triaged/in_treatment only).
3. **Arrival mode `referral` → 400** — enum value is `referred`; registering a
   referred-in emergency (common) failed. → fixed (+ added `carried`).
4. **Vanishing worklist** — unfiltered GET `/cases` caps at 50 oldest-first
   rows ever, so on an established site active patients disappear from every
   list. → `active=true` server filter (hub default, queue board, billing);
   closed-status views now newest-first.

**Workflow/product:**
5. **Left-AMA and death outcomes now recordable** (`disposition` on discharge;
   valid from any active stage incl. pending — patients abscond while waiting).
   Diagnosis optional only for Left AMA. Previously staff had no honest way to
   close these cases — worklists would silt up or data would be falsified.
6. Triage wizard: removed dead patient name/age/gender inputs (never sent
   anywhere) — real patient card instead; doctor/bay demotion to optional
   (they only ever went into a text note); **nurse can override** the computed
   priority (was forced); blood glucose added (hypoglycemia matters here);
   AVPU selected-state styling fixed (dynamic Tailwind classes never compiled).
7. Billing page: services list was empty until you typed (stale memo deps);
   fake "BlueCross 80% verified" insurance sim removed (it showed a discount
   that was never applied to the real invoice — revenue-integrity trap);
   deposit field now records a real payment (was decorative); `$` → UGX
   (`formatCurrency`); patients without a linked record excluded (invoice
   would have been raised against a case id); dead Print / Convert-to-Admission
   buttons removed; `mobile` → `mobile_money` (backend enum).
8. UX standard: success + `getApiErrorMessage` error toasts on every mutation
   across all pages (register, triage, start treatment, discharge, admit,
   bill); queue board Manage-Case deep link now actually selects the case.

## Data/config notes
- Tesy now has `General Ward` (GW1) with bed GW1-01 (occupied by the E2E
  admission) — created via the real IPD APIs during verification.
- E2E artifacts on tesy: cases EM20260718-0001…0005 (discharged / left_ama /
  admitted / triaged / pending), admission ADM202607180001.
- No DB migration needed this block (all enum values pre-existed).

## Known gaps (deferred, logged in tracker)
- ED orders/treatment documentation happens via the shared encounter tools
  (doctor module), not in the ED UI — in_treatment cases have notes fields but
  no dedicated ED treatment screen. Acceptable: Start Treatment hands the
  encounter to the consultation flow.
- `transferred` status exists but nothing sets it (inter-facility transfer
  flow not built).
- Triage wizard bay list is a hardcoded label set (note-only); fine until a
  real bay/bed board is wanted.
- Emergency dashboard "criticalCases" counts only IN_TREATMENT L1/L2 — a
  critical patient still waiting doesn't count. Minor stat quirk.
