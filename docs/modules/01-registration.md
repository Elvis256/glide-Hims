# Module 01 — Registration (Front Desk)

Frontend functional map — Block 1 of the frontend line-by-line review
(2026-07-14). Covers patient registration, the patient registry and record
pages, front-desk appointments, doctor schedules, OPD token issuance and the
reception call station.

Verification legend: ✅ works (E2E-probed live on the tesy tenant) ·
🔎 code-verified only · ❌ was broken (fixed this block unless noted) ·
💀 dead/placeholder · 🔒 unguarded.

Routes live in `src/routes/CoreRoutes.tsx` (the old `RegistrationRoutes.tsx`
was dead code and has been deleted).

---

## 1. Patient Registry — `/patients` (`PatientsPage.tsx`)

**Who**: Receptionist, Doctor, Nurse, Cashier, Lab Tech, Pharmacist,
Radiologist, Admin (RoleRoute).

**Functions**
- Browse/search the tenant's patients (server-side pagination, 10–100/page).
- Filter by gender, payment preference, registration date range.
- Table or card view; client-side sort of the current page.
- Per-patient actions: view profile, edit, issue queue token, deactivate.
- Bulk select for CSV export; global CSV export; print registry; ExportButton
  (server-side export pipeline).

**Processes**
- `GET /patients` — tenant-scoped, soft-delete-filtered; browsing without a
  search shows facility-linked + recently registered patients; searching shows
  all tenant patients (phone matched via deterministic hash, not ILIKE).
- Deactivation is a `PATCH /patients/:id {status:'inactive'}` — record is kept,
  flagged inactive (soft delete is a separate, permission-gated DELETE).
- Issue Token creates a queue entry via `POST /queue` (ticket numbering,
  pre/post-pay routing handled by the queue module).

**Inputs**: search text (name/MRN/phone), gender, paymentType
(cash/insurance/corporate/membership — read from `metadata.paymentType`),
fromDate/toDate (createdAt window), page/limit.

**Outputs**: patient list render; CSV file; print job; queue entry + ticket
number (toast); patient.status transition active↔inactive.

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Register Patient | `navigate('/patients/new')` | open registration wizard | route: patients.create | ✅ |
| Search input | query param `search` | server-side search | — | ✅ |
| Filters toggle + gender/payment/date selects | query params | server-side filtering | — | ✅ (was ❌ — backend rejected the params with 400, list went empty; DTO+service extended) |
| Clear (filters) | reset state | clears all filters | — | 🔎 |
| Table/Card view toggle | local state | switch layout | — | ✅ |
| ExportButton | export pipeline | server-side export | export perms (component) | 🔎 (pipeline reviewed backend block 17) |
| Export CSV | client CSV of page/selection | download file | — | 🔎 |
| Print | `printService.printElement` | print registry | — | 🔎 |
| Column headers (MRN/Name/DOB/Phone/Payment) | client sort | sort current page only | — | 🔎 (P2: sorts page, not dataset) |
| Row: Eye | `/patients/:id` | open profile | patients.read (route) | ✅ |
| Row: Edit | `/patients/:id/edit` | open editor | patients.update (button + route) | ✅ |
| Row menu: Issue Token | opens modal → `POST /queue` | queue entry + ticket toast | queue.create | 🔎 |
| Row menu: Print Card | toast "Coming soon" | none | patients.read | 💀 placeholder |
| Row menu: Deactivate | confirmDialog → `PATCH /patients/:id {status:'inactive'}` | marks inactive | patients.delete | ✅ (was ❌ — `status` not in UpdatePatientDto → always 400; also native confirm → confirmDialog) |
| Bulk: Print Cards / Send Bulk SMS | toast "Coming soon" | none | — | 💀 placeholders |
| Bulk: Export Selected | client CSV | download selected | — | 🔎 |
| Select-all checkbox | local state | toggles page selection | — | 🔎 (P2: shows checked on empty list) |
| Pagination prev/next + page size | query params | server-side paging | — | ✅ |

---

## 2. Patient Registration — `/patients/new` (`PatientRegistrationPage.tsx`)

**Who**: anyone with `patients.create`.

**Functions**
- 3-step wizard (Identity → Contact & Address → Payment & Next of Kin) with
  collapsed-step summaries; Quick Registration mode (identity only).
