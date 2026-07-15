# Module 02 — Nursing

> Frontend review completed 2026-07-15. All 34 nursing-related pages reviewed
> line-by-line. P0 fixes applied inline (permission gates, demo-mode guards,
> field name fixes, crash fix).

## Routes & Access

| Route prefix | Gate | Pages |
|---|---|---|
| `/nursing/*` | `NurseRoute` + `ModuleRoute module="nursing"` | 31 pages |
| `/vitals` | `ClinicalRoute` | VitalsPage (legacy) |
| `/ipd/nursing` | `NurseRoute` | IPDNursingNotesPage |
| `/emergency/triage` | via EmergencyRoutes | EmergencyTriagePage |

All 31 `/nursing/*` pages are lazy-loaded via `NursingRoutes.tsx`.

---

## 1. Triage Queue (`/nursing/triage` — TriageQueuePage)

### Functions
- View queue of patients sent to triage service point (auto-refreshes 30s)
- Call next patient (TTS announcement + chime, 3x repeat)
- Call specific patient by clicking row
- Start triage (calls patient then starts service — WAITING→CALLED→IN_SERVICE)
- Record ESI level (1-5), chief complaint, onset, duration, disposition
- Save triage draft (persists to queue.triageData without changing status)
- Resume saved draft on re-open (shift handover continuity)
- Complete triage with disposition transfer (OPD/Emergency/Direct Admit/Observation/Lab/Pharmacy)
- View patient's recent vitals timeline (last 10 readings with source + timestamp)
- Navigate to Record Vitals for the selected patient
- Drag-and-drop reorder queue (local only, resets after 5s)
- Sound notification for new arrivals (ambulance gets different tone)
- Configurable vital thresholds from tenant system setting `clinical.vital_thresholds`

### Processes
- Queue source: `queueService.getQueue({ servicePoint: 'triage' })`
- Status mapping: API `in_service`→UI `in-triage`; `completed|transferred`→`completed`
- Priority mapping: API 1→critical, 2-3→urgent, 4-5→semi-urgent, 6+→routine
- Complete triage: `queueService.completeTriage(id, disposition, triageData)` persists full assessment
- Stats computed client-side from current page of queue data

### Inputs
- Queue data with patient relations (fullName, mrn, dateOfBirth, gender)
- `chiefComplaintAtToken` from OPD token flow
- `patientConditionFlags`, `visitType` from queue entry
- Tenant-level vital thresholds setting

### Outputs
- Queue status transitions (WAITING→CALLED→IN_SERVICE→COMPLETED/TRANSFERRED)
- `triageData` JSONB on queue entry (persisted draft)
- Vitals display (read-only from vitals service)

| Element | Handler | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Call Next button | `callNextMutation` | Calls next waiting patient, TTS announce | `triage.update` | 🔎 code |
| Refresh button | `handleRefresh` | Re-fetches queue | `triage.read` | 🔎 code |
| Patient row click | `handleStartTriage` | Opens triage modal, starts service | `triage.update` | 🔎 code |
| Quick Triage button | `handleQuickTriage` | Opens quick modal (no call/start) | `triage.update` | 🔎 code |
| Call Patient button | `callPatientMutation` | Calls specific patient + TTS | `triage.update` | 🔎 code |
| Complete Triage | `handleCompleteTriage` | Completes triage with disposition | `triage.update` | 🔎 code |
| Save Draft | `handleSaveDraft` | Saves triage data to queue entry | `triage.update` | 🔎 code |
| Record Vitals link | `handleRecordVitals` | Navigate to /nursing/vitals/new | none | 🔎 code |
| Search input | `setSearchTerm` | Client-side filter | none | 🔎 code |
| Status filter | `setStatusFilter` | Client-side filter | none | 🔎 code |
| Drag reorder | `handleDragStart/Over/End` | Local reorder (resets 5s) | `triage.update` | 🔎 code |

---

## 2. Record Vitals (`/nursing/vitals/new` — RecordVitalsPage)

