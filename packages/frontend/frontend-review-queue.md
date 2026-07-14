# Frontend Module Review Queue — line-by-line, registration → admin

Mirror of the backend journey review (2026-07, 20 blocks, complete). This pass
covers the FRONTEND: every page read line-by-line + live E2E probe per module.
Work top-to-bottom; mark blocks ✅ with commit hashes as they complete.

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
- [ ] 1. Registration: PatientsPage, PatientDetail/Edit, QuickRegModal, PatientRegistrationPage*, OPDTokenPage*, appointments (View/Manage/Schedules), CallNextPatientPage* (*recently rebuilt — verify only)
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