- Photo capture (webcam) or upload; NIN format validation; Uganda location
  cascade (district → sub-county → parish, from `useUgandaLocation`);
  nationality list (REST Countries, offline fallback) with +256 phone prefix
  automation for Ugandans.
- Duplicate detection before create, with reviewable match cards and an
  explicit "Register Anyway" override.
- Post-registration: Register Another / Issue OPD Token / Send to Triage /
  optional "Bill after registration" redirect.

**Processes**
1. Submit → `POST /patients/check-duplicates` (confidence-scored matching, see
   `docs/DUPLICATE_DETECTION.md`).
2. No duplicates → `POST /patients`. Duplicates → warning screen; "Register
   Anyway" resubmits **with `forceCreate: true`** (the backend hard-blocks
   high-confidence duplicates with 409 otherwise; override is audit-logged).
3. MRN issued by backend; patient cached in local store; `['patients']` query
   invalidated.
4. Optional handoffs: `POST /queue` (triage, priority 5) or navigate to
   `/billing/opd/new?patientId=`.

**Inputs**
- Required: fullName, gender, dateOfBirth. Optional: NIN (regex
  `^[A-Z]{2}\d{8}[A-Z0-9]{5}$`), phone, email, district/subcounty/parish
  (composed into `address`), occupation, maritalStatus*, bloodGroup*,
  allergies (comma-separated → array), religion*, nationality, photo,
  next-of-kin* (name/phone/relationship), payment preference
  (cash/insurance+provider+policy / corporate+company).
  (*presence controlled by business-config `registrationFields`.)
- `metadata` carries: religion, district, nationality, paymentType,
  insuranceProvider, insuranceId, corporateName, photoUrl (base64 JPEG).

**Outputs**: `patients` row (+MRN, PII encrypted at rest, hashes for
phone/NIN), audit log on forced create, optional queue entry, optional billing
redirect.

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Quick Registration toggle | local state | identity-only single card | — | ✅ (redesign pass) |
| Steps header / collapsed steps | `setStep(i)` | jump between steps | — | ✅ |
| Photo: Camera / Upload / Remove | webcam modal / file input | photoUrl (base64) in metadata | — | 🔎 |
| Webcam modal: Capture/Cancel | canvas snapshot | set photo, stop stream | — | 🔎 |
| Nationality select | `handleNationalityChange` | +256 prefix automation | — | 🔎 |
| Continue (distinct key) | `setStep+1` | next step; disabled until identity valid | — | ✅ (button-morph bug class guarded with distinct keys) |
| Register (submit) | check-duplicates → create | patient created, success card | patients.create | ✅ |
| Dup warning: View Full Record | `/patients/:dupId` | open existing patient | — | 🔎 |
| Dup warning: Go Back & Edit | close warning | return to form | — | ✅ |
| Dup warning: Register Anyway | create with `forceCreate:true` | override + audit | — | ✅ (was ❌ — forceCreate never sent → 409 for the exact case the button exists for) |
| Bill after registration | checkbox → `/billing/opd/new?patientId=` | jump to billing | billing route guards apply | 🔎 |
| Success: Register Another | reset form | clean slate | — | ✅ |
| Success: Issue OPD Token | `/opd/token` | token page | receptionist route | ✅ |
| Success: Send to Triage Queue | `POST /queue` (triage) | queue entry + navigate | — | 🔎 |

---

## 3. Patient Profile — `/patients/:id` (`PatientDetailPage.tsx`)

**Who**: `patients.read` (route); tab/action guards below.

**Functions**: full patient 360 — demographics header with QR-coded MRN,
status/payment/VIP badges; tabs: Overview, Visits (encounter history with
date/department filters), Billing (invoice + payment summary), Documents
(upload/view/download/delete), Notes (clinical/administrative), Activity
(audit timeline). Actions: edit, issue OPD token, print ID card (85×54 mm),
send SMS, start visit.

**Processes**: composes `GET /patients/:id`, `/encounters?patientId`,
`/billing/invoices?patientId`, `/billing/payments`, `/patients/:id/documents`
(role-filtered categories), `/patients/:id/notes`, public facility info for
card header; SMS via integrations service (tenant SMS provider).

**Inputs**: URL `:id`; visit filters (dateFrom/dateTo/department); note
type+content; document file (≤10 MB) + category; SMS message text.