### Functions
- Search patients or select from triage/consultation queue
- Record vital signs: temperature (C/F toggle), pulse, BP, RR, SpO2, weight (kg/lbs), height (cm/ft), blood glucose, pain scale (0-10)
- Real-time clinical interpretation (bradycardia, hypertension, etc.)
- Critical value confirmation modal before saving
- Auto-create encounter if patient has none active
- Use Last Values shortcut (pre-fills from previous reading)
- Normal Ranges reference modal
- Quick tags for additional context
- Save & Continue / Save & Next Patient / Save & Go to Triage

### Processes
- Patient source: `patientsService.search` + queue entries from triage/consultation
- Encounter auto-creation: `encountersService.create()` if no active encounter
- Save: `vitalsService.create(data)` with 7 query invalidations
- Unit conversion: C↔F, kg↔lbs, cm↔ft (done client-side before save)

### Inputs
- Patient from search, queue, or navigation state
- Insurance policy (for encounter creation)
- Facility ID from `useFacilityId()`

### Outputs
- Vital record created in `vitals` table
- Encounter auto-created if needed
- NEWS/MEWS scores computed by backend on save

| Element | Handler | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Save & Continue | `handleSave('continue')` | Saves vitals, stays on same patient | `vitals.create` | 🔎 code |
| Save & Next | `handleSave('next')` | Saves vitals, resets for next | `vitals.create` | 🔎 code |
| Save & Triage | `handleSave('triage')` | Saves vitals, navigates to triage | `vitals.create` | 🔎 code |
| Use Last Values | `handleUseLastValues` | Pre-fills from previous reading | none | 🔎 code |
| Clear All | `handleClearAll` | Resets all fields | none | 🔎 code |
| Unit toggles | state setters | Converts display units | none | 🔎 code |
| Critical confirm | modal confirm | Proceeds with save | none | 🔎 code |

---

## 3. Vitals History (`/nursing/vitals/history` — VitalsHistoryPage)

### Functions
- View patient vital history in 3 modes: timeline, table, comparison
- Filter by date range, vital type, recorder, abnormal-only
- Sparkline trend summaries per vital sign
- Side-by-side comparison of up to 3 recordings
- Print, Export PDF/Excel (PDF/Excel are **stubs** — show success without generating)

| Element | Handler | Expected effect | Guard | Verified |
|---|---|---|---|---|
| View mode toggle | state setter | Switch timeline/table/comparison | none | 🔎 code |
| Export PDF | `handleExportPDF` | **STUB**: shows fake success toast | none | 💀 dead |
| Export Excel | `handleExportExcel` | **STUB**: shows fake success toast | none | 💀 dead |
| Print | `printService.printElement` | Prints via browser | none | 🔎 code |
| Pagination | state setters | Navigate table pages | none | 🔎 code |

**P1**: vitalTypeFilter dropdown exists but filter is never applied to data.

---

## 4. Vital Trends (`/nursing/vitals/trends` — VitalTrendsPage)

### Functions
- Line chart of vital sign trends for selected patient over date range
- Stats: current value, change from previous

**P1**: Uses manual `useEffect` fetch instead of `useQuery`. SVG chart has division-by-zero with single data point.

---

## 5. Abnormal Alerts (`/nursing/vitals/alerts` — AbnormalAlertsPage)

### Functions
- Displays client-side generated alerts from vital sign checks
- Filter by status (active/acknowledged/resolved) and severity

**Status**: Partially non-functional. Backend has no `GET /vitals` endpoint for bulk fetch. Alert generation is client-side only. Acknowledge/Resolve buttons show "feature coming soon" toast. Permission gate added (vitals.read).

---

## 6. VitalsPage (`/vitals` — legacy)

### Functions
- View current vitals for an encounter and patient vital history in table
- Record new vitals via modal form

**Fixed**: Field names corrected (bloodPressureSystolic→bpSystolic, heartRate→pulse, painScore→painScale). Permission gate added (vitals.read). Error toast added on mutation failure.

---

## 7. Nursing Assessment (`/nursing/assessment` — NursingAssessmentPage)

### Functions
- Structured head-to-toe assessment (10 body systems)
- Templates (admission/shift/quick)
- Mark All Normal per section
- Severity grading per section
- Saves as nursing note (serialized text)

