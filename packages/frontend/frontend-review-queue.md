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
5. tsc gate: `npx tsc --noEmit --incremental false | grep <touched>`; build to /tmp
   to verify, real build only when deploying (dist/ is production).

## Blocks
- [x] 1. Registration: PatientsPage, PatientDetail/Edit, QuickRegModal, PatientRegistrationPage*, OPDTokenPage*, appointments (View/Manage/Schedules), CallNextPatientPage* (*recently rebuilt — verify only) — ✅ 2026-07-14, functional map in docs/modules/01-registration.md; also covered PatientSearch/Documents/History (registration routes not owned by any later block)
- [ ] 2. Nursing: TriageQueuePage*, vitals pages, ward/nursing worklists (AdministerMeds, CarePlans, DressingLog, IVCannulation, Catheterization, FallRisk, IncidentReport, BloodSugar, DrugAllergies, AbnormalAlerts)
- [ ] 3. Doctors: NewConsultationPage* (document mode — deep verify), CallNextPage*, EncounterDetail, SOAPNotes, referrals (sent/received), diagnosis/ProblemList, follow-ups, certificates
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
