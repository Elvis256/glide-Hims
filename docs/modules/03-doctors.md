# 03 — Doctors Module (Frontend Functional Map)

> Block 3 of the frontend line-by-line review (2026-07-15).
> Covers: consultation, queue, encounters, SOAP notes, diagnosis, prescriptions, orders, results, referrals, certificates, follow-ups, reports.

---

## Module Overview

The Doctors module is the clinical workhorse — 35 routes under `/doctor/*` plus 6 cross-module routes in CoreRoutes. All doctor-specific routes are behind `DoctorRoute` (role gate) or `ClinicalRoute`; the main consultation page also allows Nurse and Receptionist roles for encounter creation.

### Route Map

| Route | Page | Role Gate |
|---|---|---|
| `/doctor/` | DoctorDashboardPage | Doctor |
| `/doctor/consult` | NewConsultationPage | Doctor |
| `/doctor/encounters/new` | NewConsultationPage | Doctor, Nurse, Receptionist |
| `/doctor/queue` | WaitingPatientsPage | Doctor |
| `/doctor/queue/call` | CallNextPage (shell → CallNextPanel) | Doctor |
| `/doctor/schedule` | TodaySchedulePage | Doctor |
| `/doctor/pending` | PendingReviewsPage | Doctor |
| `/doctor/critical-results` | CriticalResultsPage | Doctor |
| `/doctor/soap` | SOAPNotesPage | Doctor |
| `/doctor/notes` | ClinicalNotesPage | Doctor |
| `/doctor/encounters` | EncountersPage | Clinical |
| `/doctor/diagnosis/icd` | ICD10CodingPage | Doctor |
| `/doctor/diagnosis/differential` | DifferentialDxPage | Doctor |
| `/doctor/diagnosis/problems` | ProblemListPage | Doctor |
| `/doctor/prescriptions/new` | WritePrescriptionPage | Doctor |
| `/doctor/prescriptions` | PrescriptionHistoryPage | Doctor |
| `/doctor/prescriptions/interactions` | DrugInteractionsPage | Doctor |
| `/doctor/prescriptions/favorites` | FavoriteRxPage | Doctor |
| `/doctor/orders/lab` | LabOrdersPage | Doctor |
| `/doctor/orders/radiology` | RadiologyOrdersPage | Doctor |
| `/doctor/orders/procedures` | ProcedureOrdersPage | Doctor |
| `/doctor/orders/sets` | OrderSetsPage | Doctor |
| `/doctor/results/lab` | LabResultsPage | Doctor |
| `/doctor/results/imaging` | ImagingResultsPage | Doctor |
| `/doctor/results/critical` | CriticalValuesPage | Doctor |
| `/doctor/referrals/new` | NewReferralPage | Doctor |
| `/doctor/referrals/sent` | SentReferralsPage | Doctor |
| `/doctor/referrals/received` | ReferralsPage | Doctor |
| `/doctor/certificates/medical` | MedicalCertificatePage | Doctor |
| `/doctor/certificates/sick-leave` | SickLeavePage | Doctor |
| `/doctor/certificates/fitness` | FitnessCertificatePage | Doctor |
| `/doctor/certificates/death` | DeathCertificatePage | Doctor |
| `/doctor/report` | MedicalReportPage | Doctor |
| `/doctor/report/insurance` | InsuranceReportPage | Doctor |
| `/doctor/follow-ups/new` | ScheduleFollowUpPage | Doctor |
| `/doctor/follow-ups` | FollowUpsPage | Doctor |
| `/doctor/follow-ups/overdue` | OverdueFollowUpsPage | Doctor |
| `/encounters/:id` | EncounterDetailPage | (CoreRoutes, no role gate) |
| `/encounters` | EncountersPage | (CoreRoutes, ClinicalRoute) |

---

## 1. DoctorDashboardPage