**P1**: Assessment history is hardcoded mock data (fake names). "Save as Template" is unimplemented.

| Element | Handler | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Complete Assessment | `handleSave` | Saves to nursing note | `nursing.create` + `nursing.update` | 🔎 code |
| Mark All Normal | per-section handler | Sets all fields to normal | none | 🔎 code |
| Template selector | `handleApplyTemplate` | Pre-fills sections | none | 🔎 code |
| Save as Template | dropdown close only | **STUB** | none | 💀 dead |

---

## 8. Pain Assessment (`/nursing/pain` — PainAssessmentPage)

### Functions
- Wong-Baker FACES pain scale (0-10)
- Location, type, duration, radiation, factors, functional impact
- Saves as nursing note

---

## 9. Fall Risk (`/nursing/fall-risk` — FallRiskPage)

### Functions
- Morse-like fall risk scoring (8 factors with point values)
- Automatic risk level categorization (Low/Moderate/High)
- Recommendations based on score
- Saves as nursing note

---

## 10. Medication Schedule (`/nursing/meds/schedule` — MedicationSchedulePage)

### Functions
- Ward-level medication schedule dashboard (3 views: ward grid, patient cards, time-based)
- Real-time clock with overdue alerts + audio notification
- Quick filters: all/due-now/overdue/iv/controlled/prn
- Detail modal per medication with Quick Give/Hold/Refuse
- "5 Rights Verification" navigation to AdministerMedsPage

**Fixed**: Undefined `medications` variable (now `schedule`).

**P1**: `prescribedBy` hardcoded to "Dr. Attending"; `allergies` always empty; `isControlled` detected by string-matching drug names.

---

## 11. Administer Meds (`/nursing/meds/administer` — AdministerMedsPage)

### Functions
- 5-Rights medication administration wizard (patient→drug→dose/route/time verification)
- MRN scan/entry for patient ID
- Actions: Give/Hold/Refuse/Not Available with reasons
- Injection site selection, witness input, PIN confirmation
- Controlled substance handling

**P1**: Empty MRN bypasses verification (line 316). Allergy/vitals/NPO panels never populated from upstream.

| Element | Handler | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Give | `handleAdminister` | Records administration | `pharmacy.dispense` or `nursing.write` | 🔎 code |
| Hold | `handleAdminister` | Records hold with reason | same | 🔎 code |
| Refuse | `handleAdminister` | Records refusal | same | 🔎 code |
| Print Label | `handlePrintLabel` | **STUB**: toast only | none | 💀 dead |

---

## 12. Medication Chart (`/nursing/meds/chart` — MedicationChartPage)

### Functions
- Read-only medication chart view for selected patient by date
- Time-based grid display

**P1**: Export button has no onClick handler (dead button).

---

## 13. Drug Allergies (`/nursing/meds/allergies` — DrugAllergiesPage)

### Functions
- Full CRUD for patient allergies/intolerances
- Category, type, severity, source, verification fields
- Inactivate/Reactivate/Delete with confirmDialog
- Uses real `allergiesService` endpoints

**Best-implemented page in the module** — uses real services, confirmDialog, proper mutations.

| Element | Handler | Expected effect | Guard | Verified |
|---|---|---|---|---|
| Save Allergy | `handleSave` | Creates allergy record | `allergies.read` (gate) | 🔎 code |
| Inactivate (ShieldOff) | direct mutation | Inactivates without confirm | none | 🔒 unguarded |
| Inactivate (Trash) | `handleDelete` | Inactivates with confirm | none | 🔎 code |
| Delete | `handleDeletePermanent` | Hard deletes with confirm | none | 🔎 code |
| Reactivate | `handleReactivate` | Reactivates allergy | none | 🔎 code |

---

## 14-16. Wound Management

### WoundAssessmentPage (`/nursing/wounds/assess`)
Body map, wound staging, measurements, photo upload, treatment plan. Saves as nursing note.
**P0 (structural)**: `patientWounds` state never populated from API — wound list always empty. Body map markers never appear. Photos are local-only.

