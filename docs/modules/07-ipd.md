# Module 07 — IPD (Inpatient Department)

Reviewed 2026-07-18 (frontend review Block 7). All flows below E2E-verified
live on tesy (API + browser) unless marked 🔎.

## Overview

IPD manages the inpatient stay end-to-end:

```
Admit (ward+bed, type emergency/elective/transfer)
  → bed OCCUPIED, ward counts updated
  → nursing notes (assessment/intervention/observation/progress/handoff/incident, per shift)
  → MAR: schedule medication → administer/hold/refuse (witness + batch supported)
  → bed transfer (locked, audited in bed_transfers; old bed → CLEANING)
  → itemized billing (invoice per patient; bed/nursing/procedure/lab/… charge types; payments)
  → discharge (summary/diagnosis/instructions/follow-up; bed → CLEANING; dischargedBy recorded)
```

Backend surface (`/ipd`, module `ipd`): wards CRUD + occupancy + handover,
beds CRUD + `/beds/available` + reserve/release (4h hold), `bed-board`
(live per-ward tiles), `census` (date-range ALOS/occupancy report),
admissions CRUD + `current-admission` + discharge + transfer +
`discharge-planning` + `expected-discharge`, nursing-notes, medications +
administer, `bed-charges-preview`, `stats`.

Emergency module admits INTO this module (Block 6): ED "Admit to IPD" creates
a real admission here.

## Views

### 1. `/ipd/admissions` — Admissions (Clinical)
Two tabs: current-admissions worklist (search by name/diagnosis/number) and a
new-admission form (type → patient search → diagnosis → attending doctor →
ward → available-bed picker, with a ward-availability side panel).

| Element | Handler/target | Effect | Verified |
|---|---|---|---|
| Tab switch, search | local | — | ✅ |
| Patient typeahead | `/patients?search=` | pick patient | ✅ |
| Attending doctor select | `/users?role=Doctor` | optional assignment | ✅ |
| Ward select / ward cards | filters `/ipd/beds/available?wardId=` | bed list | ✅ |
| Admit Patient | POST `/ipd/admissions` | admission + bed occupied; success modal; error toast | ✅ |
| View (row) | `/patients/:id` | patient record | ✅ |

### 2. `/ipd/wards` — Wards & Beds (Clinical)
Ward browser with per-ward bed grid (click ward → beds; click bed → detail
panel). The detail panel is the bed operations hub:

| Element | Handler/target | Effect | Verified |
|---|---|---|---|
| View Patient Record | `/patients/:id` | — | ✅ |
| Transfer Patient | modal → POST `…/transfer` | ward/available-bed/reason pickers; old bed→cleaning, new→occupied, bed_transfers row | ✅ |
| Admit Patient (empty bed) | → `/ipd/admissions` | — | ✅ |
| Reserve Bed | POST `/ipd/beds/:id/reserve` | 4-hour hold | 🔎 (same API as bed-board, verified there) |
| Mark as Available (cleaning/maintenance) | PATCH `/ipd/beds/:id` | bed released | ✅ |
| Handover Sheet (ward header) | GET `/ipd/wards/:id/handover` → printable modal | per patient: bed, allergies, diagnosis, doctor, latest vitals + NEWS badge, overdue/due-4h medications, latest nursing note; Print | ✅ |

### 3. `/ipd/bed-board` — Bed-Board & Census (Clinical)
Live wall-board (30s auto-refresh): per-ward tiles with patient, MRN, LOS,
attending doctor; reserve/release on tiles. Census tab: date-range report
(discharges, ALOS, avg daily census, occupancy %, daily table). Pre-existing
and healthy; left as the display/reporting counterpart to /ipd/wards.

### 4. `/ipd/bht` — Bed Head Ticket (Clinical)
Select an admission → details or print-format preview → Print. The printed
document now carries the **real facility letterhead** (name/address/phone from
facility public info) with signature lines for admitting officer, doctor,
nurse in-charge.

### 5. `/ipd/nursing` — Nursing Notes + MAR (Nurse)
Per-admission tabs:
- **Nursing Notes**: shift-filtered list (type badge, nurse, time); Add Note
  modal (shift + type from the real enum + text).
- **Medications (MAR)**: scheduled/administered list (drug, dose, route,
  scheduled vs given time, administered-by); **Administer** button records
  administration via PUT `…/administer`.

### 6. `/ipd/billing` — Inpatient Billing (Billing roles)
Per-admitted-patient itemized charges: Add Charge (category = real charge
types; creates the invoice on first charge), inline price edit, item removal
(zero-price items flagged and payment blocked until priced), Print Interim
Bill, Receive Payment (cash/mobile money/card/bank; posts a real payment,
receipt numbered). Insurance is explicitly deferred to the billing module.