**Outputs**: patient_documents rows (files on disk, access-counted),
patient_notes rows, SMS dispatch, print artifacts (ID card), navigations to
edit/token/consultation.

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Back | `navigate(-1)` | return | — | ✅ |
| Edit Profile | `/patients/:id/edit` | editor | patients.update | ✅ |
| Issue Token | `/opd/token?patientId=` | token page pre-loaded with patient | queue.create | ✅ (OPD page consumes the param) |
| Print Card | `printService.printCustom` | 85×54 mm ID card w/ facility name | — | 🔎 (P2: leftover console.log) |
| Send SMS (+ modal Send/Cancel) | `integrationsService.sendSMS` | SMS to patient phone | patients.read (weak — P1) | 🔎 |
| Outstanding banner → Billing tab | `setActiveTab('billing')` | jump to billing | billing.read | 🔎 |
| Tab bar (6 tabs) | local state | switch panel | billing.read / audit.patient.read gate 2 tabs | ✅ |
| Visits: filter toggle + inputs | refetch encounters | filtered visit list | — | 🔎 |
| Visits: Start Visit | `/doctor/encounters/new?patientId=` | new consultation | encounters.create | ✅ (was ❌ — pointed at `/encounters/new`, which resolves to the `:id` route and errors) |
| Visit row expand / “View Encounter” | `/encounters/:id` | encounter detail | clinical route | 🔎 |
| Billing: invoice row → detail | `/billing/invoices/:id` | invoice view | billing route | 🔎 |
| Documents: Upload (+ modal) | `POST /patients/:id/documents` | file stored + listed | patients.update | 🔎 |
| Documents: View / Download | authenticated blob fetch | open/save file | category-based access | 🔎 |
| Documents: Delete | confirmDialog → `DELETE /patients/documents/:docId` | removes doc | patients.update (backend enforces) | 🔎 (confirm modernised) |
| Notes: Add Note / Save / Cancel | `POST /patients/:id/notes` | note stored | patients.update | 🔎 |
| Notes: Delete | confirmDialog → `DELETE /patients/notes/:noteId` | note removed | patients.update | 🔎 (confirm modernised) |

---

## 4. Patient Edit — `/patients/:id/edit` (`PatientEditPage.tsx`)

**Who**: `patients.update` (route + in-page AccessDenied fallback).

**Functions**: edit demographics/contact/clinical basics/next-of-kin/photo;
changed fields highlighted (yellow ring) via diff against loaded snapshot.

**Processes**: `GET /patients/:id` → form; `PATCH /patients/:id`. `metadata`
is **merged with the existing record** (a wholesale replace previously erased
registration-time keys such as paymentType/insurance — fixed). NIN uniqueness
re-checked server-side; PATIENT_UPDATED audit row lists changed field names
only (no PII values).

**Inputs**: same field set as registration minus payment section; address
recomposed from location cascade.

**Outputs**: updated patients row + audit log; navigation back to profile;
`['patients']` and `['patient', id]` caches invalidated.

Element table: mirrors the registration form (inputs per section, webcam
modal, Save/Cancel). Save = 🔎 (metadata-merge fix verified by code + tsc;
update path exercised via deactivate/reactivate E2E). Cancel/Back = ✅.

---

## 5. Patient Search — `/patients/search` (`PatientSearchPage.tsx`)

**Who**: `patients.read`.

**Functions**: fast lookup console — search by name/MRN/phone with advanced
client-side filters (gender, age range, blood group, reg-date window),
recent-patients shortlist (localStorage, last 5), recent-encounters sidebar,
CSV export and print of results, keyboard-shortcut help modal.

**Processes**: `GET /patients?search=` (server) merged with local patient
store; filters applied client-side; recent encounters from `GET /encounters`.

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Search input + type selector | server search ≥2 chars | result list | — | ✅ |
| Advanced filters + Clear | client-side filter | narrowed list | — | 🔎 |
| Export CSV / Print list | client CSV / print | file/print | — | 🔎 |
| Result row click | profile + recent-list update | `/patients/:id` | — | ✅ |
| Row: View / Edit | `/patients/:id`, `/patients/:id/edit` | open pages | patients.update for edit | 🔎 |
| Row: Issue Token | `/opd/token?patientId=` | token pre-load | — | 🔎 |
| Row: New Visit | `/doctor/encounters/new?patientId=` | consultation | — | ✅ (was ❌ broken route) |
| Sidebar: encounter row | `/patients/:patientId` | profile | — | 🔎 |
| Quick actions: Register / OPD Token / Documents | respective routes | navigation | — | 🔎 |
| Keyboard help modal | local state | shortcut reference | — | 🔎 |