### DressingLogPage (`/nursing/wounds/dressing`)
**P0 (structural)**: Hardcoded empty `wounds`/`dressingEntries` — "Add Entry" button never appears. Entire page non-functional.

### WoundProgressPage (`/nursing/wounds/progress`)
**P0 (structural)**: `progressData` always returns `[]`. Chart always empty.

**Root cause**: No wound entity/table/API on backend. Three pages try to piggyback on nursing notes but don't interoperate (WoundAssessment saves type `'assessment'`, WoundProgress filters `'observation'`).

---

## 17-20. Clinical Procedures

### IVCannulationPage (`/nursing/procedures/iv`)
Document IV cannula insertions (gauge, site, attempts, flush, complications). Saves as nursing note.

### CatheterizationPage (`/nursing/procedures/catheter`)
Document urinary catheter insertions (type, size, balloon, output/color). Saves as nursing note.

### SpecimenCollectionPage (`/nursing/procedures/specimen`)
**P1**: Sends fake `orderId`/`labTestId` (client-generated `SP-XXXXXXXX`) to `labService.samples.collect()`. Most form fields not sent to API.

### ProcedureLogPage (`/nursing/procedures/log`)
General procedure log. Saves as pipe-delimited nursing note.
**P1**: Fragile pipe-delimited parsing breaks if notes contain `|`.

---

## 21. Care Plans (`/nursing/care-plans` — CarePlansPage)

### Functions
- NANDA-I nursing diagnosis builder with SMART goals, interventions, evaluations
- Templates (post-surgical, wound, mobility)
- In-memory-only structured data; one-time text dump to nursing note on save

**P0 (structural)**: Plans stored only in React state — lost on refresh. No backend care plan entity.

---

## 22. Nursing Notes (`/nursing/notes` — NursingNotesPage)

### Functions
- Rich nursing notes editor with DAR format
- Voice-to-text (SpeechRecognition API)
- Templates, quick phrases, formatting toolbar
- Late entry flagging, linked interventions
- Filter by type/author/date/search
- Print and Export as .txt

**P1**: Silent fail when no admission (returns early without error toast).

---

## 23. Shift Handover (`/nursing/handover` — ShiftHandoverPage)

### Functions
- SBAR-format shift handover with patient lists
- Safety checklist (required items)
- Incoming nurse selection
- Print report, email summary
- Uses real admissions API, saves handover notes

**P1**: Patient vitals in handover are hardcoded (always 36.8/78/120/80/16/98). `admission.priority` doesn't exist on entity — all patients appear "stable".

---

## 24. Patient Education (`/nursing/education` — PatientEducationPage)

### Functions
- Record patient education sessions (category, topic, understanding, materials)
- Saves as nursing note

**P1**: No historical display — always shows "No education records found".

---

## 25. Patient Monitor (`/nursing/monitor` — PatientMonitorPage)

### Functions
- Dashboard showing vitals for all admitted patients
- Ward filter, critical-only toggle
- Real vitals data via `useQueries` per-patient
- Navigate to Record Vitals / History

**P1**: Eye button has no onClick handler (dead). Missing `patientVitals` in useMemo deps.

---

## 26. Intake/Output (`/nursing/io` — IntakeOutputPage)

### Functions
- Fluid balance tracker with hourly charts, shift summaries
- Quick action buttons (void/foley/flush presets)
- Recharts ComposedChart visualization
- Saves as nursing note with intakeOutput field

**P0 (structural)**: Data in local state only — always starts empty, lost on refresh.

---

## 27. Blood Sugar (`/nursing/glucose` — BloodSugarPage)

### Functions
- Blood glucose readings with insulin tracking
- Stats and trend display
- Saves as nursing note

**P0 (structural)**: Readings in local state only — always starts empty on refresh.

---

## 28. Observation Chart (`/nursing/observations` — ObservationChartPage)

### Functions
- Neurological observation chart (GCS, AVPU, pupils, limb movement)
- Saves as nursing note

**P0 (structural)**: Observations in local state only.

---

## 29-32. Reports & Shift