**Functions**: Landing page for doctors. Shows patient queue (waiting + in-consultation), call-next button with TTS announcement, pending lab reviews, critical results alerts with SLA, today's schedule, quick actions.

**Inputs**: JWT user ID (scopes queries to this doctor's queue/stats).

**Outputs**: Queue mutations (call, start service), navigation to consultation.

| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Call Next button | callNextMutation → queueService.callNext('consultation') | Calls next patient, TTS announcement, chime | encounters.read | 🔎 |
| Start button (per patient) | handleStartConsultation | call + startService + navigate to /doctor/consult | encounters.read | 🔎 |
| Continue button | handleContinueConsultation | navigate to /doctor/consult | encounters.read | 🔎 |
| Review button (pending) | handleReviewResult | navigate to /doctor/consult or /doctor/results/lab | encounters.read | 🔎 |
| Refresh button | handleRefresh | refetchQueue + invalidateQueries | — | 🔎 |
| Quick Actions (3) | navigate | /patients, /doctor/prescriptions, /doctor/results/lab | — | 🔎 |
| Open worklist link | navigate | /doctor/critical-results | — | 🔎 |
| View full schedule | navigate | /doctor/schedule | — | 🔎 |
| View all reviews | navigate | /doctor/pending | — | 🔎 |

---

## 2. NewConsultationPage (Document Mode)

**Functions**: The primary clinical documentation page. SOAP-based with scroll-spy navigation, integrated ordering (lab/imaging/procedures), prescription writing with DDI safety checks, admission, referral, billing, auto-save (localStorage 15s + server 30s), crash recovery.

**Inputs**: `?encounterId=` + `?patientId=` URL params; or patient search + queue selection.

**Outputs**: Clinical notes (via encountersService.update for notes text), orders, prescriptions, referrals, admissions, billing routing, encounter completion.

**Key architecture**: The consultation page is a single-page document with sections (Chief Complaint, HPI, Review of Systems, Physical Exam, Assessment, Plan/Orders). SOAP bar at top is a scroll-spy nav that highlights the current section. All sections render in a scrollable container.

| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Save Draft | saveMutation | encountersService.update (notes text) | encounters.update | 🔎 |
| Sign & Complete | completeMutation | encountersService.complete → queue routing | encounters.update | 🔎 |
| Call Next (from queue sidebar) | callNextMutation | queueService.callNext | — | 🔎 |
| Add Lab Order | createOrderMutation | ordersService.create (type: lab) | 🔒 no orders.create check | 🔎 |
| Add Imaging Order | createOrderMutation | ordersService.create (type: radiology) | 🔒 no orders.create check | 🔎 |
| Quick-add imaging (CXR/US/ECG) | createOrderMutation | Hardcoded codes → order creation | 🔒 | 🔎 |
| Cancel Order | cancelOrderMutation | ordersService.cancel | 🔒 | 🔎 |
| Add Drug to Prescription | local state + DDI check | api.post drug-management/interactions/check | 🔒 | ✅ fixed: api import |
| Remove Rx Item | removeRxItemMutation | prescriptionsService.removeItem | ✅ confirmDialog | ✅ fixed |
| Send Prescription | createPrescriptionMutation | prescriptionsService.create | 🔒 | 🔎 |
| Refer button | handleRefer | navigate /doctor/referrals/new | — | ✅ fixed route |
| Schedule Follow-up | handleScheduleFollowUp | navigate /doctor/follow-ups/new | — | ✅ fixed route |
| Send to Next Dept | handleSendToNextDept | navigate /doctor/referrals/new?internal=true | — | ✅ fixed route |
| Admit Patient | admit modal → ipdService.admissions.create | Creates admission | 🔒 | 🔎 |
| Send to Billing | sendToBillingMutation | queueService.transfer to billing | — | 🔎 |
| Voice Dictation toggle | setIsVoiceEnabled | 💀 Toggles state but no speech recognition wired | — | 💀 |

**P1 deferred**: patientSummary.activeProblems/currentMedications/alerts never populated; form fields not fully reset between patients (HPI/PMH carry over); imaging results section is a stub; hardcoded UGX currency; console.log in ICD search.

---

## 3. SOAPNotesPage

**Functions**: SOAP note review/management with structured sections, ICD diagnosis search, auto-save, templates, clinical alerts.

**Inputs**: Encounter selection (search or URL param).

**Outputs**: Saves as `encounter.notes` (serialized text) — does NOT create a ClinicalNote record.

| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Save | saveSoapMutation | encountersService.update (serialized notes text) | clinical-notes.create/update | 🔎 |
| Sign & Lock | saveSoapMutation (status: signed) | Sets encounter status to completed | clinical-notes.create/update | 🔎 |
| Request Co-signature | saveSoapMutation (status: cosign_pending) | 💀 No backend co-sign workflow | — | 💀 |
| Add Addendum | local state change | 💀 No backend addendum support | — | 💀 |
| Export PDF | handleExportPDF | 💀 toast.info stub | — | 💀 |
| Send to Portal | handleSendToPortal | 💀 toast.info stub | — | 💀 |
| Voice Recording | toggleVoiceRecording | 💀 Simulated, no real recording | — | 💀 |
| Save Template | prompt() → localStorage | P2: raw prompt(), saves to localStorage only | — | 🔎 |
| Compare (history modal) | — | 💀 toast.info stub | — | 💀 |
| Copy (history modal) | — | 💀 toast.info stub | — | 💀 |

**P0 fixed**: BP vital field names (bloodPressureSystolic → bpSystolic).

**P1 deferred**: Saves as serialized text instead of creating ClinicalNote; patient allergies/medications from metadata are fantasy fields; cosign_pending and addendum are fantasy workflows; selectedEncounterId is visitNumber compared against UUID in copyFromPrevious; auto-save failure is silent.

---

## 4. EncounterDetailPage

**Functions**: Tabbed encounter viewer (Overview, Vitals, Consultation, Lab Orders, Lab Results, Prescriptions, Billing). Supports vitals entry, clinical notes, prescription writing, lab ordering, invoice generation.

**Inputs**: `/encounters/:id` URL param.

**Outputs**: Vitals, clinical notes, prescriptions, lab orders, invoices.

| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Save Vitals | mutation | POST /vitals | 🔒 no vitals.create check | ✅ onError added |
| Save Clinical Notes | mutation | POST /clinical-notes | 🔒 no clinical-notes.create check | ✅ onError added |
| Save Prescription | mutation | POST /prescriptions | 🔒 no prescriptions.create check | ✅ onError added |
| Order Lab Tests | mutation | POST /orders | 🔒 no orders.create check | ✅ onError added |
| Generate Invoice | createInvoiceMutation | POST /billing/invoices items:[] | 💀 invoiceItems never populated | ✅ onError added |

**P0 deferred**: Generate Invoice sends empty items (dead button — no UI to add items). Status stepper missing 9 of 15 backend statuses. Lab samples fetch unfiltered (performance). DrugAutocomplete only sets drugName, not drugCode.

---

## 5. Referral Pages

### NewReferralPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Submit Referral | createReferralMutation | referralsService.create | 🔒 hasPermission imported but unused | ✅ fixed appointmentDate |
| Document attachment sidebar | selectedDocuments state | 💀 Documents never sent in API call | — | 💀 |

### SentReferralsPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Cancel Referral | cancelMutation | referralsService.cancel + confirmDialog | 🔒 | ✅ fixed: wired to API |
| Resend Referral | handleResend | toast.info honest stub | — | ✅ fixed |
| Complete/Accept & Close | completeMutation | referralsService.complete | 🔒 | 🔎 |
| Request Follow-up | navigate | /doctor/follow-ups/new | — | ✅ fixed route |

### ReferralsPage (Received)
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| + New Referral | navigate | /doctor/referrals/new | 🔒 no permission check | ✅ fixed: wired to navigate |
| Accept | — | toast.info honest stub (was prompt()) | 🔒 | ✅ fixed |
| Reject | — | toast.info honest stub (was prompt()) | 🔒 | ✅ fixed |
| Complete | — | toast.info honest stub (was prompt()) | 🔒 | ✅ fixed |

**P1 deferred**: NewReferralPage reason hardcoded to specialist_consultation; document attachments never sent; ReferralsPage uses useEffect fetch pattern; incoming referrals backend hardcodes status=PENDING (vanishing worklist after accept).

---

## 6. Diagnosis Pages

### ICD10CodingPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Search ICD codes | diagnosesService.searchICD / searchWHO | Populates results | 🔒 hasPermission unused | 🔎 |
| Add to Encounter | handleAddToEncounter | Adds to local list (no persist) | 🔒 | 🔎 |
| Save to Problem List | handleSaveToProblemList | problemsService.create | 🔒 | 🔎 |

### DifferentialDxPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Order Tests | handleOrderTests | ordersService.create | 🔒 hasPermission unused | 🔎 |
| Confirm Final Diagnosis | handleConfirmDiagnosis | problemsService.create | 🔒 | 🔎 |

**P1 deferred**: DifferentialDxPage testCodes sends test names as code field; all differential workup lost on refresh (no persistence); missing invalidateQueries after problem creation.

### ProblemListPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Add Problem | createMutation | problemsService.create | 🔒 hasPermission unused | 🔎 |
| Edit Problem | updateMutation | problemsService.update | 🔒 | 🔎 |
| Mark Resolved | resolveMutation | problemsService.markResolved | 🔒 | 🔎 |
| Delete Problem | deleteMutation | problemsService.delete + confirm() | 🔒 | 🔎 P1: confirm→confirmDialog |

---

## 7. Follow-up Pages

### FollowUpsPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| + Schedule Follow-up | navigate | /doctor/follow-ups/new | 🔒 | ✅ fixed: wired onClick |
| Check In | checkIn handler | api.post follow-ups/:id/check-in | 🔒 | ✅ fixed: error toast |
| Complete | complete handler | api.post follow-ups/:id/complete | 🔒 | ✅ fixed: error toast |
| Reschedule | — | toast.info honest stub | — | ✅ fixed |
| No Show | markMissed handler | api.patch follow-ups/:id/status | 🔒 | ✅ fixed: error toast |

**P0 fixed**: Envelope bugs on all 3 API calls; dead Schedule button; silent error handlers; prompt() for reschedule.

### ScheduleFollowUpPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Schedule | scheduleMutation | followUpsService.create | 🔒 hasPermission unused | 🔎 |

**P1 deferred**: currentEncounter.diagnosis always "Pending diagnosis" (fantasy field); available slots panel may be empty (envelope); email reminder type is UI-only (backend only has smsReminder boolean).

### OverdueFollowUpsPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Reschedule | handleReschedule | followUpsService.reschedule (auto-tomorrow) | 🔒 | ✅ fixed: envelope |
| Send Reminder | handleSendReminder | followUpsService.sendReminders (bulk, not per-patient) | 🔒 | 🔎 P1: misleading |
| Unable to Contact / Declined | handleUpdateStatus | followUpsService.updateStatus (cancel) | 🔒 no confirmDialog | 🔎 |

---

## 8. Certificate Pages

All 4 certificate pages generate HTML documents for printing. Certificates are saved as unstructured patient notes via `patientsService.createNote()` — no dedicated certificate entity.

### MedicalCertificatePage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Preview | handlePreview | Shows print preview | DoctorRoute | 🔎 |
| Print | handlePrint | window.print | DoctorRoute | 🔎 |
| Save & Print | handleSaveAndPrint | createNote + print | DoctorRoute | 🔎 |

### SickLeavePage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Print | handlePrint | createNote (best-effort) + print | DoctorRoute | 🔎 |
| Email | handleEmailEmployer | toast.info('Email to employer not yet configured') | — | ✅ fixed: honest stub |

### FitnessCertificatePage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Print | handlePrint | createNote (best-effort, silent catch) + print | DoctorRoute | 🔎 |

### DeathCertificatePage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Print | handlePrint | createNote (best-effort, silent catch) + print | DoctorRoute | 🔎 |
| Submit to Registry | handleSubmitToRegistry | toast.info('Registry submission not yet configured') | — | ✅ fixed: honest stub |

**P1 deferred**: Save errors silently swallowed (`.catch(() => {})`); patient selector loads flat 100-patient list on SickLeave/Death (should use search); currentDiagnosis fantasy field on SickLeavePage.

---

## 9. Report Pages

Both report pages are read-and-print assemblers — no persistence.

### MedicalReportPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Print Report | window.print | Prints assembled report | DoctorRoute | 🔎 |

**P1 deferred**: BP vital field uses legacy `bloodPressureSystolic` (primary check, falls back to `bpSystolic`); `attendingProvider` is fantasy field (falls back to `doctor`); N+1 query for lab/radiology results; missing `safeImageUrl()` on logo.

### InsuranceReportPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Print Report | window.print | Prints assembled report | DoctorRoute | 🔎 |

---

## 10. Queue & Workflow Pages

### WaitingPatientsPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Call Patient | callPatientMutation | queueService.call | queue.manage | 🔎 |
| Call Next | callNextMutation | queueService.callNext | queue.manage | 🔎 |
| Start Consultation | startServiceMutation + navigate | queueService.startService → /doctor/consult | queue.manage | 🔎 |
| No Show | noShowMutation | queueService.noShow | queue.manage | 🔎 |
| Priority Bump | priorityBumpMutation | queueService.updatePriority | queue.manage | 🔎 |
| Transfer | transferMutation | queueService.transfer | queue.manage | 🔎 |
| Accept Returned | acceptReturnedMutation | encountersService.update status | queue.manage | 🔎 |

**P0 fixed**: BP vitals in patient preview (bloodPressureSystolic → bpSystolic).

### PendingReviewsPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Sign Note | handleSign | toast.info('Note signing will be available soon') | 🔒 no permission check | ✅ fixed: honest stub |
| Mark Reviewed | handleSign | Same honest stub | — | ✅ |
| Acknowledge | handleSign | Same honest stub | — | ✅ |
| Accept Referral | handleAcceptReferral | toast.info('Accept referrals from the Received Referrals page') | — | ✅ fixed: honest stub |
| Dismiss | handleDismiss | Client-side hide (dismissedIds) | — | 🔎 |

### CriticalResultsPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Acknowledge | ackMutation | criticalResultsService.acknowledge | — (route-level) | 🔎 |

### TodaySchedulePage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Start Consult | navigate | /doctor/consult?encounterId=...&patientId=... | — | 🔎 |

**P2 deferred**: Hardcoded 30min duration and 08:00-17:00 slots; no error state display.

---

## 11. ClinicalNotesPage & EncountersPage

### ClinicalNotesPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| Add Note | noteMutation | api.post /clinical-notes | DoctorRoute (no perm check) | ✅ fixed: envelope |
| Add SOAP Note | soapMutation | 4x api.post /clinical-notes | DoctorRoute | ✅ fixed: envelope |

**P0 fixed**: Envelope bug — notes never rendered because response.data was `{message, data}` not `ClinicalNote[]`.

**P1 deferred**: No onError on mutations; local ClinicalNote interface has `type`/`content` shape but backend entity has `subjective`/`objective`/`assessment`/`plan` — notes may render but sections won't populate correctly.

### EncountersPage
| Element | Handler | Effect | Guard | Verified |
|---|---|---|---|---|
| New Visit | NewVisitModal → createMutation | encountersService.create | 🔒 no encounters.create check | 🔎 |
| View Encounter | navigate | /encounters/:id | — | 🔎 |
| Search Patients | api.get /patients | Patient dropdown | — | ✅ fixed: envelope |

**P0 fixed**: Patient search envelope bug (response.data was `{data, total}` not `Patient[]`).

**P2 deferred**: Status stepper missing several backend statuses; no onError on create mutation.

---

## P0 Fixes Applied in This Block

| # | File | Fix |
|---|---|---|
| 1 | NewConsultationPage.tsx | Import `api` for DDI interaction check (was ReferenceError → safety check silently failed) |
| 2 | NewConsultationPage.tsx | Fix 3 navigate paths: `/referrals/new` → `/doctor/referrals/new`, `/follow-ups/new` → `/doctor/follow-ups/new` |
| 3 | NewConsultationPage.tsx | `confirm()` → `confirmDialog` for Rx item removal |
| 4 | SOAPNotesPage.tsx | `bloodPressureSystolic`/`bloodPressureDiastolic` → `bpSystolic`/`bpDiastolic` (BP was invisible) |
| 5 | WaitingPatientsPage.tsx | Same vital field name fix in patient preview modal |
| 6 | ClinicalNotesPage.tsx | Envelope bug fix — notes never rendered |
| 7 | clinical-notes.ts (service) | Envelope unwrap on all methods + added `getPatientHistory` |
| 8 | EncountersPage.tsx | Patient search envelope unwrap |
| 9 | EncounterDetailPage.tsx | Added `onError` handlers to all 5 mutations (were completely silent) |
| 10 | NewReferralPage.tsx | `preferredDate` → `appointmentDate` (date was silently discarded) |
| 11 | SentReferralsPage.tsx | Cancel wired to real API; resend honest stub; confirm→confirmDialog; fix follow-up route |
| 12 | ReferralsPage.tsx | + New Referral → navigate; 3 prompt() → honest stubs; silent errors → toast.error |
| 13 | FollowUpsPage.tsx | 3 envelope unwraps; dead Schedule button wired; error toasts; prompt → stub |
| 14 | OverdueFollowUpsPage.tsx | Envelope unwrap (page was crashing on load) |
| 15 | PendingReviewsPage.tsx | Sign/Accept buttons → honest stubs (were fake success toasts) |
| 16 | SickLeavePage.tsx | Email button → honest stub |
| 17 | DeathCertificatePage.tsx | Submit to Registry → honest stub |

---

## P1 Deferred (logged in tracker)

- NewConsultationPage: patientSummary.activeProblems/currentMedications/alerts never populated; form fields not fully reset between patients; imaging results stub; hardcoded UGX; queue transfer on inline order creation is premature
- SOAPNotesPage: saves as serialized text (not ClinicalNote record); cosign/addendum are fantasy workflows; copy-from-previous compares visitNumber vs UUID
- EncounterDetailPage: Generate Invoice dead (items never populated); status stepper incomplete; lab samples fetch unfiltered; drugCode not set from autocomplete
- NewReferralPage: reason hardcoded; document attachments never sent in API call; no permission gate
- SentReferralsPage/ReferralsPage: status conflation (rejected/cancelled/expired → declined); incoming referrals vanish after accept (backend hardcodes status=PENDING)
- Diagnosis pages: hasPermission imported but unused on all 3; DifferentialDx sends test names as codes; differential workup not persisted; ProblemList uses confirm()
- Follow-ups: ScheduleFollowUp currentEncounter is fantasy; email reminder type UI-only; OverdueFollowUps sendReminder is bulk not per-patient; auto-reschedule to tomorrow
- Certificates: save errors silently swallowed; patient selector loads flat 100 list; no dedicated certificate entity
- Reports: legacy vital field primary check; attendingProvider fantasy; N+1 lab/radiology queries; missing safeImageUrl on logo
- Missing granular permission gates on many mutation buttons (backend enforces, UI doesn't)
