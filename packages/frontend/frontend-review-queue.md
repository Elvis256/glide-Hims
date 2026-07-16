# Frontend Module Review Queue — line-by-line, registration → admin

Mirror of the backend journey review (2026-07, 20 blocks, complete). This pass
covers the FRONTEND: every page read line-by-line + live E2E probe per module.
Work top-to-bottom; mark blocks ✅ with commit hashes as they complete.

## Deliverable (per block): FUNCTIONAL MAP + fixes
Write `docs/modules/<nn>-<module>.md` documenting, for every page/flow:
- **Functions** — what the user can do (each capability, who's allowed)
- **Processes** — the workflow behind it: state machines, statuses, numbering,
  crons/events touched, integration points (billing, queue, GL, notifications)
- **Inputs** — forms/fields (required vs optional), URL params, upstream data
  it consumes (e.g. token → complaint → consultation), settings that alter it
- **Outputs** — records created/updated (tables), documents + numbers issued,
  printed artifacts, queue/status transitions, downstream effects
This doubles as training/sales/deployment documentation.

**Element-level coverage is mandatory.** For every VIEW (page, tab, modal,
panel, drawer) the functional map includes a table of EVERY interactive
element — button, link, icon-action, toggle, row-click, keyboard shortcut:

| Element | Handler/target | Expected effect | Guard (perm/role) | Verified |
|---|---|---|---|---|

Verification states: ✅ works (E2E-probed) · 🔎 code-verified only · ❌ broken
· 💀 dead (no-op onClick, unreachable route, always-disabled) · 🔒 unguarded
(acts without required permission). Every ❌/💀/🔒 is a finding: fix P0s
inline, log the rest. No view is done until its element table is complete.

## Method (per block)
1. Inventory: routes + pages + components + services the module touches
   (`routes/*.tsx` → pages → services). Note dead routes / unreachable pages.
2. Line-by-line page read. Hunt list (from completed sweeps + known bug classes):
   - Envelope bugs: `return response.data` where controller wraps `{message,data}` / paginated `{data,total}` (30 fixed in 5cd0a531 — check module-local services + inline `api.get` calls in pages)
   - Status filters pinned to first state only ("vanishing worklist" class)
   - Missing loading/error/empty states; `.map` on possibly-wrapped responses
   - Mutations without invalidateQueries; stale caches after writes
   - Permission gates: page-level guard present but buttons unguarded (or vice versa)
   - window.confirm → confirmDialog (bridge in ConfirmDialog.tsx, 7e5191c3); raw alert() (should be none)
   - Manual useEffect fetch → useQuery (pattern: 6f30d12a)
   - Type-union gaps vs backend enums (pending_payment class, fixed in queue.ts)
   - Hardcoded facility/tenant assumptions; x-facility-id handling
   - PII ciphertext display (displayable() guard pattern)
3. E2E probe on tesy tenant (Dan login; playwright at /root/pro/node_modules/playwright; creds/method in memory). Exercise the module's main flow live.
4. Fix P0s immediately in the block's commit; log P1s/features here.
5. tsc gate: **`npm run typecheck`**
   (= `tsc --noEmit -p tsconfig.app.json --incremental false`), then
   `| grep <touched>`; build to /tmp to verify, real build only when deploying
   (dist/ is production).
   ⚠️ TWO ways this gate silently reports success on broken code — both bit us:
   - NEVER use bare `npx tsc --noEmit`. The root tsconfig.json is `files: []`
     + references, so it type-checks ZERO files and always exits clean. That
     no-op was the "gate" for Blocks 1–3 and hid 493 real errors (incl. a dead
     page and two latent white-screens in already-signed-off blocks).
   - NEVER drop `--incremental false`. The `node_modules/.tmp/
     tsconfig.app.tsbuildinfo` cache serves stale results and can report a
     file (or the whole repo) clean when it is not. If a result looks
     surprisingly clean, it IS suspect — re-run and confirm.

**Step 0 of every block: run `npm run typecheck` and triage the block's files
FIRST, before the manual read.** tsc finds the campaign's own hunt-list classes
for free and more reliably than reading:
   - TS2339/TS2551 → fantasy field names (silently-undefined reads)
   - TS2367 → enum-value drift ("vanishing worklist" filters that never match)
   - TS2304/TS2552 → undefined identifier = runtime ReferenceError white-screen
   - TS2353 → fantasy DTO fields (rejected by forbidNonWhitelisted)
Baseline is 0 as of Block 3.5 — any new error is a regression, not noise.

## Blocks
- [x] 1. Registration: PatientsPage, PatientDetail/Edit, QuickRegModal, PatientRegistrationPage*, OPDTokenPage*, appointments (View/Manage/Schedules), CallNextPatientPage* (*recently rebuilt — verify only) — ✅ e766979e 2026-07-14, functional map in docs/modules/01-registration.md; also covered PatientSearch/Documents/History (registration routes not owned by any later block)
- [x] 2. Nursing: TriageQueuePage*, vitals pages, ward/nursing worklists (AdministerMeds, CarePlans, DressingLog, IVCannulation, Catheterization, FallRisk, IncidentReport, BloodSugar, DrugAllergies, AbnormalAlerts) — ✅ 7eab3742 2026-07-15, functional map in docs/modules/02-nursing.md; 34 pages reviewed, 21 permission gates added, 12 demo-mode fixes, VitalsPage field names fixed, MedSchedule crash fixed
- [x] 3. Doctors: NewConsultationPage* (document mode — deep verify), CallNextPage*, EncounterDetail, SOAPNotes, referrals (sent/received), diagnosis/ProblemList, follow-ups, certificates — ✅ a18abfd9 2026-07-15, functional map in docs/modules/03-doctors.md; 44 pages reviewed, 17 P0 fixes (DDI import, 5 vital field renames, 4 envelope bugs, 3 broken nav routes, 4 honest stubs, 5 onError handlers), 3 confirm→confirmDialog
- [ ] 4. Diagnostics: LabPage, lab queue/results/QC, sample mgmt, radiology queue/reporting, critical results pages
- [ ] 5. Pharmacy: PharmacyQueuePage, DispenseMedication, sales, stock/batches, controlled register, templates
- [ ] 6. Emergency: EmergencyPage, triage assessments, emergency cases
- [ ] 7. IPD: admissions, wards/beds, handover, discharge planning board, med administration, nursing notes
- [ ] 8. Maternity: MaternityPage (ANC/labour/PNC tabs), PartographPanel*, EPI
- [ ] 9. Surgery: TheatrePage, WhoChecklistPanel*, case lifecycle, consumables
- [ ] 10. Billing: CashierPage*, NewBillPage, invoices, refunds, insurance (verify/preauth/claims), debt pages
- [ ] 11. POS: POSDashboardPage, shifts, MoMo flows, z-reports
- [ ] 12. Finance: FinanceDashboard, GL/journals, petty cash, bank recon, supplier finance, CustomReportBuilder, widgets*
- [ ] 13. Stores/Procurement: requisitions, PO/GRN flows, stock transfer, suppliers, OrgApprovalAdmin
- [ ] 14. HR: StaffDirectory, leave, payroll, shifts, goals/PIP, org chart, letters
- [ ] 15. Assets: register, tracking, allocation, maintenance, transfers, disposal
- [ ] 16. Reports/Analytics/Exports: report pages, ExportButton, dashboards
- [ ] 17. Chronic care + portal-facing pages + careers
- [ ] 18. Integrations/Sync: integrations pages, offline (lib/offline*, OfflineBanner), Deployments UI
- [ ] 19. Settings/Site: system settings pages, FacilityMode, EmailTemplates, Webhooks, SSO, PasswordPolicies, JobMonitor, TrashRecovery
- [ ] 20. Admin/System: users/roles/permissions, FacilitiesPage, TenantsPage, System* pages (SaaS: plans/subscriptions/invoices/licenses/contracts/coupons/onboarding/revenue/audit), Downloads

## Findings log
(append per block: P0 fixed inline w/ hash · P1 deferred · feature ideas)

### Block 3.5 — tsc gate repair + repo-wide type sweep (2026-07-16) ✅ 493 → 0
Triggered by asking for Block 3 recommendations. The gate itself was broken:
`npx tsc --noEmit` checks ZERO files (root tsconfig is `files: []` + refs), and
`--incremental false` was missing so the tsbuildinfo cache served stale "clean"
results. Blocks 1–3 were signed off against a no-op. Real count was 493.
Commits: a042ea2e · 913c4e33 · d061262c · 77944bc7 · d8a80721 · 41d62efb ·
19021590 · 84f2bc1d. Both tsc projects now 0 from a cold cache; vite build
passes; backend tsc 0.

**PATIENT SAFETY (fixed)**: LabResultsPage `transformFlag()` mapped
AbnormalFlag.ABNORMAL → 'Normal' (green). ABNORMAL is the lab's FAIL-CLOSED
signal (raised when reference ranges can't resolve; escalated as critical by
`toCriticalSeverity`). `recalculateFlag()` couldn't rescue it either — it trusts
anything already 'Normal'. Now a distinct 'Abnormal' on the orange path via
`isAbnormalFlag()`.

**Backend fixes**: referrals `getIncomingReferrals` hardcoded PENDING (accepted
referrals vanished → inbound workflow dead-ended); `checkLicenseExpiry` hid
already-expired licences (added `includeExpired`).

**NEEDS A HUMAN DECISION (all verified, none acted on):**
1. **`employees` table is EMPTY (0 rows) while `users` has 21.** `GET
   /hr/employees` is marked canonical (/hr/staff deprecated, sunset 2026-09-01)
   so StaffDirectory / Attendance / Appraisals / HRPage employees tab render
   empty for every tenant. `createStaff` only writes `users` — the user/employee
   merge looks half-done. Architectural.
2. **MDM module is never fed**: `MdmService.recordVersion` has ZERO callers
   outside its own file; `master_data_versions` and `master_data_approval_rules`
   are both 0 rows in prod. All three MDM pages are correct now but stay empty
   until the write paths call it.
3. **`CreateApprovalRuleDto.requiresApproval` has no class-validator decorator**
   → forbidNonWhitelisted rejects it → no rule created via the API can ever gate
   anything (it's the only field the engine reads). One-line fix: `@IsBoolean()`.
   Also `PUT /approval-rules/:id` takes `Partial<CreateApprovalRuleDto>`, which
   erases to `Object` → ValidationPipe skips it entirely → unvalidated
   mass-assignment surface.
4. **Supplier aging buckets don't tie to their total** (backend): `total` is
   posted GRNs − paid vouchers, but the five buckets distribute GROSS GRN value
   with payments never subtracted. Needs per-invoice aging.
5. **Consumption report "Custom" date range silently shows this month**:
   `GET /inventory/consumption` accepts only `period|department|category`;
   `period='custom'` hits `default:`. Its `department` param is accepted but
   never applied.
6. **Patient insurance fields are fantasy across the app**:
   `paymentType`/`membershipType`/`insuranceProvider`/`weight`/`height` are not
   columns (paymentType lives in `metadata->>'paymentType'`). PatientSearch's
   Insurance/VIP badges never render. Spans PatientsPage/CashierPage/OPDTokenPage
   — needs a coordinated fix.
7. `Encounter.department` is typed `string` but the backend joins a Department
   object (or null). PatientDetailPage currently routes through a local guard.
8. `services/encounters.ts` still carries fantasy `visitDate`/`doctor`/`doctorId`
   read by 8 pages (PatientHistory, DoctorDashboard, TodaySchedule, …), all
   silently rendering undefined. Worth a sweep.

### Block 1 — Registration (2026-07-14)
P0s fixed inline (backend deployed, migrations 77+78 applied, frontend built to dist):
- Appointments trio incoherent: Book created FOLLOW-UPS, View listed the (empty) appointments module, Manage edited follow-ups — bookings invisible, View→Manage deep link never matched. All three wired to the appointments module (create / list+check-in / reschedule+cancel). E2E: book→view→manage→cancel live via UI.
- ViewAppointmentsPage rendered nonexistent fields (patientName/date/time/'no-show') → list permanently empty + crash on search. Rewritten against backend shape.
- PatientsPage filters (gender/paymentType/from/to) 400'd (forbidNonWhitelisted) → list went empty; added to PatientSearchDto + findAll (paymentType via metadata->>'paymentType').
- PatientsPage Deactivate always 400'd (`status` not in UpdatePatientDto) → added (@IsIn active|inactive).
- "Register Anyway" never sent forceCreate → 409 for high-confidence dups (the exact case the button serves). Fixed.
- doctor_schedules had NO tenant_id column (service filtered on it): create 500'd, list silently empty — feature never worked. Migration 77 (column+backfill+RLS). Delete used softRemove without deleted_at → 500. Migration 78 + entity @DeleteDateColumn + `deletedAt IS NULL` guards on all 4 QB queries.
- DoctorSchedulesPage: doctor dropdown queried users named "Doctor" (empty) → role=Doctor; grid showed "Dr. undefined undefined" (firstName/lastName vs fullName).
- usersService.list envelope bug: interceptor flattens {data,meta} to array → `.data` undefined → empty doctor lists. Normalized in service.
- Broken navs: /encounters/new (matches /encounters/:id → error page) in PatientDetail/Search/History + Dashboard quick action → /doctor/encounters/new; PatientHistory → /patients/:id/documents (no route) → /patients/documents?patientId= (deep-link support added to PatientDocumentsPage).
- PatientDocumentsPage: category values didn't exist in backend enum → uploads stored but INVISIBLE everywhere (role-based category filter); aligned to DocumentCategory. Delete used wrong URL (404) → /patients/documents/:id; bulk delete (no backend) → sequential deletes.
- PatientEditPage replaced metadata wholesale → erased paymentType/insurance keys from registration. Now merges.
- BookAppointmentPage dead end on simple-mode tenants (no departments; doctors gated on dept) → dept optional when none configured. Doctors list = ALL active users → role=Doctor.
- Dead code: routes/RegistrationRoutes.tsx deleted (unmounted duplicate of CoreRoutes registration section).
- confirm() → confirmDialog: PatientsPage, DoctorSchedulesPage, PatientDetailPage ×2, PatientDocumentsPage ×2. Schedules mutations got onError toasts.

P1 deferred:
- Booking slots are a hardcoded list — should derive from doctor_schedules (slotDuration/maxPatients) + booked appointments; Manage reschedule same.
- PatientsPage: Print Card / Print Cards / Bulk SMS = "coming soon" placeholders; client sort only sorts current page; select-all appears checked on empty page.
- PatientHistoryPage: Export PDF/Excel + "Request Copy" are fake toasts; queries swallow errors into empty states.
- PatientDocumentsPage: Share-link, edit-metadata, bulk-download buttons have NO backend endpoints (error-toast today) — build or remove.
- PatientDetailPage: payments fetched unfiltered then client-matched; SMS gated only by patients.read; console.log leftover in handlePrintCard.
- QuickRegModal registers gender='other' + DOB=today placeholders (data quality); axios error message not backend message.
- ViewAppointmentsPage stats derive from fetched page (limit 100) not /appointments/stats.
- appointments UI lacks confirm/no-show quick actions (backend transitions exist).

### Block 2 — Nursing (2026-07-15)
P0s fixed inline (frontend built to /tmp, build verified):
- VitalsPage.tsx: fantasy field names (bloodPressureSystolic→bpSystolic, bloodPressureDiastolic→bpDiastolic, heartRate→pulse, painScore→painScale) — BP and pulse were ALWAYS blank, saves silently ignored. Now uses vitalsService instead of raw api calls. Added permission gate + error toast on mutation failure.
- MedicationSchedulePage.tsx: undefined `medications` variable → crash on "5 Rights Verification" button. Fixed to `schedule` (the correct useMemo variable).
- AbnormalAlertsPage.tsx: called `GET /vitals` which DOESN'T EXIST — entire page failed silently. Removed broken endpoint call. Acknowledge/Resolve stubs now show "coming soon" toast instead of console.log.
- Demo-mode silent success on 12 pages: PainAssessment, FallRisk, IVCannulation, Catheterization, WoundAssessment, PatientEducation, BloodSugar, ObservationChart, IntakeOutput (3 locations), IncidentReport, CarePlans, DressingLog — all showed "success" when no admission existed without actually saving data. Now show `toast.error('Patient must be admitted to record this data')`.
- Permission gates added to 21 pages that had NO access control: VitalTrends, PainAssessment, FallRisk, MedicationChart, DrugAllergies, DressingLog, WoundProgress, IVCannulation, Catheterization, SpecimenCollection, ProcedureLog, PatientEducation, PatientMonitor, BloodSugar, ObservationChart, NursingDailyReport, ShiftSummary, IncidentReport, WorkloadStats, CarePlans, VitalsPage.

P1 deferred:
- Wound management (3 pages: WoundAssessment, DressingLog, WoundProgress) — no wound entity on backend; pages are structurally non-functional (wound list always empty, progress chart always empty, Add Entry button never shows).
- Care plans, I/O, blood sugar, observations — data stored only in React state (lost on refresh); no backend entities for these domains.
- VitalTrendsPage: manual useEffect fetching (should be useQuery); SVG chart division-by-zero with single data point.
- VitalsHistoryPage: fake Export PDF/Excel buttons (show success toast but never generate files); vitalTypeFilter dropdown has no effect (filter never applied).
- MedicationSchedulePage: prescribedBy hardcoded to "Dr. Attending"; allergies always empty; controlled substance detected by drug name string matching.
- AdministerMedsPage: empty MRN bypasses patient verification; allergy/vitals/NPO panels never populated from upstream.
- ShiftHandoverPage: patient vitals hardcoded (36.8/78/120/80/16/98); admission.priority is fantasy field — all patients appear "stable".
- Report pages (Daily/Shift/Workload): fantasy stats fields (proceduresToday/medicationsToday/criticalAlerts all undefined→0); fabricated workload data (procedures = patients*0.5); date pickers not wired to queries.
- SpecimenCollectionPage: sends fake orderId/labTestId to labService.samples.collect(); most form fields not sent to API.
- ProcedureLogPage: pipe-delimited note parsing breaks on notes containing |.
- NursingNotesPage: silent fail (no error toast) when saving without admission.
- IncidentReportPage: Save Draft + Email buttons are stubs; reference numbers are fake.
- WardManagementPage: Notes/Transfer/Discharge buttons dead (no onClick); ward creation uses facilities[0].id (wrong in multi-facility); no permission gate.
- IPDNursingNotesPage: field name drift (noteType vs type, recordedBy vs nurse); Edit/Administer buttons dead; no permission gate.

Architectural finding:
- **Nursing notes as universal backend**: every specialized page serializes structured data into a single text field on a nursing note. No queryable structure, no historical retrieval, dashboards compute from session-local state only. Backend has one endpoint (POST /ipd/nursing-notes) serving all use cases. Proper implementation needs dedicated entities for care plans, I/O, blood sugar, observations, wound management, incident reports.

### Block 3 — Doctors (2026-07-15)
P0s fixed inline (frontend built to /tmp, build verified):
- NewConsultationPage: `api` not imported → DDI interaction check silently crashed (ReferenceError caught, safety check dead). Import added.
- NewConsultationPage: 3 navigate paths to `/referrals/new` and `/follow-ups/new` were 404s → prefixed with `/doctor/`.
- NewConsultationPage: `confirm()` → `confirmDialog` for Rx item removal.
- SOAPNotesPage: `bloodPressureSystolic`/`bloodPressureDiastolic` (fantasy field names) → `bpSystolic`/`bpDiastolic`. BP was INVISIBLE on SOAP note page and abnormality alerts never fired.
- WaitingPatientsPage: Same BP vital field name fix in patient preview modal.
- ClinicalNotesPage: Envelope bug — `response.data` was `{message, data: ClinicalNote[]}` but code expected `ClinicalNote[]`. Notes never rendered. Fixed both queries + service methods.
- EncountersPage: Patient search envelope bug — `response.data` was `{data, total}` not `Patient[]`. Search dropdown never showed results.
- EncounterDetailPage: All 5 mutations (vitals, notes, prescriptions, lab orders, invoices) had NO `onError` handlers — failures were completely silent. Added toast.error to all.
- NewReferralPage: `preferredDate` → `appointmentDate` (backend DTO field). User-entered preferred date was silently discarded on every referral.
- SentReferralsPage: Cancel button showed fake success toast but never called API → wired to `referralsService.cancel()` with confirmDialog. Resend → honest stub. Follow-up route fixed.
- ReferralsPage: "+ New Referral" button was dead (`setShowModal` with no modal) → navigates to `/doctor/referrals/new`. 3 `prompt()` calls → honest stubs. Silent `console.error` → toast.error.
- FollowUpsPage: 3 envelope bugs on data/stats fetches; dead Schedule button → wired onClick; 4 silent error handlers → toast.error; `prompt()` → honest stub.
- OverdueFollowUpsPage: `.map()` crash — `followUpsService.findAll()` returned envelope, not array.
- PendingReviewsPage: Sign/Acknowledge/Accept buttons were entirely fake (client-side dismissedIds only, no API) → honest info stubs.
- SickLeavePage: "Email" button showed fake `toast.success` → `toast.info('Email to employer not yet configured')`.
- DeathCertificatePage: "Submit to Registry" showed fake success on legally significant action → honest stub.

P1 deferred:
- NewConsultationPage: patientSummary.activeProblems/currentMedications/alerts never populated from API; form not fully reset between patients (HPI/PMH carry over); imaging results section is a stub; hardcoded UGX; queue transfer on inline order creation is premature (pulls patient out mid-consult); voice dictation toggle is dead (no speech API wired).
- SOAPNotesPage: saves structured SOAP as serialized text into encounter.notes (does NOT create ClinicalNote record); cosign_pending/addendum are fantasy workflows with no backend; patient allergies/medications from metadata are fantasy fields; auto-save failure is silent; copy-from-previous compares visitNumber vs UUID.
- EncounterDetailPage: Generate Invoice dead (invoiceItems state never populated); status stepper missing 9 of 15 backend statuses; lab samples.list({}) fetches ALL samples (N+1); DrugAutocomplete only sets drugName, not drugCode; billing tab is display-only stub.
- Referrals: NewReferralPage reason hardcoded to specialist_consultation; document attachments sidebar never sends selections in API call; incoming referrals vanish after acceptance (backend hardcodes status=PENDING in getIncomingReferrals query).
- Diagnosis: hasPermission imported but unused on all 3 pages; DifferentialDx sends test names as code field; differential workup not persisted (lost on refresh); ProblemList uses confirm() (should be confirmDialog).
- Follow-ups: ScheduleFollowUp currentEncounter.diagnosis always "Pending diagnosis" (fantasy); email reminder type is UI-only (backend has smsReminder boolean only); OverdueFollowUps Send Reminder triggers bulk send for ALL scheduled patients, not the clicked row; auto-reschedule to tomorrow without date picker.
- Certificates: save errors silently swallowed (.catch(() => {})); patient selector loads flat 100-patient list (should search); no dedicated certificate entity — all stored as unstructured patient notes.
- Reports: MedicalReportPage uses legacy bloodPressureSystolic as primary check; attendingProvider is fantasy field; N+1 query for lab/radiology results per sample; missing safeImageUrl() on logo img src.
- Missing granular permission gates on many mutation buttons across the module (backend enforces via 403, but UI shows all buttons regardless of role).

Architectural findings:
- **SOAP notes not creating ClinicalNote records**: SOAPNotesPage serializes all structured SOAP data into a single text blob in `encounter.notes`. The backend has a proper `ClinicalNote` entity with structured fields (subjective, objective, assessment, plan) and `completeConsultation` endpoint, but neither is used. Clinical documentation is unqueryable.
- **Envelope inconsistency**: Several pages use raw `api.get()` instead of typed service methods, encountering envelope bugs. The clinical-notes service had the same issue internally. Pattern: always check `Array.isArray(result) ? result : result?.data || []`.
- **Fantasy vital field persistence**: `bloodPressureSystolic`/`bloodPressureDiastolic` was used across SOAPNotesPage, WaitingPatientsPage, and MedicalReportPage — the backend has used `bpSystolic`/`bpDiastolic` since the field name fix. This class of bug likely exists in other modules too.
- **Certificate data loss**: All 4 certificate types are stored as unstructured text in patient notes. No versioning, no revocation, no certificate-specific queries possible.