### NursingDailyReportPage (`/nursing/reports/daily`)
**P1**: `ipdStats.proceduresToday`/`medicationsToday`/`criticalAlerts` are fantasy fields (always 0). Staff list always empty. Date picker not wired to query.

### ShiftSummaryPage (`/nursing/reports/shift`)
**P1**: `admission.priority` is fantasy field — critical patients always empty. Pending tasks hardcoded empty. Date/shift selectors not wired.

### IncidentReportPage (`/nursing/reports/incident`)
Incident reporting with severity, contributing factors, corrective actions. Saves as nursing note.
**P1**: Save Draft and Email are stubs. Reference numbers are fake (not tracked).

### WorkloadStatsPage (`/nursing/reports/workload`)
**P1**: All metrics fabricated (procedures = patients * 0.5, medications = patients * 3, acuity chart hardcoded).

---

## 33. WardManagementPage (`/pages/WardManagementPage.tsx`)

### Functions
- Ward CRUD, bed map, admission table
- Admits patients via modal

**P1**: Notes/Transfer/Discharge buttons in admissions table are dead (no onClick). Ward creation uses `facilities[0].id` (wrong in multi-facility). No permission gate.

---

## 34. IPD Nursing Notes (`/ipd/nursing` — IPDNursingNotesPage)

### Functions
- Alternative nursing notes view for IPD with admission sidebar
- Medication administration record (MAR) tab

**P1**: Field names drift (`noteType` vs `type`, `recordedBy` vs `nurse`). Edit note button dead. Administer button dead. No permission gate.

---

## P0 Fixes Applied (this commit)

| Fix | Pages affected | Description |
|---|---|---|
| Fantasy field names | VitalsPage.tsx | `bloodPressureSystolic`→`bpSystolic`, `heartRate`→`pulse`, `painScore`→`painScale` + use vitalsService |
| Undefined variable crash | MedicationSchedulePage.tsx | `medications.find()`→`schedule.find()` |
| Demo-mode silent success | 12 pages | `toast.error('Patient must be admitted...')` instead of fake success |
| Permission gates | 21 pages | Added `usePermissions` + `AccessDenied` on all ungated pages |
| Nonexistent endpoint | AbnormalAlertsPage.tsx | Removed broken `GET /vitals` call |
| Error/success toasts | VitalsPage.tsx | Added `onError` toast to mutation |

## P1 Deferred

- Wound management (3 pages): No wound entity on backend — pages need backend-first work
- Care plans, I/O, blood sugar, observations: Data in local state only (lost on refresh) — need backend entities
- VitalTrendsPage: Manual useEffect → useQuery conversion; SVG division-by-zero
- VitalsHistoryPage: Fake export buttons; unused vitalTypeFilter
- MedicationSchedulePage: Fantasy prescribedBy/allergies/controlled detection
- AdministerMedsPage: Empty MRN bypasses verification; allergy panels never populated
- ShiftHandoverPage: Hardcoded vitals; fantasy `admission.priority`
- Report pages: Fantasy stats fields; fabricated workload data; date pickers not wired
- SpecimenCollectionPage: Fake orderId/labTestId; most fields not sent
- ProcedureLogPage: Fragile pipe-delimited parsing
- NursingNotesPage: Silent fail without admission
- IncidentReportPage: Save Draft + Email stubs; fake reference numbers
- WardManagementPage: Dead action buttons; hardcoded facility
- IPDNursingNotesPage: Field name drift; dead Edit/Administer buttons

## Architectural Note

The nursing module uses **nursing notes as a universal backend** — every specialized
page (care plans, I/O, blood sugar, observations, wound assessment, procedures, etc.)
serializes structured clinical data into a single text field on a nursing note. This means:
- No queryable structure for any of these domains
- No historical retrieval (pages always start empty)
- Dashboard/chart data computed only from session-local state
- The backend has one endpoint (`POST /ipd/nursing-notes`) serving all use cases

Proper implementation would require dedicated entities/tables/APIs for at least:
care plans, I/O tracking, blood sugar monitoring, neurological observations,
wound management, and incident reports.
