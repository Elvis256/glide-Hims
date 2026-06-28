# Glide-HIMS — System Design, Process Flows & Roadmap

> **Version:** 1.0 | **Date:** 27 June 2026 | **Status:** Living Document

---

## Table of Contents

- [Part 1 — System Architecture & Design](#part-1--system-architecture--design)
  - [1.1 Technology Stack](#11-technology-stack)
  - [1.2 Monorepo Structure](#12-monorepo-structure)
  - [1.3 Multi-Tenant SaaS Model](#13-multi-tenant-saas-model)
  - [1.4 Entity-Relationship Overview](#14-entity-relationship-overview)
  - [1.5 Authentication & Authorization](#15-authentication--authorization)
  - [1.6 Stakeholder Roles](#16-stakeholder-roles)
- [Part 2 — Process Flows](#part-2--process-flows)
  - [2.1 Outpatient (OPD) Journey](#21-outpatient-opd-journey)
  - [2.2 Inpatient (IPD) Journey](#22-inpatient-ipd-journey)
  - [2.3 Emergency Department](#23-emergency-department)
  - [2.4 Pharmacy & Dispensing](#24-pharmacy--dispensing)
  - [2.5 Laboratory](#25-laboratory)
  - [2.6 Radiology & Imaging](#26-radiology--imaging)
  - [2.7 Billing & Insurance](#27-billing--insurance)
  - [2.8 Procurement & Supply Chain](#28-procurement--supply-chain)
  - [2.9 Human Resources](#29-human-resources)
  - [2.10 Inventory & Stores](#210-inventory--stores)
  - [2.11 Maternity Care](#211-maternity-care)
  - [2.12 Finance & Accounting](#212-finance--accounting)
  - [2.13 SaaS Platform Operations](#213-saas-platform-operations)
- [Part 3 — System Health Audit](#part-3--system-health-audit)
  - [3.1 Test Coverage](#31-test-coverage)
  - [3.2 Audit Logging Gaps](#32-audit-logging-gaps)
  - [3.3 Missing Workflow State Machines](#33-missing-workflow-state-machines)
  - [3.4 Configuration Hardcoding](#34-configuration-hardcoding)
  - [3.5 Report Generation Gaps](#35-report-generation-gaps)
  - [3.6 Input Validation Coverage](#36-input-validation-coverage)
- [Part 4 — Recommended Next Actions](#part-4--recommended-next-actions)

---

# Part 1 — System Architecture & Design

## 1.1 Technology Stack

### Backend

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 20 LTS |
| Framework | NestJS | 10.3.x |
| ORM | TypeORM | 0.3.19 |
| Database | PostgreSQL | 15+ |
| Cache | Redis (ioredis) | 5.10.x |
| Auth | Passport + JWT | 10.x / 10.2.x |
| Real-time | Socket.IO | 4.8.x |
| Scheduling | @nestjs/schedule | 6.1.x |
| Events | @nestjs/event-emitter | 3.1.x |
| Email | Nodemailer | 7.0.x |
| PDF | PDFKit | 0.18.x |
| Excel | xlsx | 0.18.x |
| Validation | class-validator + class-transformer | — |
| API Docs | @nestjs/swagger | 7.1.x |
| Logging | Pino (nestjs-pino) | 3.5.x |
| Health | @nestjs/terminus | 10.3.x |
| Security | Helmet, bcrypt | 8.x / 5.1.x |
| OTP/MFA | otpauth | 9.5.x |
| Math | decimal.js | 10.6.x |
| QR Codes | qrcode | 1.5.x |

### Frontend

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19.2.x |
| Build Tool | Vite | 5.4.x |
| Routing | React Router | 6.30.x |
| State | Zustand | 5.0.x |
| Data Fetching | TanStack React Query | 5.90.x |
| Forms | React Hook Form + Zod | 7.71.x / 4.3.x |
| Offline DB | Dexie (IndexedDB) | 4.2.x |
| Charts | Recharts | 3.7.x |
| Icons | Lucide React | 0.563.x |
| PDF (client) | jsPDF + jsPDF-AutoTable | 4.2.x / 5.0.x |
| Barcodes | JsBarcode + qrcode.react | 3.12.x / 4.2.x |
| CSS | Tailwind CSS | 4.1.x |
| PWA | vite-plugin-pwa + Workbox | 1.2.x / 7.4.x |
| Real-time | socket.io-client | 4.8.x |
| Toasts | Sonner + react-hot-toast | 2.x |

### Third Package: Fingerprint Service

A standalone Node.js service for biometric fingerprint capture and matching.

---

## 1.2 Monorepo Structure

```
glide-Hims/current/
├── pnpm-workspace.yaml          # Monorepo config (packages/*)
├── packages/
│   ├── backend/                  # NestJS API server
│   │   ├── src/
│   │   │   ├── common/           # Guards, interceptors, decorators, utils
│   │   │   ├── database/
│   │   │   │   ├── entities/     # 192 TypeORM entities
│   │   │   │   └── migrations/   # 104 migrations
│   │   │   └── modules/          # 94 NestJS modules
│   │   │       ├── admin/
│   │   │       ├── appointments/
│   │   │       ├── auth/
│   │   │       ├── billing/
│   │   │       ├── encounters/
│   │   │       ├── finance/
│   │   │       ├── hr/
│   │   │       ├── insurance/
│   │   │       ├── inventory/
│   │   │       ├── ipd/
│   │   │       ├── lab/
│   │   │       ├── maternity/
│   │   │       ├── pharmacy/
│   │   │       ├── procurement/
│   │   │       ├── saas-revenue/
│   │   │       └── ... (70+ more)
│   │   └── test/
│   ├── frontend/                 # React SPA (Vite + Tailwind)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── stores/           # Zustand state
│   │   │   ├── hooks/
│   │   │   └── services/         # API clients
│   │   └── public/
│   └── fingerprint-service/      # Biometric capture service
├── docker-compose.yml
├── docker-compose.hybrid.yml     # On-premise hybrid deployment
└── GLIDE-HIMS-SYSTEM-DOCUMENT.md # This document
```

**Package manager:** pnpm with workspace protocol
**Build:** `nest build` (backend), `vite build` (frontend)
**TypeScript check:** `npx tsc --noEmit`

---

## 1.3 Multi-Tenant SaaS Model

### Architecture: Row-Level Multi-Tenancy

All data tables include a `tenant_id` column (NOT NULL, enforced since migration `1777500000000`). Tenancy is enforced at multiple layers:

```
Request → JWT Extraction → TenantContextMiddleware → TenantContextGuard → Service
                                    │
                    Resolves tenantId from:
                    1. JWT payload (tenantId field)
                    2. x-facility-id header → facility.tenantId
                    3. Query parameter fallback
```

**Key components:**

| Component | File | Purpose |
|-----------|------|---------|
| TenantContextMiddleware | `tenant-context.middleware.ts` | Resolves `req.tenantContext = { tenantId, facilityId }` |
| TenantContextGuard | `tenant-context.guard.ts` | Ensures tenant context exists on protected routes |
| Tenant-Aware Repository | `tenant-aware.repository.ts` | Auto-appends `WHERE tenant_id = :tenantId` |
| Tenant Subscriber | `tenant.subscriber.ts` | Auto-populates `tenant_id` on INSERT/UPDATE |

**Tenant hierarchy:**

```
Tenant (Organization)
  └── Facility (Hospital / Clinic / Pharmacy)
       └── Department
            └── Ward / Store / Lab / Theatre
```

**Feature modules:** Each tenant has a `License` linked to a `SaasPlan` that controls which modules are enabled via `TenantFeatureModule` records. Enforced by `ModuleGuard` on endpoints decorated with `@AuthWithModule()`.

### Deployment Models

| Model | Description |
|-------|-------------|
| **SaaS (Cloud)** | Multi-tenant on shared infrastructure. Control plane at `hmisdemo.itsolutionsuganda.com` |
| **Hybrid (On-Premise)** | Docker Compose deployed on customer LAN. Single-tenant. Connects to control plane for licensing/updates |

---

## 1.4 Entity-Relationship Overview

**Total entities: 192** across 12 domains.

| Domain | Entity Count | Key Entities |
|--------|-------------|-------------|
| Clinical & Patient | 30 | Patient, Encounter, ClinicalNote, Prescription, Diagnosis, DischargeSummary, SurgeryCase, TreatmentPlan, Vital |
| Laboratory | 8 | LabTest, LabSample, LabResult, LabQC, LabEquipment, LabReagent, CriticalResultAlert, ICD10Code |
| Radiology | 3 | ImagingModality, ImagingOrder, ImagingResult |
| Pharmacy | 5 | PharmacySale, DrugClassification, DrugInteractionOverride, DrugLabelTemplate, DrugSyncLog |
| Inventory & Procurement | 20 | Item, BatchStock, PurchaseRequest, PurchaseOrder, GoodsReceipt, Supplier, StockTransfer, CycleCount, Disposal |
| Billing & Finance | 25 | Invoice, JournalEntry, ChartOfAccount, FiscalPeriod, InsuranceClaim, InsurancePolicy, PricingRule, FixedAsset |
| HR | 18 | Employee, Attendance, LeaveRequest, PayrollRun, Payslip, JobPosting, PerformanceAppraisal, TrainingProgram |
| Maternity | 6 | AntenatalRegistration, AntenatalVisit, LabourRecord, DeliveryOutcome, PostnatalVisit, BabyWellnessCheck, ImmunizationSchedule |
| Facility & Organization | 8 | Facility, Department, Ward, Bed, BedTransfer, Theatre, FacilityConfig, FacilityModule |
| Auth & Access Control | 13 | User, Role, Permission, PermissionGroup, Session, RefreshToken, ApiKey, LoginHistory, PasswordPolicy |
| SaaS Platform | 15+ | Tenant, License, SaasPlan, SaasSubscription, SaasInvoice, SaasPayment, SaasCoupon, SaasQuotation, SaasContract, ClientOnboarding, ClientHealthScore |
| System & Infra | 20+ | AuditLog, FeatureFlag, Deployment, Backup, SyncQueue, ReplicationLog, SystemSetting, AppVersion |

**Base entity pattern:** All entities extend `BaseEntity` with automatic `id` (UUID), `tenantId`, `createdAt`, `updatedAt`, `deletedAt` (soft-delete).

---

## 1.5 Authentication & Authorization

### Authentication: JWT + Passport

**Login flow:**
1. `POST /auth/login` — username/password → validate → issue JWT (access + refresh tokens)
2. JWT stored in `accessToken` cookie OR `Authorization: Bearer` header
3. MFA: If `user.mfaEnabled`, login returns `mfaRequired: true`; second call with TOTP code completes auth
4. Account lockout: After N failed attempts (`PasswordPolicy.maxAttempts`), account locked until `lockedUntil`

**JWT payload:**
```typescript
{
  sub: string;              // User ID
  username: string;
  email: string;
  tenantId?: string;
  roles: string[];
  facilityId?: string;
  tokenVersion?: number;    // Revocation support
  impersonating?: boolean;  // System admin impersonation
}
```

**Token validation:** Checks `user.tokenVersion` against JWT to support instant revocation. Cached 5s via Redis.

### Authorization: Layered Model

```
Public (@Public)
  │
  ▼
JWT Auth (GlobalJwtAuthGuard)
  │
  ▼
Tenant Context (TenantContextGuard)
  │
  ├── Role-Based (@Auth(...roles) → RolesGuard)
  ├── Permission-Based (@AuthWithPermissions(...perms) → PermissionsGuard)
  ├── Module-Based (@AuthWithModule(module, ...perms) → ModuleGuard)
  ├── Ownership-Based (@AuthWithOwnership(perm, config) → OwnershipGuard)
  ├── Feature Flag (@RequireFeature() → FeatureGuard)
  └── Facility Scope (@FacilityAccess() → FacilityGuard)
```

**Permission resolution algorithm:**
1. Fetch user's direct roles (filtered by facility if applicable)
2. Walk role inheritance chain (max depth 10) via `parentRoleId`
3. Collect permissions from all roles + inherited roles
4. Collect permissions from permission groups assigned to roles
5. Collect direct user permissions (`UserPermission`)
6. Deduplicate and cache (60s TTL, key: `perms:{tenantId}:{userId}:{facilityId}`)

**Decorators (13 total):**

| Decorator | Purpose |
|-----------|---------|
| `@Public()` | Bypass all auth |
| `@Auth(...roles)` | JWT + role check |
| `@AuthWithPermissions(...perms)` | JWT + permission check |
| `@AuthWithModule(module, ...perms)` | JWT + module enablement + permission |
| `@AuthWithOwnership(perm, config)` | Row-level ownership validation |
| `@SystemAdminOnly()` | System admin gate |
| `@CurrentUser(field)` | Inject JWT payload field |
| `@Roles(...roles)` | Role metadata |
| `@RequirePermissions(...perms)` | Permission metadata |
| `@RequireModule(module)` | Module enablement check |
| `@RequireFeature()` | Feature flag check |
| `@FacilityAccess()` | Facility scope |
| `@SkipEmployeeCheck()` | Skip employee status validation |

**System admin access:** System admins can impersonate any tenant. Support access is tiered (NONE → BASIC → ADVANCED → FULL) via `SupportAccessGrant`. All system admin actions are audit-logged.

---

## 1.6 Stakeholder Roles

| # | Role | Responsibilities | Key Modules |
|---|------|-----------------|-------------|
| 1 | **System Administrator** | Platform management, tenant provisioning, licensing, deployments | Admin, Tenants, Licensing, Deployments, SaaS Revenue |
| 2 | **Facility Administrator** | Facility configuration, user management, module setup | Admin, Facilities, Users, Roles, System Settings |
| 3 | **Doctor / Clinician** | Patient consultations, prescriptions, orders, clinical notes | Encounters, Clinical Notes, Prescriptions, Orders, Referrals |
| 4 | **Nurse** | Triage, vitals, nursing notes, medication administration, ward care | Encounters, Vitals, IPD, Maternity, Emergency |
| 5 | **Receptionist / Front Desk** | Patient registration, appointment booking, queue management | Patients, Appointments, Queue Management, Encounters |
| 6 | **Cashier / Billing Officer** | Invoice generation, payment collection, receipts | Billing, POS, Payments |
| 7 | **Pharmacist** | Dispensing, drug interactions, controlled substances, stock | Pharmacy, Prescriptions, Drug Management, Inventory |
| 8 | **Lab Technician** | Sample collection, processing, result entry | Lab, Lab Supplies |
| 9 | **Lab QC Officer** | Result validation, QC release, amendment | Lab (QC workflow) |
| 10 | **Radiologist / Imaging Tech** | Imaging procedures, scheduling, report writing | Radiology |
| 11 | **HR Manager** | Employee lifecycle, payroll, leave, training, appraisals | HR |
| 12 | **Finance Officer / Accountant** | GL management, journal entries, reconciliation, reports | Finance, Billing |
| 13 | **Procurement Officer** | Purchase requests, POs, GRNs, supplier management | Procurement, Suppliers, Inventory |
| 14 | **Store / Inventory Manager** | Stock management, transfers, expiry tracking, cycle counts | Inventory, Stores, Stock Transfer |
| 15 | **Insurance Officer** | Claims processing, pre-authorization, payer coordination | Insurance |
| 16 | **Patient (Portal)** | View records, book appointments, view results | Patient Portal |

---

# Part 2 — Process Flows

## 2.1 Outpatient (OPD) Journey

### Flow Diagram

```
Patient Arrival
     │
     ▼
[1] Registration ──── Receptionist creates/updates patient record
     │                 Module: patients.service
     ▼
[2] Appointment ───── Optional: pre-booked or walk-in
     │                 Module: appointments.service
     │                 Conflict check: no double-booking (pessimistic lock)
     ▼
[3] Encounter ─────── Receptionist creates OPD encounter
     │                 Module: encounters.service
     │                 Status: REGISTERED
     │                 Auto-bills consultation fee (CON-OPD)
     │                 Pessimistic lock prevents duplicate active encounter
     ▼
[4] Triage ────────── Nurse records vitals (BP, temp, weight, HR)
     │                 Module: vitals.service
     │                 Status: REGISTERED → TRIAGE
     ▼
[5] Queue ─────────── Patient enters doctor's waiting queue
     │                 Module: queue-management.service
     │                 Status: TRIAGE → WAITING
     │                 Priority: RETURN_TO_DOCTOR patients first
     ▼
[6] Consultation ──── Doctor examines, documents, orders
     │                 Module: clinical-notes.service, orders.service
     │                 Status: WAITING → IN_CONSULTATION
     │                 Creates: ClinicalNote (SOAP), Diagnosis, Orders
     ▼
[7] Orders ────────── Lab tests, imaging, prescriptions
     │                 Modules: lab, radiology, prescriptions
     │                 Status branches:
     │                 ├── PENDING_LAB (if lab ordered)
     │                 ├── PENDING_PHARMACY (if meds ordered)
     │                 └── PENDING_PAYMENT (if payment required)
     ▼
[8] Payment ───────── Cashier collects payment
     │                 Module: billing.service
     │                 Invoice status: PENDING → PAID
     ▼
[9] Completion ────── All orders fulfilled, payment settled
                       Status: → COMPLETED
                       Validation: canComplete() blocks if unpaid invoices
                       (except post_pay billing mode)
```

### Business Rules

| Rule | Detail |
|------|--------|
| Double-booking prevention | Pessimistic lock checks overlapping time slots with same provider |
| Active encounter guard | Only one active OPD encounter per patient (pessimistic lock) |
| Bounce limit | Max 5 returns to doctor; escalates to supervisor at 3+ bounces |
| Auto-billing | OPD registration auto-bills consultation fee (service codes: CON-OPD, CONSULTATION, OPD-OPD-CONSULT) |
| Queue priority | RETURN_TO_DOCTOR patients processed before new patients |
| Completion guard | Blocks completion if unpaid invoices exist (except `post_pay` mode) |

### Status Transitions

```
REGISTERED → TRIAGE → WAITING → IN_CONSULTATION
                                      │
                    ┌─────────────────┼──────────────────┐
                    ▼                 ▼                   ▼
              PENDING_LAB     PENDING_PHARMACY    PENDING_PAYMENT
                    │                 │                   │
                    ├── RETURN_TO_DOCTOR ◄────────────────┤
                    ├── RETURN_TO_PHARMACY
                    ├── RETURN_TO_LAB
                    └──────────► COMPLETED
```

---

## 2.2 Inpatient (IPD) Journey

### Flow Diagram

```
Admission Request (from OPD/ED)
     │
     ▼
[1] Bed Allocation ── IPD staff selects ward & bed
     │                  Module: ipd.service.createAdmission()
     │                  Pessimistic lock prevents double-admission
     │                  Bed status: AVAILABLE → OCCUPIED
     │                  Ward occupancy counters updated
     ▼
[2] Admission ──────── Patient admitted with primary diagnosis
     │                  Entity: Admission (status: ADMITTED)
     │                  Auto-bills bed charge
     │                  Encounter type updated to IPD
     ▼
[3] Nursing Care ───── Shift-by-shift observations
     │                  Module: ipd.service.createNursingNote()
     │                  Vitals mirrored to canonical vitals table
     │                  Critical alerts auto-triggered
     ▼
[4] Medication ──────── Drug administration per schedule
     │                  Module: ipd.service.administerMedication()
     │                  Allergy check (substring match against patient.allergies)
     │                  Double-administration prevention (pessimistic lock)
     │                  Controlled substance: requires witness + doubleCheck
     ▼
[5] Bed Transfer ───── Optional: move to different ward/bed
     │                  Module: ipd.service.transferBed()
     │                  Records BedTransfer entry
     │                  Updates both wards' occupancy counts
     ▼
[6] Discharge ──────── Doctor orders discharge
                        Module: ipd.service.dischargePatient()
                        Bed status: OCCUPIED → CLEANING
                        Auto-generates bed-day invoice (handles transfers)
                        Ward occupancy updated
```

### Key Entities & States

| Entity | Status Values |
|--------|--------------|
| Bed | AVAILABLE, OCCUPIED, CLEANING, RESERVED, OUT_OF_SERVICE |
| Admission | ADMITTED, DISCHARGED, TRANSFERRED |
| MedicationAdmin | SCHEDULED, ADMINISTERED, HELD, MISSED, SKIPPED |

### Business Rules

- **Bed reservation TTL:** 4 hours max; auto-releases if not admitted
- **Allergy guard:** Blocks drug administration unless `overrideReason` provided
- **Nursing vitals mirroring:** Ward-round vitals recorded in canonical vitals table for patient timeline
- **Discharge billing:** Computes bed-day charges correctly across transfers
- **Census reporting:** Tracks occupancy %, ALOS, turnover metrics

---

## 2.3 Emergency Department

### Flow Diagram

```
Patient Arrival (ambulance / walk-in)
     │
     ▼
[1] Registration ──── Atomic creation of EmergencyCase + Encounter
     │                 Module: emergency.service.registerCase()
     │                 Case number: pessimistic lock (format: EDYYMMDDnnnnn)
     │                 Encounter type: EMERGENCY, status: TRIAGE
     ▼
[2] Triage ────────── Nurse assigns triage level + records vitals
     │                 Module: emergency.service.triageCase()
     │                 Triage levels: P1 (Resuscitation) → P5 (Non-Urgent)
     │                 Vitals mirrored to canonical table
     │                 Status: PENDING → TRIAGED
     ▼
[3] Treatment ─────── Doctor begins treatment
     │                 Module: emergency.service.startTreatment()
     │                 Status: TRIAGED → IN_TREATMENT
     │                 Doctor assigned
     ▼
[4] Disposition ───── Final outcome decision
                       ├── DISCHARGED (home with follow-up)
                       ├── ADMITTED (to IPD — triggers admission flow)
                       ├── TRANSFERRED (to other facility)
                       ├── LEFT_AMA (left against medical advice)
                       └── DECEASED
```

### Triage Levels

| Level | Name | Target Response Time |
|-------|------|---------------------|
| P1 | Resuscitation | Immediate |
| P2 | Emergent | ≤ 10 minutes |
| P3 | Urgent | ≤ 30 minutes |
| P4 | Less Urgent | ≤ 1-2 hours |
| P5 | Non-Urgent | ≤ 2+ hours |

### Worklist Ordering

Treatment queue sorted by: `triageLevel ASC` (P1 first), then `arrivalTime ASC`.

### Dashboard KPIs

- Cases by triage level
- Cases by status
- Critical case count
- Average wait times (triage → treatment)

---

## 2.4 Pharmacy & Dispensing

### Flow Diagram

```
Doctor Prescribes
     │
     ▼
[1] Prescription ──── Created during consultation
     │                 Module: prescriptions.service.create()
     │                 Status: PENDING
     │                 Items: drug, quantity, strength, frequency, duration
     ▼
[2] Review ────────── Pharmacist reviews prescription
     │                 Drug interaction check (pharmacy.service.checkInteractions())
     │                 Override requires manager approval + documented reason
     │                 Status: PENDING → READY_TO_DISPENSE
     ▼
[3] Dispensing ────── Pharmacist dispenses medications
     │                 Module: prescriptions.service.dispenseItem()
     │                 FEFO allocation (First Expiry, First Out)
     │                 Status: READY_TO_DISPENSE → DISPENSING
     │                 For controlled substances:
     │                   - Witness required (prescriptions.service.addWitness())
     │                   - Double check required (prescriptions.service.doubleCheck())
     │                   - Logged in ControlledSubstanceLog
     ▼
[4] Ready ─────────── All items dispensed
     │                 Status: DISPENSING → READY_FOR_PICKUP
     ▼
[5] Collection ────── Patient picks up medication
                       Status: READY_FOR_PICKUP → COLLECTED
```

### Walk-in Sales (POS)

```
Customer at pharmacy counter
     │
     ▼
[1] Sale Created ──── pharmacy.service.createSale()
     │                 Status: PENDING
     │                 POS shift guard: must have active shift
     ▼
[2] Payment ───────── pharmacy.service.completeSale()
     │                 Stock deducted (FEFO)
     │                 Status: PENDING → COMPLETED
     │                 Or: pharmacy.service.cancelSale() → CANCELLED + stock return
```

### Additional Pharmacy Functions

| Function | Service Method | Description |
|----------|---------------|-------------|
| Expiry management | `checkExpiringItems()` | Flag items expiring within 90 days |
| Quarantine | `quarantineItem()` | Move batch to quarantine status |
| Expired processing | `processExpiredItem()` | Dispose or return to supplier |
| Temperature monitoring | IoT integration | Alerts on out-of-range fridge/freezer temps |
| Low stock alerts | `checkLowStock()` | Item qty ≤ reorder level triggers PR |

---

## 2.5 Laboratory

### Flow Diagram

```
Doctor Orders Lab Test
     │
     ▼
[1] Order Created ─── orders.service (type: LAB)
     │                  Lab charges added to billing
     ▼
[2] Sample Collection  lab.service.collectSample()
     │                  Barcode generated: LABYYMMDDnnnnn (advisory lock)
     │                  Status: COLLECTED
     │                  Auto-creates samples for all ordered tests
     ▼
[3] Sample Received ── lab.service.receiveSample()
     │                  Status: COLLECTED → RECEIVED
     ▼
[4] Processing ──────── lab.service.startProcessing()
     │                  Status: RECEIVED → PROCESSING
     ▼
[5] Result Entry ────── lab.service.enterResult()
     │                  Technician enters values
     │                  Auto-calculates abnormal flag:
     │                    NORMAL, LOW, HIGH, CRITICAL_LOW, CRITICAL_HIGH
     │                  Status: ENTERED
     ▼
[6] QC Validation ───── lab.service.validateResult()
     │                  QC Officer reviews plausibility
     │                  Status: ENTERED → VALIDATED
     ▼
[7] QC Release ──────── lab.service.releaseResult()
     │                  Status: VALIDATED → RELEASED
     │                  Visible to clinician
     │                  Critical results → in-app notification to provider
     ▼
[8] Amendment ───────── lab.service.amendResult() (if correction needed)
                        Status: RELEASED → AMENDED (with audit trail)
```

### RBAC for Results

- Users without `labqc.view` permission: only see RELEASED/AMENDED results
- PENDING/ENTERED/VALIDATED hidden until QC release
- System admins bypass visibility restrictions

### Reference Range Validation

- `normalMin ≤ normalMax` enforced at test creation
- `criticalLow ≤ criticalHigh` enforced
- Abnormal flags calculated automatically on result entry

### KPIs

- Turnaround time: collection → release per test type (median, P90)
- Sample rejection rate
- Critical result notification time

---

## 2.6 Radiology & Imaging

### Flow Diagram

```
Doctor Orders Imaging
     │
     ▼
[1] Order Created ─── radiology.service.createOrder()
     │                 Status: PENDING
     │                 Priority: STAT / URGENT / ROUTINE
     ▼
[2] Scheduling ────── radiology.service.scheduleOrder()
     │                 Assigns time slot + room
     │                 Status: PENDING → SCHEDULED
     ▼
[3] Imaging ───────── radiology.service.startImaging()
     │                 Status: SCHEDULED → IN_PROGRESS
     ▼
[4] Completion ────── radiology.service.completeImaging()
     │                 Status: IN_PROGRESS → COMPLETED
     ▼
[5] Report ────────── radiology.service.createResult()
                       Radiologist generates formal report
                       Findings + impression documented
```

### Modality Types

RADIOGRAPHY (X-ray), CT, MRI, ULTRASOUND, FLUOROSCOPY, NUCLEAR_MEDICINE, MAMMOGRAPHY

### Worklist Priority

Sorted by: `priority ASC` (STAT → URGENT → ROUTINE), then `orderDate ASC`

### KPIs

- Queue depth per modality
- Turnaround time: order → report per modality
- Modality utilization rate

---

## 2.7 Billing & Insurance

### Flow Diagram

```
Service Delivered (consultation, lab, pharmacy, bed, procedure)
     │
     ▼
[1] Charge Capture ── billing.service.createInvoice()
     │                 Validates: no negative amounts, tax calculation
     │                 Insurance pre-auth check (cumulative usage)
     │                 VAT: 18% default (unless tax-exempt)
     │                 Invoice status: DRAFT or PENDING
     │                 GL: DR Accounts Receivable, CR Revenue
     ▼
[2] Payment ───────── billing.service.recordPayment()
     │                 Receipt number via advisory lock (sequential)
     │                 Methods: CASH, CARD, MOBILE_MONEY, BANK_TRANSFER,
     │                          INSURANCE, CHEQUE, MEMBERSHIP
     │                 Status: PENDING → PARTIALLY_PAID → PAID
     │                 GL: DR Bank, CR Accounts Receivable
     ▼
[3] Insurance Claim ─ insurance.service.createClaim() (if insured)
     │                 Link to invoice + pre-auth
     │                 Status: DRAFT → SUBMITTED → IN_REVIEW
     │                 → APPROVED / REJECTED / PARTIALLY_APPROVED
     │                 → PAID (when insurance pays)
     ▼
[4] Reconciliation ── Outstanding invoices tracked
                       Patient tab view (running balance across encounters)
                       Write-off for bad debt (finance.manage permission)
                       Refund capability with GL reversal
```

### Insurance Pre-Authorization Flow

1. Check policy status = ACTIVE
2. Find most recent approved pre-auth
3. Validate expiration (`validUntil` date)
4. Cumulative usage check: sum already-invoiced amounts
5. Reject if new invoice exceeds remaining pre-auth balance

### Invoice Statuses

```
DRAFT → PENDING → PARTIALLY_PAID → PAID
                                  → CANCELLED
                                  → REFUNDED
```

### Claim Statuses

```
DRAFT → SUBMITTED → ACKNOWLEDGED → IN_REVIEW → APPROVED → PAID
                                              → REJECTED → APPEALED
                                              → PARTIALLY_APPROVED → PAID
```

---

## 2.8 Procurement & Supply Chain

### Flow Diagram

```
Stock Needed (manual or auto-reorder)
     │
     ▼
[1] Purchase Request ─ procurement.service (create PR)
     │                  Status: DRAFT
     │                  Items: itemId, quantity, estimated unit price
     ▼
[2] Submit ────────── procurement.service (submit)
     │                 Status: DRAFT → PENDING_APPROVAL
     │                 Triggers multi-level approval chain
     ▼
[3] Approval ──────── Threshold-based approval routing
     │                 Status: PENDING_APPROVAL → APPROVED
     │                 Or: → REJECTED (with reason)
     ▼
[4] Purchase Order ── procurement.service (create PO from PR)
     │                 Links to supplier
     │                 Status: DRAFT → PENDING_APPROVAL → APPROVED → SENT
     │                 PR status: → PARTIALLY_ORDERED / FULLY_ORDERED
     ▼
[5] Goods Receipt ─── procurement.service (create GRN)
     │                 Records received quantities, batch#, expiry dates
     │                 QC inspection: quantityAccepted, quantityRejected
     │                 Status: DRAFT → PENDING_INSPECTION → INSPECTED → APPROVED
     ▼
[6] Post to GL ────── procurement.service (post GRN)
     │                 Status: APPROVED → POSTED
     │                 Updates inventory stock ledger
     │                 GL: DR Inventory, CR Accounts Payable
     │                 PO status: → PARTIALLY_RECEIVED / FULLY_RECEIVED
     ▼
[7] Three-Way Match ─ procurementGLIntegration.validateThreeWayMatch()
     │                 PO qty = GRN qty = Supplier Invoice qty?
     │                 Mismatches flagged for manual review
     ▼
[8] Supplier Payment  Supplier finance processes payment
```

### Auto-Reorder

`runAutoReorderDraftPRs()` scans items below `reorderLevel`, calculates quantity to reach `maxStockLevel`, creates PRs in DRAFT status.

### Status Transitions

**Purchase Request:**
```
DRAFT → PENDING_APPROVAL → APPROVED → PARTIALLY_ORDERED → FULLY_ORDERED → COMPLETED
                         → REJECTED
```

**Purchase Order:**
```
DRAFT → PENDING_APPROVAL → APPROVED → SENT → PARTIALLY_RECEIVED → FULLY_RECEIVED → CLOSED
                                            → CANCELLED
```

**Goods Receipt:**
```
DRAFT → PENDING_INSPECTION → INSPECTED → APPROVED → POSTED
                                                   → CANCELLED
```

---

## 2.9 Human Resources

### Flow Diagram

```
New Hire
     │
     ▼
[1] Employee Record ── hr.service (create employee)
     │                  Assign employeeNumber, department, position
     │                  Employment type: PERMANENT, CONTRACT, TEMPORARY, INTERN
     │                  Status: ACTIVE
     ▼
[2] Onboarding ────── Checklist of setup tasks
     │
     ├── [A] Attendance ─── attendance.record()
     │                      Daily clock-in/out tracking
     │
     ├── [B] Leave Mgmt ─── leave.request() → approve()
     │                      Types: ANNUAL (21d default), SICK, MATERNITY,
     │                             PATERNITY, COMPASSIONATE, UNPAID
     │                      Auto-deducts from balance on approval
     │                      Annual reinstatement (Jan 1)
     │
     ├── [C] Payroll ────── payroll.run()
     │                      Gross = basicSalary + allowances
     │                      Net = Gross - deductions (NSSF, PAYE, loans)
     │                      Generate payslips per employee
     │                      GL: DR Salary Expense, CR Bank
     │                      Status: DRAFT → SUBMITTED → APPROVED → PROCESSED → PAID
     │
     ├── [D] Training ──── training.enroll()
     │                      Programs with budget, dates, assessment
     │                      Track completion + scores
     │
     ├── [E] Appraisal ── appraisals.create()
     │                      Self-review → Manager review → Final rating
     │                      Ratings: BELOW/MEETS/EXCEEDS/OUTSTANDING
     │                      Status: DRAFT → IN_PROGRESS → AWAITING_MANAGER
     │                              → AWAITING_FINAL → COMPLETED → CLOSED
     │
     └── [F] Disciplinary  disciplinary.create()
                            Status: OPEN → UNDER_INVESTIGATION → HEARING_SCHEDULED
                                    → DECISION_ISSUED → RESOLVED
                            Actions: VERBAL_WARNING, WRITTEN_WARNING,
                                     SUSPENSION, TERMINATION, DEMOTION
```

### Employee Status Lifecycle

```
ACTIVE ─── ON_LEAVE (sabbatical/medical)
       ├── SUSPENDED (disciplinary)
       ├── TERMINATED (set terminationDate + reason)
       ├── RESIGNED
       └── RETIRED
```

### Staff Categories

DOCTOR, NURSE, LAB_TECHNICIAN, PHARMACIST, RADIOLOGIST, RECEPTIONIST, CASHIER, ACCOUNTANT, IT_SUPPORT, OTHER

---

## 2.10 Inventory & Stores

### Flow Diagram

```
Stock Entry (from GRN, transfer, or manual adjustment)
     │
     ▼
[1] Stock Receipt ──── inventory.service.receiveStock()
     │                  MovementType: PURCHASE
     │                  Validates batch# (if requiresBatchTracking)
     │                  Validates expiry (if requiresExpiryTracking)
     │                  Creates StockLedger entry
     ▼
[2] Stock Balance ──── Calculated from ledger entries
     │                  totalQuantity = SUM(PURCHASE + TRANSFER_IN
     │                                    - SALE - TRANSFER_OUT
     │                                    - EXPIRED - DAMAGED)
     │                  availableQuantity = totalQuantity - reservedQuantity
     ▼
[3] Consumption ────── Stock used (dispensing, procedure, etc.)
     │                  MovementType: SALE
     │                  StockLedger: quantity = negative
     ▼
[4] Transfer ───────── inventory.service.transferStock()
     │                  Between facilities/stores
     │                  Source: TRANSFER_OUT (-qty)
     │                  Dest: TRANSFER_IN (+qty)
     │                  Both linked by same referenceId
     ▼
[5] Adjustment ──────── inventory.service.adjustStock()
     │                  Manual correction (count variance, breakage)
     │                  MovementType: ADJUSTMENT
     │                  Requires reason + audit trail
     ▼
[6] Monitoring ──────── Ongoing
                        ├── Low stock: totalQuantity ≤ reorderLevel → trigger PR
                        ├── Expiring: expiryDate ≤ NOW() + 90 days → alert
                        ├── Expired: expiryDate < NOW() → write-off or return
                        └── Consumption reports: demand forecasting
```

### Movement Types

| Type | Direction | Reference |
|------|-----------|-----------|
| PURCHASE | +qty | GRN |
| SALE | -qty | Invoice |
| ADJUSTMENT | ±qty | Manual |
| TRANSFER_IN | +qty | Transfer |
| TRANSFER_OUT | -qty | Transfer |
| RETURN | +qty | Patient/customer |
| EXPIRED | -qty | Write-off |
| DAMAGED | -qty | Write-off |

### Item Master Data

- `code` (unique), `name`, `genericName` (drugs), `isDrug`, `requiresPrescription`, `isControlled`
- `reorderLevel` (default 10), `maxStockLevel`, `unitCost`, `sellingPrice`
- Classification: category → subcategory → brand → formulation → unit → strength
- Storage condition: room temp, 2-8°C, freeze

---

## 2.11 Maternity Care

### Flow Diagram

```
Pregnant Woman Presents
     │
     ▼
[1] ANC Registration ─ maternity.service.registerAntenatal()
     │                   EDD = LMP + 280 days (Naegele's rule)
     │                   GA = (today - LMP) / 7 weeks
     │                   Status: ACTIVE
     │                   Risk level: LOW / MODERATE / HIGH
     ▼
[2] ANC Visits ──────── maternity.service.recordVisit()
     │                   Minimum 4 visits recommended:
     │                     1st: <16 weeks
     │                     2nd: 16-20 weeks
     │                     3rd: 20-32 weeks
     │                     4th: 32+ weeks
     │                   Records: vitals, fetal movement, urine dipstick, weight
     │                   Risk level updated if complications detected
     ▼
[3] Labour Admission ── maternity.service.admitLabour()
     │                   LabourRecord created
     │                   Status: IN_LABOUR
     ▼
[4] Labour Progress ─── maternity.service.updateLabourProgress()
     │                   Cervical dilation, effacement, station
     │                   Fetal heart rate, contractions
     │                   Decision: continue vs operative delivery
     │                   Status: IN_LABOUR → DELIVERING
     ▼
[5] Delivery ────────── maternity.service.recordDelivery()
     │                   Mode: VAGINAL_SPONTANEOUS, VAGINAL_ASSISTED,
     │                         CAESAREAN, BREECH
     │                   Status: DELIVERING → DELIVERED
     │                   Maternal outcome recorded
     ▼
[6] Baby Outcome ────── maternity.service.recordBabyOutcome()
     │                   Status: LIVE_BIRTH, STILLBIRTH_FRESH,
     │                           STILLBIRTH_MACERATED, NEONATAL_DEATH,
     │                           PREMATURE, LOW_BIRTH_WEIGHT
     │                   Apgar scores (1 min + 5 min)
     │                   Resuscitation measures if needed
     ▼
[7] Baby Wellness ───── maternity.service.recordBabyWellness()
     │                   Apgar review, breastfeeding assessment
     │                   Jaundice evaluation, cord care
     │                   Temperature stability, feeding pattern
     ▼
[8] Immunization ────── maternity.service.generateImmunizationSchedule()
     │                   Uganda EPI schedule auto-generated:
     │                     Birth: BCG, Polio(0)
     │                     6w: DPT1, OPV1, PCV1, RV1
     │                     10w: DPT2, OPV2, PCV2, RV2
     │                     14w: DPT3, OPV3, PCV3, IPV
     │                     9m: Measles/Rubella
     │                     18m: DPT Booster, OPV Booster
     │                   Administration: batch#, injection site, provider
     │                   Defaulter tracking: >14 days overdue → outreach
     ▼
[9] PNC Visits ──────── maternity.service.recordPostnatalVisit()
                         1st: 0-3 days (mother/baby check)
                         2nd: 4-7 days (circumcision check)
                         3rd: 2 weeks (breastfeeding, jaundice)
                         4th+: up to 6 weeks (family planning)
                         getPNCDueList() shows overdue patients
```

### Pregnancy Status Transitions

```
ACTIVE → DELIVERED
       → LOST_TO_FOLLOWUP
       → SELF_DISCHARGED
       → TRANSFERRED
```

### Immunization Statuses

DUE, ADMINISTERED, MISSED, DEFERRED, CONTRAINDICATED

---

## 2.12 Finance & Accounting

### Flow Diagram

```
Financial Transaction Occurs
     │
     ▼
[1] Chart of Accounts ─ finance.service.createAccount()
     │                   Types: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
     │                   Hierarchical: parentAccountId supports nesting
     │                   Normal balance: debit (assets) / credit (liabilities)
     ▼
[2] Fiscal Periods ──── finance.service (create fiscal year + 12 periods)
     │                   Monthly periods with open/close/lock controls
     │                   Prevent GL changes to closed periods
     ▼
[3] Journal Entry ───── finance.service.createJournalEntry()
     │                   Status: DRAFT
     │                   Double-entry: totalDebit MUST equal totalCredit
     │                   Journal number: JNL-YYYYMM-nnnn
     │
     ├── Manual Entry ── Finance officer creates
     │
     └── Auto-Posted ─── From other modules:
     │                   • Invoice → DR AR, CR Revenue
     │                   • Payment → DR Bank, CR AR
     │                   • GRN → DR Inventory, CR AP
     │                   • Payroll → DR Salary Expense, CR Bank
     │                   • Refund → Reversal entries
     ▼
[4] Approval ────────── finance.service (submit → approve)
     │                   Status: DRAFT → SUBMITTED → APPROVED
     │                   Amount-based approval routing
     ▼
[5] Posting ─────────── finance.service (post)
     │                   Status: APPROVED → POSTED
     │                   Updates GL account balances
     │                   Locked against further edits
     ▼
[6] Reversal ────────── finance.service.reverseJournalEntry()
     │                   Creates opposite entry (swap DR/CR)
     │                   Original marked isReversed = true
     │                   Status: → REVERSED
     ▼
[7] Reconciliation ──── finance.service.reconcileAccount()
     │                   Compare GL vs bank/subsidiary ledger
     │                   Flag unmatched items
     │                   Track days since last reconciliation
     ▼
[8] Financial Reports   Generated from GL data:
                         ├── Trial Balance
                         ├── Income Statement (P&L)
                         ├── Balance Sheet
                         ├── Cash Flow Statement
                         └── Budget Variance Analysis
```

### Journal Entry Statuses

```
DRAFT → SUBMITTED → APPROVED → POSTED
                  → REJECTED
                               → REVERSED
```

### Account Types

| Type | Normal Balance | Examples |
|------|---------------|----------|
| ASSET | Debit | Cash, Bank, Inventory, AR, Fixed Assets |
| LIABILITY | Credit | AP, Loans, Accrued Expenses |
| EQUITY | Credit | Capital, Retained Earnings |
| REVENUE | Credit | Consultation Fees, Lab Revenue, Pharmacy Sales |
| EXPENSE | Debit | Salaries, Supplies, Utilities |
| CONTRA_ASSET | Credit | Accumulated Depreciation, Allowance for Bad Debt |
| CONTRA_LIABILITY | Debit | Bond Discount |

---

## 2.13 SaaS Platform Operations

### Flow Diagram

```
Lead / Prospect
     │
     ▼
[1] Lead Management ─── leads.service
     │                    Pipeline: assignLead, setFollowUp, addActivity
     │                    Priority tracking + activities log
     ▼
[2] Quotation ────────── quotation.service.create()
     │                    Select items from SaasPriceCatalog (37 seeded items)
     │                    Create revision, calculate totals
     │                    Status: DRAFT → SENT (email to prospect)
     ▼
[3] Acceptance ────────── quotation.service.acceptQuotation()
     │                    AUTO-PROVISION TRANSACTION:
     │                    ┌─────────────────────────────────────┐
     │                    │ 1. Quotation status → ACCEPTED      │
     │                    │ 2. Lead → WON (if linked)           │
     │                    │ 3. Find/create Tenant                │
     │                    │ 4. Create SaasSubscription           │
     │                    │    - status: 'trial' or 'active'     │
     │                    │    - trialEndsAt = NOW() + trialDays │
     │                    │    - nextRenewalAt = periodEnd       │
     │                    │ 5. Create/align License (HMAC-signed)│
     │                    │ 6. Link quotation.subscriptionId     │
     │                    │ 7. Emit events → create onboarding   │
     │                    └─────────────────────────────────────┘
     ▼
[4] Contract ───────────── contract.service.createFromQuotation()
     │                     Legal contract document (HTML render)
     ▼
[5] Onboarding ──────────── onboarding.service
     │                      18-item checklist auto-generated:
     │                      • Configure facility, data migration
     │                      • Staff setup, training, go-live
     │                      Progress tracked per task
     ▼
[6] Subscription Active ── saas-revenue.service
     │
     ├── [A] Trial ──────── Trial period (configurable days)
     │                      Cron: renewalTick() hourly
     │                      If trial ends: convert to 'active' or 'past_due'
     │
     ├── [B] Renewal ────── Hourly cron: renewalTick()
     │                      For active subs where nextRenewalAt ≤ NOW():
     │                      1. Generate SaasInvoice (period charges + tax - coupon)
     │                      2. Attempt payment (Flutterwave/PesaPal/manual)
     │                      3. Success: extend period, sync license
     │                      4. Failure: status → 'past_due', start dunning
     │
     ├── [C] Dunning ────── Automated collection for past_due:
     │                      graceDays → reminderIntervalDays → churnAfterDays
     │                      Email reminders at intervals
     │                      Auto-churn after threshold
     │
     ├── [D] Pause/Resume ─ Subscription paused (no charges during pause)
     │                      nextRenewalAt advanced on resume
     │                      License sync on both transitions
     │
     ├── [E] Plan Change ── Upgrade/downgrade with proration
     │                      Credit remaining period, charge new plan
     │                      License sync (new tier)
     │
     └── [F] Churn ──────── Auto (dunning exceeded) or manual cancel
                            License revoked
                            Webhook: 'subscription.churned'
                            Session revocation on deactivation
     ▼
[7] Health Monitoring ───── client-health.service
                            5-component weighted scoring (daily cron)
                            Critical score → alert
```

### Subscription Statuses

```
trial → active → past_due → churned
              → paused → active (resumed)
              → cancelled
```

### Plan Tiers

| Tier | Features | License Type |
|------|----------|-------------|
| Community | Basic modules, limited users | COMMUNITY |
| Standard | Core clinical + billing | STANDARD |
| Professional | Full clinical + procurement + analytics | PROFESSIONAL |
| Enterprise | All modules, unlimited users/facilities | ENTERPRISE |

### Payment Gateways

| Gateway | Region | Methods |
|---------|--------|---------|
| Flutterwave | Pan-Africa | Card, Mobile Money, Bank Transfer |
| PesaPal | East Africa | Card, M-Pesa, MTN MoMo |
| Manual | Universal | Bank transfer, cash (with proof upload + verification) |

### Email Templates (5)

1. `invoice_issued` — New invoice (due date reminder)
2. `payment_receipt` — Payment confirmed
3. `dunning` — Payment past due (with escalation levels)
4. `renewal_reminder` — 7 days before renewal
5. `trial_ending` — 3 days before trial expires

Dedup guard: same email type not sent more than once per 23 hours.

### Webhooks

Events dispatched to registered endpoints with HMAC-SHA256 signatures and 3-attempt retry:
- `subscription.created`, `subscription.renewed`, `subscription.churned`
- `subscription.paused`, `subscription.resumed`
- `payment.succeeded`, `payment.failed`

### Event Chain

```
quotation.created    → LeadActivity log
quotation.accepted   → LeadActivity + onboarding auto-created
onboarding.go_live   → ClientHealthScore initialized
client_health.critical → alert (logger)
```

---

# Part 3 — System Health Audit

## 3.1 Test Coverage

### Summary

| Metric | Count |
|--------|-------|
| Total .module.ts files | 94 |
| Total .spec.ts files | 39 |
| Test file ratio | 41.5% |

### Modules WITH Test Coverage (22 modules)

| Module | Spec Files | Focus |
|--------|-----------|-------|
| auth | 4 | Security, service, tenant isolation |
| deployments | 5 | Service, integration, e2e, health, performance |
| saas-revenue | 5 | Flutterwave, quotation, mailer, revenue, webhooks |
| finance | 3 | Approval, GL reconciliation, trial balance |
| procurement | 2 | Analytics, approval chain integration |
| common (shared) | 4 | File validation, tenant guard, HTTP filter, money utils |
| admin | 2 | Trash permissions, URL validator |
| approvals | 1 | Service spec |
| billing | 1 | Service spec |
| biometrics | 1 | Service spec |
| chronic-care | 1 | Validation spec |
| encounters | 1 | Service spec |
| insurance | 1 | CSV escape spec |
| inventory | 1 | Service spec |
| licensing | 1 | License signature spec |
| patients | 1 | Service spec |
| pharmacy | 1 | Service spec |
| queue-management | 1 | Service spec |
| reports | 1 | Validation spec |
| system-settings | 1 | Settings public spec |
| users | 1 | Security spec |

### Modules WITHOUT Test Coverage (~72 modules)

Critical gaps (high-risk modules with zero tests):

| Priority | Module | Risk |
|----------|--------|------|
| P0 | emergency | Patient safety — triage decisions |
| P0 | ipd | Patient safety — admissions, medication |
| P0 | maternity | Patient safety — labour, delivery |
| P0 | lab | Clinical — sample tracking, results |
| P0 | prescriptions | Patient safety — drug dispensing |
| P0 | surgery | Patient safety — surgical procedures |
| P1 | appointments | Clinical workflow — scheduling |
| P1 | radiology | Clinical — imaging orders |
| P1 | orders | Clinical — all service orders |
| P1 | hr | HR — payroll, leave calculations |
| P1 | pos | Financial — point of sale |
| P1 | payment-gateway | Financial — payment processing |
| P2 | notifications | Operational |
| P2 | integrations | External — DHIS2, Africa's Talking |
| P2 | drug-management | Pharmacy catalog |
| P2 | referrals | Clinical |

---

## 3.2 Audit Logging Gaps

### Summary

| Metric | Count | Percentage |
|--------|-------|-----------|
| Total .service.ts files | 177 | — |
| Services WITH audit logging | 48 | 27.1% |
| Services WITHOUT audit logging | 129 | 72.9% |

### Services WITH Audit Logging (48)

Well-covered modules: auth, billing, encounters, prescriptions, pharmacy, ipd, lab, inventory, insurance, procurement, finance (6 services), compliance (2), users, patients, vitals, hr, clinical-notes, allergies (2), assets, backup, licensing, saas-revenue, queue-management, support-access, supplier-returns, supplier-finance, pos-compliance, downloads, export, analytics, invoice-matching, scheduled-tasks, critical-results, patient-portal.

### Critical Audit Gaps (129 services without audit logging)

| Module | Services Missing Audit | Risk Level |
|--------|----------------------|------------|
| Appointments | 2 services | HIGH — scheduling changes untracked |
| Emergency | 1 service | CRITICAL — triage/treatment untracked |
| Drug Management | 2 services | HIGH — drug catalog changes |
| Maternity | 1 service | CRITICAL — delivery outcomes untracked |
| Radiology | 1 service | HIGH — imaging orders/results |
| Surgery | 1 service | CRITICAL — surgical procedures |
| Tenants | 1 service | HIGH — tenant configuration changes |
| Payment Gateway | 1 service | HIGH — payment processing |
| POS | 4 services (excl. compliance) | HIGH — financial transactions |
| Orders | 1 service | HIGH — clinical orders |
| Referrals | 1 service | MEDIUM |
| Integrations | 3 services | MEDIUM — external data exchange |
| Most reporting services | Multiple | LOW |

---

## 3.3 Missing Workflow State Machines

### Current State: No Formal FSM Framework

**0 formal state machine implementations.** All status transitions are handled through:
- Hardcoded string comparisons in service methods
- Procedural validation with `if/switch` statements
- Some services have `VALID_TRANSITIONS` maps (e.g., encounters) but these are ad-hoc

### Entities with Complex Workflows Needing Formal FSMs

| Entity | Status Count | Current Approach | Risk |
|--------|-------------|-----------------|------|
| Encounter | 12 statuses | VALID_TRANSITIONS map | Medium — most complex, but has validation |
| PurchaseRequest | 8 statuses | Procedural | High — approval chain complexity |
| PurchaseOrder | 8 statuses | Procedural | High |
| GoodsReceiptNote | 6 statuses | Procedural | Medium |
| InsuranceClaim | 10 statuses | Procedural | High — multi-step, involves money |
| JournalEntry | 6 statuses | Procedural | Medium — financial controls |
| SaasSubscription | 6 statuses | Procedural | Medium |
| Prescription | 5 statuses | Procedural | High — patient safety |
| LabSample | 5 statuses | Procedural | Medium |
| EmergencyCase | 6 statuses | Procedural | High — patient safety |
| Admission | 3 statuses | Procedural | Low |
| PayrollRun | 6 statuses | Procedural | Medium — financial |

### Impact

Without formal FSMs:
- Invalid transitions can only be caught by manual code review
- No visualization of allowed transitions
- Duplicate transition logic across controllers and services
- Harder to add new statuses without regression risk

---

## 3.4 Configuration Hardcoding

### Issues Found

| Category | Examples | Count |
|----------|---------|-------|
| API base URLs | Flutterwave: `'https://api.flutterwave.com/v3'` hardcoded as default | 3-5 |
| Cron schedules | Hardcoded in decorators, not configurable per-tenant | 8-10 |
| Magic numbers | Bounce limit (5), bed reservation TTL (4h), triage wait times | 10+ |
| Retry counts | Webhook retry (3), payment retry logic | 3-4 |
| Rate limits | Hardcoded in guard decorators | 4-5 |
| Cache TTLs | JWT cache (5s), permission cache (60s) — some hardcoded | 5-6 |

### Configuration Patterns in Use

| Pattern | Usage |
|---------|-------|
| `process.env.*` | Database, JWT, API keys — working correctly |
| `ConfigService` | Used in ~60 services — good coverage |
| System settings DB | `SystemSetting` entity for runtime config — underutilized |
| Feature flags | `FeatureFlag` entity exists — partially adopted |

### Secrets Management

- Relies on `process.env` without a validation layer at startup
- No secrets rotation mechanism (except LICENSE_SECRET_KEY auto-re-sign)
- MFA secrets encrypted at rest with AES-256-CBC

---

## 3.5 Report Generation Gaps

### Current Reporting Capabilities

| Report Service | Capabilities |
|---------------|-------------|
| `reports.service.ts` | Dashboard, Visits, PatientStats, DiseaseStats, Mortality, Revenue, Collections, Outstanding, Stock, Consumption, Expiry, HMIS Monthly/Weekly, eIDSR |
| `report-generator.service.ts` | Financial reports (P&L, Balance Sheet, Cash Flow) |
| `dur-reports.service.ts` | Drug utilization reporting |
| `export.service.ts` | General data export |

### Format Support

| Format | Backend | Frontend | Status |
|--------|---------|----------|--------|
| JSON API | Yes | Yes | Working |
| CSV | Yes (insurance, exports) | Yes | Partial |
| PDF | Yes (PDFKit available) | Yes (jsPDF) | Available but underutilized |
| Excel | Yes (xlsx library) | No | Available but underutilized |
| HTML | Yes (contract rendering) | Yes | Working |

### Report Gaps

| Missing Report | Domain | Priority |
|---------------|--------|----------|
| Pharmacy dispensing summary | Pharmacy | P1 |
| Lab turnaround time report | Lab | P1 |
| Bed occupancy report (PDF) | IPD | P2 |
| Staff attendance summary | HR | P2 |
| Procurement spend analysis (PDF) | Procurement | P2 |
| Patient discharge summary (PDF) | IPD | P1 |
| Insurance claims aging report | Insurance | P1 |
| Inventory valuation report | Inventory | P2 |
| ANC/maternity outcome report | Maternity | P1 |
| Revenue by department (PDF) | Finance | P2 |

---

## 3.6 Input Validation Coverage

### Summary

| Metric | Count | Percentage |
|--------|-------|-----------|
| Total DTO files | 90 | — |
| DTOs with class-validator decorators | ~60 | 66.7% |
| DTOs without validation | ~30 | 33.3% |

### Well-Validated DTOs

- `user.dto.ts` — @IsString, @IsEmail, @IsNotEmpty, @MinLength, @IsUUID, @IsEnum, @IsDateString, @ValidateNested
- `auth.dto.ts` — Login/register DTOs
- `patient.dto.ts` — Patient registration/update
- `pharmacy.dto.ts` — Sales and dispensing
- `appointment.dto.ts` — Scheduling
- `finance.dto.ts` — Journal entries
- `procurement.dto.ts` — PR/PO creation

### Validation Gaps

| Area | Risk | Issue |
|------|------|-------|
| Webhook handlers | Medium | Accept raw payloads for signature verification (intentional but needs documentation) |
| Integration DTOs | Low | Some DHIS2/external integration DTOs lack validation |
| Legacy DTOs | Medium | ~30 DTOs predate validation standardization |
| File upload endpoints | Medium | Multipart form validation may be incomplete |

---

# Part 4 — Recommended Next Actions

## P0 — Critical (Address Immediately)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | **Add test coverage for patient-safety modules** — emergency, ipd, maternity, prescriptions, surgery, lab | 3-4 weeks | Prevents clinical errors; required for healthcare compliance |
| 2 | **Add audit logging to emergency, maternity, surgery, radiology, orders** | 1 week | Regulatory compliance; clinical accountability; 27% → 40%+ audit coverage |
| 3 | **Implement formal state machine for Encounter workflow** | 1 week | Most complex FSM (12 states); prevents invalid transitions; reference for other FSMs |
| 4 | **Validate all DTOs accepting financial data** — billing, payment, invoice, payroll | 3 days | Prevents injection; ensures data integrity for monetary amounts |
| 5 | **Add startup config validation** — fail-fast if required env vars missing | 2 days | Prevents silent failures in production |

## P1 — High Priority (Next Sprint)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 6 | **Add test coverage for appointments, radiology, hr, pos, payment-gateway** | 2-3 weeks | Extends coverage from 41% → 55%+ |
| 7 | **Implement FSMs for procurement (PR → PO → GRN), insurance claims, prescriptions** | 2 weeks | Declarative transition rules; easier to audit and extend |
| 8 | **Add PDF report generation** for: patient discharge summary, lab reports, pharmacy dispensing, ANC outcomes | 2 weeks | Clinical documentation requirement |
| 9 | **Add audit logging to remaining high-risk services** — appointments, POS, drug-management, payment-gateway, tenants | 1 week | Coverage 40% → 55% |
| 10 | **Externalize hardcoded configuration** — cron schedules, magic numbers, retry counts into SystemSetting or .env | 1 week | Operational flexibility; tenant-specific tuning |
| 11 | **Add input validation to remaining ~30 DTOs** | 1 week | Defense in depth |

## P2 — Medium Priority (Quarterly)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 12 | **Achieve 70% test coverage** across all modules | 4-6 weeks | Engineering confidence; regression prevention |
| 13 | **Adopt formal FSM library** (xstate or custom) for all 12 complex workflows | 3-4 weeks | Declarative, visualizable, testable state machines |
| 14 | **Add comprehensive GL integration** for all modules (maternity, emergency, lab) | 2 weeks | Complete financial picture |
| 15 | **Build HMIS 105 / DHIS2 export** for Uganda Ministry of Health reporting | 2-3 weeks | Regulatory compliance |
| 16 | **Implement comprehensive API rate limiting** per-tenant | 1 week | Multi-tenant fairness; abuse prevention |
| 17 | **Add E2E integration tests** for critical patient journeys (OPD, ED, IPD) | 3 weeks | End-to-end confidence |
| 18 | **Build inventory valuation report** (FIFO/weighted average costing) | 1 week | Financial reporting requirement |

## P3 — Nice-to-Have (Backlog)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 19 | **Implement secrets rotation** mechanism for JWT_SECRET, LICENSE_SECRET_KEY | 1 week | Security hardening |
| 20 | **Add real-time dashboards** (WebSocket) for ED triage queue, bed board | 2 weeks | Operational efficiency |
| 21 | **Build patient self-service portal** — appointment booking, lab results, prescriptions | 3-4 weeks | Patient engagement |
| 22 | **Implement clinical decision support** — drug-diagnosis alerts, guideline prompts | 4 weeks | Clinical quality |
| 23 | **Add data analytics / BI layer** — trend analysis, predictive stock-outs | 4 weeks | Strategic planning |
| 24 | **Mobile app** (React Native / Flutter) for field workers, community health | 6-8 weeks | Rural healthcare reach |
| 25 | **Implement FHIR interoperability** for health information exchange | 4-6 weeks | Standards compliance |

---

## Appendix A — Database Migration Timeline

**Total migrations: 104** (from project inception to June 2026)

| Phase | Migration Range | Count | Key Changes |
|-------|----------------|-------|-------------|
| Foundation | 1700000000000–1713949185000 | 3 | Orders table, deployment indexes |
| Patient & Clinical | 1771276800000–1771500000000 | 3 | Duplicate detection, queue management |
| Authorization | 1773700000000–1773907700000 | 2 | Role inheritance, permission groups, performance indexes |
| Multi-Tenancy | 1774000000000–1774500500000 | 12 | tenant_id on all tables, HR entity fixes |
| Pricing & Procurement | 1774600000000–1775300000000 | 11 | Pricing engine, stock transfers, RLS |
| Security & Deployment | 1775400000000–1777700000000 | 10 | FK hardening, backup, account lockout, PII encryption |
| Operational Features | 1777800000000–1782700000000 | 12 | Doctor fees, POS compliance, finance approvals |
| Finance Audit Sprint | 1782900000000–1782900000011 | 12 | Finance constraints, audit logs, deployment reports |
| SaaS Revenue | 1782900000012–1782900000021 | 10 | Subscriptions, payments, webhooks, multi-org, approvals |
| Patient Safety | 1782900000022–1782900000026 | 5 | Allergies, critical results, vitals, triage, billing mode |
| Recent Fixes | 1782900000027–1782900000049 | 24 | Assets, SaaS billing P0/P1, quotations, contracts, onboarding, security audit, indexes |

---

## Appendix B — Key File Reference

| Category | Path | Description |
|----------|------|-------------|
| **App Entry** | `src/app.module.ts` | Root module with all imports |
| **Entities** | `src/database/entities/` | 192 TypeORM entities |
| **Migrations** | `src/database/migrations/` | 104 migrations |
| **Auth Decorators** | `src/modules/auth/decorators/` | 13 auth decorators |
| **Auth Guards** | `src/modules/auth/guards/` | 10 guards (JWT, roles, permissions, tenant, etc.) |
| **Audit Service** | `src/common/interceptors/audit-log.service.ts` | Central audit logging |
| **Tenant Middleware** | `src/common/middleware/tenant-context.middleware.ts` | Tenant resolution |
| **OPD** | `src/modules/encounters/` | Encounter lifecycle |
| **IPD** | `src/modules/ipd/` | Admissions, beds, wards |
| **Emergency** | `src/modules/emergency/` | ED cases, triage |
| **Pharmacy** | `src/modules/pharmacy/` | Sales, stock, expiry |
| **Prescriptions** | `src/modules/prescriptions/` | Rx workflow, controlled substances |
| **Lab** | `src/modules/lab/` | Samples, results, QC |
| **Radiology** | `src/modules/radiology/` | Imaging orders, reports |
| **Billing** | `src/modules/billing/` | Invoices, payments |
| **Insurance** | `src/modules/insurance/` | Claims, pre-auth |
| **Procurement** | `src/modules/procurement/` | PR, PO, GRN, three-way match |
| **HR** | `src/modules/hr/` | Employee lifecycle, payroll |
| **Inventory** | `src/modules/inventory/` | Stock ledger, movements |
| **Maternity** | `src/modules/maternity/` | ANC, labour, delivery, PNC, immunization |
| **Finance** | `src/modules/finance/` | GL, journal entries, reports |
| **SaaS Revenue** | `src/modules/saas-revenue/` | Subscriptions, billing, quotations |
| **Licensing** | `src/modules/licensing/` | HMAC-signed licenses |
| **Deployments** | `src/modules/deployments/` | Enterprise deployment management |

---

*Document generated on 27 June 2026. Based on codebase analysis of 192 entities, 94 modules, 177 services, and 104 database migrations.*