---

## 6. Patient Documents — `/patients/documents` (`PatientDocumentsPage.tsx`)

**Who**: `patients.read` (route); delete requires `patients.delete`, upload
`patients.update` (in-page).

**Functions**: cross-patient document workstation — pick a patient (search or
`?patientId=` deep link, added this block), browse by category tabs, list/grid
views, sort/filter (date range, uploader, text), multi-file drag-and-drop
upload with per-file progress, preview (authenticated blob; zoom/rotate for
images, iframe for PDFs), download, print, delete, bulk select + bulk delete.

**Processes**: category values now match the backend `DocumentCategory` enum —
**critical**: the backend lists documents through a role-based
`category IN (accessible)` filter, so rows saved with unknown category values
are stored but never listed again (silent black hole; the page previously used
invented values like `id_documents`). Uploads are one `POST
/patients/:id/documents` per file; delete is `DELETE
/patients/documents/:docId`; bulk delete iterates that endpoint.

**Inputs**: patient selection; files (pdf/jpg/png/dcm ≤50 MB); category;
description; filters.

**Outputs**: patient_documents rows + files; access counts on view/download;
deletions.

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Patient search / `?patientId=` deep link | `GET /patients` / `GET /patients/:id` | select working patient | — | 🔎 (deep link added) |
| Category tabs (8) | client filter | filtered list + counts | — | ✅ (was ❌ — values didn't exist in backend enum; uploads became invisible) |
| Upload modal: drop zone / picker / category / desc / start | `POST /patients/:id/documents` ×N | files stored w/ progress | patients.update | 🔎 |
| View (preview modal + zoom/rotate/prev/next) | blob fetch | inline preview | category access | 🔎 |
| Download / Print | blob fetch | save/print file | category access | 🔎 |
| Share → Generate link | `POST .../share` | share URL | — | ❌ no backend endpoint (P1 logged; button shows error toast) |
| Edit metadata (modal Save) | `PATCH .../documents/:id` | rename/recategorise | — | ❌ no backend endpoint (P1 logged) |
| Delete | confirmDialog → `DELETE /patients/documents/:id` | doc removed | patients.delete | ✅ API (was ❌ — wrong URL, always 404) |
| Bulk delete | sequential deletes | selected docs removed | patients.delete | 🔎 (was ❌ — endpoint never existed) |
| Bulk download | `POST .../bulk-download` | zip | — | ❌ no backend endpoint (P1 logged) |

---

## 7. Patient History — `/patients/history` (`PatientHistoryPage.tsx`)

**Who**: `patients.read`; clinical/billing sections gated by
`encounters.read` / `billing.read`.

**Functions**: longitudinal view — visits timeline/table with expandable
detail (diagnoses, prescriptions, orders, invoice amounts), filters + sort,
quick actions (edit, issue token to consultation/triage, new visit, documents,
copy MRN), print summary.

**Processes**: batch queries per selected patient: encounters (limit 100),
prescriptions, invoices, orders (single batch, no N+1); vitals fetched on
expand.

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Patient search + select | `GET /patients?search=` | load patient history | — | 🔎 |
| Quick actions: Edit | `/patients/:id/edit` | editor | — | 🔎 |
| Quick actions: Issue token (consult/triage) | `POST /queue` | queue entry | — | 🔎 |
| Quick actions: New Visit | `/doctor/encounters/new?patientId=` | consultation | — | ✅ (was ❌ broken route) |
| Quick actions: View Documents | `/patients/documents?patientId=` | documents page pre-selected | — | ✅ (was ❌ — pointed at a non-existent route) |
| Quick actions: Copy MRN | clipboard | MRN copied | — | 🔎 |
| Timeline/table toggle, filters, sort headers | client state | re-render | — | 🔎 |
| Visit: View Encounter | `/encounters/:id` | detail page | clinical route | 🔎 |
| Visit: Print Visit / Print Summary | printService | print artifact | — | 🔎 |
| Visit: Request Copy | toast only | none | — | 💀 placeholder (P1 logged) |
| Export to PDF / Excel | toast only | none | — | 💀 placeholders (P1 logged) |

---

## 8. Quick Registration modal (`components/QuickRegModal.tsx`)

Used from OPD token page when a walk-in isn't registered yet. Captures
fullName + phone only; submits `POST /patients` with gender `other` and DOB =
today (placeholder demographics — P1 data-quality note), invalidates
`['patients']`, hands the created patient back to the caller. Register button
✅ (used by OPD flow); error toast shows generic axios message (P2).

---

## 9. OPD Token — `/opd/token` (`OPDTokenPage.tsx`) — *recently rebuilt; verify pass*

**Who**: Receptionist.

**Functions**: POS-style token counter — search patient (or `?patientId=`
deep link, or Quick Reg), auto-prefilled "ticket" (payment from registration
metadata, follow-up + department inferred from last encounter ≤14 days),
edit-by-exception editors (complaint chips from `opd.common_complaints`
setting, visit type, department/doctor, payment incl. mobile-money/card/
insurance/membership/staff with biometric verification hooks, billing mode
pre/post-pay from tenant setting, condition flags), duplicate-queue guard,
issue → flash + auto-print + auto-reset, collapsible live queue strip with
remove-from-queue.

**Processes**: `POST /queue/validate` → `POST /queue`; queue + stats caches
invalidated; ticket print via printService; billing mode / consultation fee
from system settings; staff coverage check for staff payment type.

Verify pass result: clean — envelope handling defensive, invalidations
present, `?patientId=` honored (✅ via profile → Issue Token), no dead
buttons found. Element inventory retained in page (previous redesign E2E,
commit 180b1f1e).

---

## 10. Book Appointment — `/appointments/new` (`BookAppointmentPage.tsx`)

**Who**: Receptionist.

**Functions**: 4-step wizard (Patient → Department & Doctor → Date/Time →
Confirm) that books a **real appointment** in the appointments module.

**Processes**: `POST /appointments` — per-tenant appointment number
(APT…, advisory-locked), doctor double-booking check, status machine
scheduled → confirmed/checked_in/cancelled/no_show. Check-in later creates the
queue entry. *(This page previously created follow-ups — reception bookings
never appeared in the appointments list; the whole trio is now wired to the
appointments module.)*

**Inputs**: patient (search ≥2 chars), doctor (role-filtered `Doctor` users —
previously listed every active user), optional department (simple-mode
tenants without departments skip straight to doctor choice — added), date
(≥today), time slot (static list — P1: not yet driven by doctor_schedules),
reason.

**Outputs**: appointments row + number; `['appointments']` cache invalidated;
success card with booking summary.

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Patient search + result row | `GET /patients?search=` | select patient | — | ✅ |
| Change (patient) | reset selection | re-search | — | 🔎 |
| Department buttons | local select | filter context; optional when none configured | — | ✅ (dead-end for no-department tenants fixed) |
| Doctor buttons | local select | choose doctor | — | ✅ (was ❌ — listed all users; now role=Doctor) |
| Date picker + slot grid | local select | choose slot | — | ✅ |
| Reason textarea | local | reasonForVisit | — | ✅ |
| Back/Continue per step | step state | wizard nav | — | ✅ |
| Confirm Booking | `POST /appointments` | booked + success card | appointments.create (backend) | ✅ (was ❌ — created a follow-up instead) |
| Success: Book Another / View Appointments | reset / `/appointments` | next action | — | ✅ |

---

## 11. Appointments — `/appointments` (`ViewAppointmentsPage.tsx`)

**Who**: Receptionist.

**Functions**: day list of appointments with stats (total/scheduled/
confirmed/completed), server-side search + date + status filters, check-in
(creates queue ticket), reschedule/cancel via Manage, call patient (tel:).

**Processes**: `GET /appointments` `{data, meta}`; `POST
/appointments/:id/check-in` → queue entry (retry-safe: if the doctor isn't on
duty the appointment stays checked-in-able with an actionable error); status
enum matches backend (`no_show`, `checked_in`, …).

*(Previously rendered a fantasy shape — `patientName`/`date`/`time` fields
that don't exist — so the list was permanently empty and search crashed the
page. Rewritten.)*

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Book New | `/appointments/new` | wizard | — | ✅ |
| Search / date / status filters | server-side query | filtered list | — | ✅ |
| Stats cards | derived from page | day counts | — | ✅ |
| Row: Check in | `POST /appointments/:id/check-in` | queue ticket + toast | appointments.update (backend) | ✅ API (graceful 400 when doctor off-duty) |
| Row: Reschedule/Cancel | `/appointments/manage?id=` | manage panel pre-selected | — | ✅ (was ❌ — deep link pointed at a follow-up-based page and never matched) |
| Row: Call (tel:) | phone link | dial patient | shown only when phone exists | 🔎 |

---

## 12. Manage Appointments — `/appointments/manage` (`ManageAppointmentsPage.tsx`)

**Who**: Receptionist.

**Functions**: pick an actionable appointment (scheduled/confirmed/checked_in;
terminal ones hidden), reschedule (date + slot) or cancel (reason mandatory).

**Processes**: `PUT /appointments/:id` re-runs the double-booking check on the
new slot; `PATCH /appointments/:id/status {cancelled, reason}` enforces the
transition map and cascades a checked-in patient out of the queue. Backend
error messages surfaced inline. *(Previously operated on follow-ups.)*

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Search box | client filter (name/MRN) | narrow list | — | ✅ |
| Appointment card | select | detail + actions panel | — | ✅ |
| `?id=` deep link | preselect | arrives selected from View | — | ✅ |
| Reschedule tile → date + slots → Confirm | `PUT /appointments/:id` | new slot (conflict-checked) | appointments.update | ✅ API |
| Cancel tile → reason → Confirm Cancellation | `PATCH …/status` | cancelled + queue cascade | appointments.update | ✅ (live UI run) |
| Back buttons | reset action state | return to detail | — | ✅ |

---

## 13. Doctor Schedules — `/schedules/doctors` (`DoctorSchedulesPage.tsx`)

**Who**: Receptionist.

**Functions**: weekly availability grid (Mon-first) per doctor; add schedule
(doctor, day, start/end, slot duration, max patients, department, notes);
click-to-edit; delete.

**Processes**: `GET /schedules` returns `{data, grouped}` (grouped per
doctor); create/update enforce start<end and overlap rejection (409);
delete is a soft-remove. **This feature had never worked in production**: the
`doctor_schedules` table lacked the `tenant_id` column the tenant-hardened
service filtered on (every write 500'd, reads silently returned empty —
migration 77 adds the column + backfill + RLS), lacked `deleted_at` for the
soft delete (migration 78), and the "Add" modal's doctor list queried users
whose *name* contained "Doctor" (now `role=Doctor`).

| Element | Handler/target | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Week prev/next/Today | local state | shift week header dates | — | ✅ |
| Add Schedule → modal | `POST /schedules` | new grid entry | — | ✅ (was ❌ 500) |
| Modal doctor select | `GET /users?role=Doctor` | real doctor list | — | ✅ (was ❌ empty) |
| Grid cell (existing) | edit modal | update times/slots | — | ✅ (`PUT /schedules/:id`, overlap 409 ✅) |
| Modal Delete | confirmDialog → `DELETE /schedules/:id` | schedule removed | — | ✅ (was ❌ — MissingDeleteDateColumn 500; also native confirm → confirmDialog) |
| Modal Cancel / X | close | no change | — | ✅ |
| Doctor row label | — | shows `Dr. <fullName>` | — | ✅ (was ❌ "Dr. undefined undefined") |

---

## 14. Call Next Patient — `/queue/call` (`CallNextPatientPage.tsx`) — *verify pass*

17-line shell over the shared `CallNextPanel` (call / announce TTS+chime /
skip / no-show / recall, race-safe complete-then-call) with a service-point
selector persisted in localStorage and a "Manage queue" link to `/queue`.
Clean — verified during the call-station consolidation (commits 855a15f8,
48f35f0a).

---

## Cross-cutting notes

- **Payment preference** lives in `patients.metadata.paymentType` (no column);
  per-visit payment is chosen at token issuance. The registry filter reads the
  metadata key; "cash" includes patients with no recorded preference.
- **`/patients/hospital-scheme-enroll`** (HospitalSchemeEnrollmentPage) is a
  registration route but belongs to the insurance/membership flow — reviewed
  in Block 10.
- **Deferred P1s** are logged in `packages/frontend/frontend-review-queue.md`
  (Findings log, Block 1).