### 7. `/ipd/discharge` — Discharge Management (Doctor)
Two views:
- **Discharge Queue**: admitted-patient list → summary/medications/follow-up/
  instructions tabs → Discharge modal (summary required; diagnosis,
  instructions, follow-up plan). The modal checks billing: if invoices raised
  during the admission carry an unpaid balance, an amber warning shows the
  amount and **Complete Discharge stays disabled until "Discharge approved
  with unpaid balance" is explicitly ticked** (send to cashier, or approve).
  Discharge frees the bed to CLEANING and stamps dischargedBy. Print Summary
  prints the summary tab.
- **Planning Board**: four columns — Overdue / Going Home Today / Next 7 Days /
  No Date Set — from `/ipd/discharge-planning`. Each card carries an inline
  date picker to set/change the planned discharge date (PATCH
  `…/expected-discharge`) and a Clear action. Lets the ward round plan bed
  turnover a day ahead.

### 8. `/ipd/analytics` — IPD Analytics (Clinical)
Live occupancy KPIs from `/ipd/stats`: occupancy rate, active inpatients,
today's admissions/discharges, bed summary, per-ward occupancy bars. (Fake
trend chips and a non-functional date filter were removed; historical analysis
lives in the Census tab of the bed-board.)

Also: `/wards` (Ward Management, nursing sidebar) = ward/bed/admission SETUP
(create ward, bulk-add beds, admit) — its Notes/Transfer/Discharge row actions
now navigate to the owning IPD pages; ward creation uses the logged-in user's
facility.

## Fixes shipped in this block

**Backend P0s (found by live probe only — code-read and tsc both passed):**
1. **Bed transfer 500'd on every call, twice over**: (a) pessimistic lock
   combined with `leftJoinAndSelect` — Postgres rejects FOR UPDATE on the
   nullable side of an outer join (same class as Block 6's case-number bug);
   (b) after fixing that, the `bed_transfers` insert omitted `tenantId` and
   violated RLS. Transfers had never worked since RLS rollout.

**Frontend P0s:**
2. **Fantasy date fields**: service typed `admittedAt/dischargedAt` but the
   entity has `admissionDate/dischargeDate` — AdmissionsPage and three nursing
   pages rendered "Invalid Date". Type fixed; tsc surfaced all consumers.
3. **MAR was entirely fantasy-shaped** (`medicationName/dosage/actualTime`,
   statuses `pending/given` vs real `drugName/dose/administeredAt`,
   `scheduled/administered`) — drug names and doses rendered blank and the
   Administer button could never appear. Rewritten to entity shape and the
   Administer action wired (was a dead button).
4. **Nursing note categories could 400**: options included Education and
   Communication, which are not in the backend enum — creating those notes
   failed validation. Options aligned to the real six types; note list read
   `noteType`/`recordedBy` (fantasy) instead of `type`/`nurse` so badges and
   author were blank.
5. **Inpatient billing crashed on selection**: `/billing/invoices` returns
   `{data,total}` but the page treated it as an array (`invoices.find` →
   TypeError). Also **Add Charge was double-broken**: it required an existing
   invoice (silent no-op on every fresh admission) and sent a `category` field
   the DTO rejects (400 when an invoice did exist). Now: first charge creates
   the invoice; categories map to real `chargeType` values.
6. **Five dead buttons on WardsBedsPage** (its entire action surface): all
   wired (see table above) — backend endpoints existed for every one.
7. **BHT printed a fake letterhead** — "GLIDE HOSPITAL, P.O. Box 12345,
   Nairobi, Kenya" hardcoded on a legal patient document. Now real facility
   info; Print works (was dead); dead Download removed.
8. Fantasy fields swept: `primaryDiagnosis` → `admissionDiagnosis` (nursing,
   BHT, billing pages), `admissionType` → `type`, `bed.ward` → top-level
   `ward` (the admissions query joins ward, not bed.ward — "No ward" showed
   everywhere).

**Product/UX:**
9. Attending-doctor picker added to the admission form (was not capturable —
   every admission showed "Not assigned").
10. IPDAnalytics: hardcoded fake trends ("+5.2%", "−0.5 days"), a date filter
    that filtered nothing, and a dead Export button removed — page now shows
    only real numbers.
11. Ward Management: dead Notes/Transfer/Discharge now navigate to the owning
    pages; ward creation no longer grabs `facilities[0]` (wrong facility in
    multi-facility tenants).
12. Success + `getApiErrorMessage` error toasts on every mutation across the
    module; discharge/admission/nursing/billing all report outcomes.

## Known gaps (deferred)
- Discharge doesn't write back to the linked encounter.
- Bed-board reservation reason still uses `window.prompt` (both pages).
- MAR has no UI to hold/refuse with reason (backend supports it), and no
  witness capture for controlled drugs.
- E2E artifacts on tesy: admissions ADM…0001-0004 (all discharged), invoice
  INV… with receipt RCP202607180001, ward GW1 with beds GW1-01/02 (available).
