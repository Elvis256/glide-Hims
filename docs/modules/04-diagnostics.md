# Module 04 — Diagnostics (Laboratory · Lab QC · Lab Admin · Radiology)

Frontend review, Block 4 of the registration→admin campaign. Covers every
diagnostics-producer view: the lab worklist and result pipeline, QC, the lab
master-data admin pages, and the radiology reporting workstation. The
result-*consumer* pages (doctor's Lab/Imaging/Critical result viewers) belong to
Block 3 (Doctors).

**tsc gate:** frontend 0 / backend 0 (cold). **Verification:** line-by-line
read of all 18 views against the hunt list + backend entities/DTOs; API-level
E2E on tesy (minted staff JWT) confirming the lab orders pipeline. Live
browser E2E (login→drive) not yet run — needs the Dan password.

## Routes & reachability

| Route | Page | Guard | Notes |
|---|---|---|---|
| `/lab` | — | LabTechRoute | **Redirects to `/lab/queue`** (was the broken LabPage, now removed) |
| `/lab/queue` | LabQueuePage | LabTechRoute · diagnostics | Canonical lab worklist |
| `/lab/samples` | SampleCollectionPage | LabTechRoute | Phlebotomy / collection |
| `/lab/results` | ResultsEntryPage | LabTechRoute | Result entry + validate/release |
| `/lab/reports` | LabReportsPage | LabTechRoute | Print / PDF / share reports |
| `/lab/analytics` | LabAnalyticsPage | LabTechRoute | Read-only KPIs |
| `/lab/sample-referrals` | SampleReferralPage | LabTechRoute | Inter-facility referral |
| `/lab/critical-results` | CriticalResultsReadOnlyPage(lab) | LabTechRoute | QA read-only |
| `/lab-qc/dashboard` | LabQCDashboardPage | LabTechRoute | Levey-Jennings / Westgard |
| `/lab-qc/consumables` | LabConsumablesPage | LabTechRoute | Reagent stock + expiry |
| `/admin/lab/tests` | TestCatalogPage | AdminRoute | Lab test master |
| `/admin/lab/equipment` | LabEquipmentPage | AdminRoute | Analyzer registry |
| `/admin/lab/reagents` | ReagentsInventoryPage | AdminRoute | Reagent inventory (stale — see findings) |
| `/admin/lab/panels` | LabPanelsPage | AdminRoute | Test bundles |
| `/radiology` | RadiologyPage | RadiologyRoute · diagnostics | Hub (worklist/orders/pending) |
| `/radiology/queue` | RadiologyQueuePage | RadiologyRoute | Ops queue (schedule/start/complete) |
| `/radiology/orders` | ImagingOrdersPage | RadiologyRoute | Full order lifecycle + create |
| `/radiology/results` | RadiologyResultsPage | RadiologyRoute | Radiologist reporting workstation |
| `/radiology/analytics` | RadiologyAnalyticsPage | RadiologyRoute | Read-only KPIs |
| `/radiology/critical-results` | CriticalResultsReadOnlyPage(radiology) | RadiologyRoute | QA read-only |

**Three distinct status vocabularies** run through this module and must not be
conflated: an **Order** (`OrderStatus` = pending·in_progress·completed·cancelled);
a **LabSample** (`SampleStatus` = pending_collection·collected·received·
processing·completed·rejected); and a **LabResult** (`AbnormalFlag` = normal·low·
high·critical_low·critical_high·**abnormal**). `abnormal` is the lab's
*fail-closed* "out of range, direction unknown" flag and is escalated as
critical — it must never render as normal.

---

## Findings (this block)

### P0 — fixed
- **`/lab` white-screened** (`8f…` — LaboratoryRoutes). LabPage read
  `order.encounter.patient.fullName` but `orders.list` flattens patient to a
  top-level `patient` key and returns no `encounter`; an `as any` hid it. The
  page is orphaned (nothing links to it; SmartDashboard → `/lab/queue`).
  Redirected the index to `/lab/queue`.
- **Radiology critical findings never alerted** (PATIENT SAFETY). Sign /
  Sign&Alert POSTed no `isCritical`/`findingCategory`, so
  `criticalResultsService.flag()` never fired — a critical imaging finding was
  stored as normal with no closed-loop alert. Now sends both.
- **Printed lab report could print critical/ABNORMAL as Normal** (PATIENT
  SAFETY). `lib/labReport.ts` recomputed flags numerically and never saw the
  stored `abnormalFlag`. Now prefers the authoritative flag.
- **"Fake QC pass"** (PATIENT SAFETY). QC-run form toasted success (green PASS)
  but `labService.qc` did not exist, so nothing recorded. Replaced with an
  honest "not available — configure QC materials" error.
- **Lab panels never loaded or saved** — GET `?key=` hit findAll (array), POST
  `/settings` had no route (404). Now GET/PUT `/settings/lab_panels`.
- **Test edit + enable/disable 400'd** — sent keys off `UpdateLabTestDto` /
  `{isActive}`. Now DTO-exact subset + `status` enum toggle.
- **Radiology "Mark Complete" always 400'd** — body keys off `PerformImagingDto`.
  Folded into `technologistNotes`.

### P1 — fixed
- **Vanishing lab worklist** — `/orders` defaults to 20 rows; queue/collection/
  analytics passed no limit, so older pending orders dropped off. Now `limit:200`.
- **"View Encounter" dead-ended lab techs** — `/encounters/:id` is Doctor/Nurse
  only; the button now renders only for clinical roles.
- Radiology study-type column/search (`examType`→`studyType`); critical-results
  "Acknowledged by" (`firstName/lastName`→`fullName`).

### Flagged — needs backend / a human decision (unapplied)
- **Reagent create 500s** (`lab_reagents.code`/`unit_size` NOT NULL, generated by
  neither DTO nor service) — blocks "Add Reagent" on both lab pages.
- **Reagent lot receive 500s** — `receiveLot` reads `initialQuantity` but the DTO
  field is `quantity`; `initial_quantity` NOT NULL insert fails.
- **QC dashboard non-functional** — no QC-material picker (record impossible);
  results query passes `testCode='all'`/test-name into a code column (empty
  table); summary cards read fields the endpoint doesn't return.
- **Admin ReagentsInventoryPage + LabEquipmentPage are stale shapes** — uppercase
  enums + non-whitelisted bodies (every write 400s) + fantasy reads (reagent
  `expiryDate`; equipment calibrations/maintenances not joined by the list).
  Recommend rewrite to mirror LabConsumablesPage, or redirect.
- **Sample-referral stuck at `collected`** — no UI advances collected→packaged→
  in_transit, so the hub can never receive. Backend allows the forward jump;
  needs a UI affordance.
- **Radiologist productivity table** keys on a fantasy `assignedTo` — always
  empty; needs a backend join to `imaging_results.reportedBy`.
- Lower: TestCatalog `cost`/margin are fantasy (entity has `price`); LabReports
  email share is a no-op (SMTP not configured); several PACS-viewer controls on
  RadiologyResultsPage are placeholders.

---

## Element tables & functional map

### LabQueuePage — `/lab/queue`
*Functions:* Lab tech triages `orderType=lab` orders by priority; collect
samples, assign techs, start/complete, return-to-doctor, call patients.
*Processes:* Order pending→in_progress→completed|cancelled; Complete gated on
all lab_results `released` (client + server `assertLabResultsReleased`); collect
creates a `lab_samples` row and advances the order. *Inputs:* facilityId
(required), providers (`lab_technician`, active), queue entries, return-to-lab
encounters. *Outputs:* sample records, status transitions, `assignedTo`, printed
labels.

| Element | Handler | Effect | Guard | State |
|---|---|---|---|---|
| Refresh / Call Next | refetch / queueService.callNext | Reload / call+TTS | lab.read | ✅ |
| Status·Priority·Test filters, quick chips, clear | set state | Client filter (no `cancelled` option) | — | ✅ 🔎 |
| Select-all / row checkbox / Complete Selected | updateStatus per eligible | Complete released-only; skip toast | orders.update | ✅ |
| Row Call / Collect / Print / Assign (+ Assign to me) | queue / modal / print / orders.assign | Call·collect·labels·assign | lab.* | ✅ |
| Row Results / Complete / View / Doctor | nav /lab/results · updateStatus · modal | Enter results·complete·view·return | LabTech / orders.update | ✅ |
| View modal → View Encounter | nav /encounters/:id | Open visit | **clinical role only** | ✅ (was ❌ for lab tech) |
| Collect modal → Confirm / Print | collect + startProcessing | Sample + advance | lab.create/update | ✅ |
| Return-to-Doctor modal | PATCH /encounters/:id/return-to-doctor | Return encounter | encounters.update | 🔎 |

### SampleCollectionPage — `/lab/samples`
*Functions:* phlebotomy worklist; resolve test by code/name, record sample +
collector + tube, print barcode. *Processes:* collect → order in_progress;
sample enters `collected`. *Inputs:* pending orders (limit 200), scan/search,
sample-type, collector. *Outputs:* `lab_samples` row, order advance, label.

| Element | Handler | Effect | Guard | State |
|---|---|---|---|---|
| Scan / search / sample-type / collected-by | state | Match & select | — | ✅ |
| Mark as Collected | getByCode→collect→updateStatus | Sample + advance + barcode modal | lab.create/update | ✅ |
| Print label / Close | printService | Print/close | — | ✅ |
| "Collected Today" card | stats.collected | — | — | ❌ always 0 (dataset is pending-only) |

### ResultsEntryPage — `/lab/results`
*Functions:* enter parameter values per sample, verify, send-to-doctor
(validate+release), critical-value acknowledgement. *Processes:* the enter DTO
sends only value/range — **the backend computes the authoritative flag** (incl.
fail-closed ABNORMAL); the client `getResultStatus` drives only the local
critical-alert prompt. Send-to-doctor validates then releases each result.
*Inputs:* reference ranges from the test, entered values, comments. *Outputs:*
lab_results rows, validate/release transitions, critical alerts.

| Element | Handler | Effect | Guard | State |
|---|---|---|---|---|
| Sample list / select | query | Load parameters | lab.read | ✅ |
| Parameter value inputs | state; live status hint | Normal/Abnormal/Critical hint | — | ✅ (qualitative → hint 'Normal'; backend flag governs) |
| Verify | enterResultMutation | Persist results (flag computed server-side) | lab.update | ✅ |
| Critical-alert dialog / acknowledge | state + mutation | Prompt to contact physician | — | ✅ |
| Send to Doctor | validate+release each | Release to physician; critical toast | lab.update | ✅ |

### LabReportsPage — `/lab/reports`
*Functions:* assemble completed samples → per-patient reports; print/PDF/share.
*Processes:* status derived from stored `abnormalFlag` on screen AND (now) in
the printed/PDF document. *Inputs:* facility, institution info, print format.
*Outputs:* printed/exported reports, WhatsApp/SMS summaries.

| Element | Handler | Effect | Guard | State |
|---|---|---|---|---|
| Patient search / select / format toggle / expand | state | Browse reports | lab.read | ✅ |
| On-screen result rows | status from abnormalFlag | Correct colour | — | ✅ |
| Print / Download PDF | printLabReport / generatePdf | Uses authoritative flag | — | ✅ (was ❌) |
| Email / WhatsApp / SMS | handleOpenShare | Email no-op; WA/SMS external | — | ⚠️ email placeholder |

### SampleReferralPage — `/lab/sample-referrals`
*Functions:* inter-facility referral of samples with cold-chain/TAT tracking.
*Processes:* create @ collected; forward-only stage machine
collected→packaged→in_transit→received_at_hub→processing→result_ready→
delivered|rejected; number `SRF-YYYYMM-NNNNN` advisory-locked. *Inputs:*
sample, destination facility, priority, transport. *Outputs:* sample_referrals
rows, stage timestamps, dashboards.

| Element | Handler | Effect | Guard | State |
|---|---|---|---|---|
| Tabs (Dashboard/Create/Track/Hub) | setActiveTab | Switch | — | ✅ |
| Create → submit | sampleReferralService.create | Referral @ collected | lab.create | ✅ |
| Track: stage filter / expand | state | View (no advance buttons) | — | 🔎 (view-only) |
| Hub: Receive / Process / Result Ready / Deliver | updateStage | Advance | lab.update | 🔎 **unreachable** — nothing advances `collected→in_transit` |
| Hub: Reject | reject + reason | Stage→rejected | lab.update | ✅ |

### LabAnalyticsPage — `/lab/analytics`
*Functions:* read-only lab KPIs (volume, TAT, rejection, category/priority).
*Inputs:* facility, time range, orders (limit 200). *Outputs:* charts only.

| Element | Handler | State |
|---|---|---|
| Critical-results overview widget · time-range · KPI cards · daily bars · top tests · donut | queries / derived | ✅ |
| "Tests by Category" / "Avg TAT by Category" | test.category | ❌ always "Other" (order testCodes carry no category) |

### CriticalResultsReadOnlyPage (lab & radiology) — `/lab|radiology/critical-results`
*Functions:* QA view for the roles that *flag* criticals — flagged alerts, ack
progress, SLA breaches; no acknowledge action (that's the receiving clinician's
loop). *Processes:* `/critical-results?resourceType=…` filtered by
flaggedByMe/status; server SLA cron escalates overdue pendings. *Outputs:* none.

| Element | Handler | State |
|---|---|---|
| Refresh (60s auto) · filter pills (Mine/Pending/SLA breached/All) · overview widget · alert rows | query / setFilter | ✅ (`abnormal`→amber, never green; "Acknowledged by" now populated) |

### LabQCDashboardPage — `/lab-qc/dashboard`
*Functions:* QC monitoring (Levey-Jennings + Westgard). *Reality:* recording
impossible without QC materials; results query keyed wrong; summary cards read
fantasy fields. Records nothing today (safety illusion removed).

| Element | Handler | State |
|---|---|---|
| New QC Run → Record | (was fake success) | 🔒 now honest error, no fake pass |
| z-score preview · Export CSV · date range · filters | state / query | 🔎 (empty until backend wiring) |
| Stat cards / LJ charts / results table | getSummary / results | ❌ only Total real; table empty (testCode='all', fantasy summary fields) |

### LabConsumablesPage — `/lab-qc/consumables`
*Functions:* reagent stock & expiry. *Reality:* reads correct (lowercase enums,
lot-aggregated expiry); writes fail backend-side.

| Element | Handler | State |
|---|---|---|
| List / search / category / stock filter · stat cards · badges | reagents.list | ✅ read (real lot aggregates) |
| Add Item → save | reagents.create | ❌ 500 (backend code/unit_size NOT NULL) |
| Receive Stock → save | reagentLots.receive | ❌ 500 (backend initialQuantity) |
| Row Edit | modal | 💀 modal only renders when `!editingItem` |

### TestCatalogPage — `/admin/lab/tests`
*Functions:* lab-test master (CRUD, pricing, reference ranges).

| Element | Handler | State |
|---|---|---|
| Search / category / sampleType filters | state | ✅ (lowercase enums) |
| Add Test → Create | tests.create | ✅ 🔎 |
| Edit → Update | tests.update (subset) | ✅ (was ❌ 400; sampleType/fasting/instructions not editable — DTO gap) |
| Enable/Disable toggle | toggleActive(id,isActive)→status | ✅ (was ❌ 400) |
| Import/Export CSV · reference-range editor | create per row / state | 🔎 (silent row errors) |
| Cost column / Avg Margin · MoreHorizontal | t.cost / — | ❌ fantasy / 💀 no handler |

### LabPanelsPage — `/admin/lab/panels`
*Functions:* bundled test panels (savings pricing), stored as one
`system_settings` blob under `lab_panels`.

| Element | Handler | State |
|---|---|---|
| Load / Create/Edit → Save | GET·PUT /settings/lab_panels | ✅ (was ❌ — findAll array / POST 404) |
| Test picker · duplicate/toggle/delete · filters · export | tests.list / saveMutation | ✅ 🔎 |

### LabEquipmentPage — `/admin/lab/equipment`
*Functions:* analyzer registry + calibration/maintenance. *Reality:* list reads
but uppercase-enum breaks display/filters/stats; **all writes 400**; history
panel empty (list endpoint omits the relations).

| Element | Handler | State |
|---|---|---|
| List / filters · status badge | GET /equipment | ❌ status casing → blank badge, broken filter/stats |
| Add / Edit / Decommission | POST·PUT | ❌ 400 (non-whitelisted + uppercase; native confirm) |
| Record Calibration / Maintenance | POST /calibration·/maintenance | ❌ 400 (field mismatch) |
| History panel | eq.calibrations/maintenances | ❌ empty (not joined by list) |

### ReagentsInventoryPage — `/admin/lab/reagents`
*Functions:* (duplicate of Consumables) reagent inventory. *Reality:* stale
uppercase-enum + fantasy `expiryDate`; every write 400/500; category filter
empty; Expiry column dead. Should mirror LabConsumablesPage or redirect.

| Element | Handler | State |
|---|---|---|
| List / search | GET /reagents | 🔎 read |
| Category filter · Expiry column | query / reagent.expiryDate | ❌ uppercase→empty / fantasy field |
| Add / Edit / Deactivate / Receive / Import | POST·PUT·receive | ❌ 400/500 |
| Generate Purchase Order | — | 💀 no handler |

### RadiologyPage (hub) — `/radiology`
*Functions:* technologist/radiologist worklist across Worklist / All Orders /
Pending Reports; start→complete→report. *Processes:* ordered→scheduled→
in_progress→completed→reported (cancel pre-report); report triggers GL post
(if price>0), notify ordering doctor, patient SMS (suppressed if critical),
critical/abnormal → closed-loop flag. *Outputs:* status transitions,
ImagingResult, notifications, GL journal.

| Element | Handler | State |
|---|---|---|
| Refresh · 3 tabs · search · modality filter · row select | loadData / state | ✅ 🔎 |
| Start / Complete / Create Report (by status) | start · modal · modal | 🔎 (UI unguarded vs permission) |
| Complete modal → submit | POST /complete {technologistNotes} | ✅ (was ❌ 400) |
| Report modal: category · critical checkbox · auto-keyword · submit | POST /radiology/results (findingCategory, isCritical) | ✅ (flags + notifies) |

### RadiologyQueuePage — `/radiology/queue`
*Functions:* modality/priority/status-filtered ops queue; schedule/start/complete.

| Element | Handler | State |
|---|---|---|
| Refresh · search · filters | refetch / state | ✅ (study search fixed; `pending` status option is dead) |
| Study Type column | studyType | ✅ (was blank) |
| Schedule / Start / Complete | modal · POST /start · /complete | 🔎 (no error toasts) |
| Schedule modal notes | state | 💀 (collected, never sent) |

### ImagingOrdersPage — `/radiology/orders`
*Functions:* full order lifecycle incl. **create** (only view that does) + cancel.

| Element | Handler | State |
|---|---|---|
| New Order (patient/modality/studyType/indication/priority) → Create | createOrderMutation | ✅ |
| Row select · Schedule · Start · Complete · Cancel | modals / mutations | ✅ (Cancel has no confirm dialog) |

### RadiologyResultsPage — `/radiology/results`
*Functions:* radiologist reporting workstation (PACS placeholder + templates +
local drafts + sign). *Processes:* lists completed orders; Sign → createResult →
reported → (now) critical flag + notify.

| Element | Handler | State |
|---|---|---|
| Search/status · study select · templates · findings/impression/recs · draft (auto 30s) | state / localStorage | ✅ 🔎 |
| PACS viewer · presets/zoom/thumbnails · Open External · dictation mic | local state | 💀 placeholders |
| Critical Finding Alert checkbox | setShowCriticalAlert | ✅ (now flows to isCritical) |
| Sign Report / Sign & Alert Physician | POST /radiology/results (isCritical) | ✅ (was 💀 — flag dropped; add success/error toast — P2) |

### RadiologyAnalyticsPage — `/radiology/analytics`
*Functions:* read-only KPIs (volume, TAT, utilization, critical findings).

| Element | Handler | State |
|---|---|---|
| Period · KPI cards · modality/heatmap/TAT/volume · critical-findings KPI (server-aggregated, joins imaging_results) | queries / derived | ✅ |
| Total Revenue · Revenue Distribution | hardcoded 0 | 💀 (no source) |
| Radiologist Productivity table | order.assignedTo | ❌ always empty (fantasy field) |

---

*State legend:* ✅ works · 🔎 code-verified only · ❌ broken · 💀 dead/placeholder
· 🔒 UI unguarded vs backend permission · ⚠️ known limitation.
