# Glide HIMS — System Overview

## What Is Glide HIMS?

**Glide HIMS** (Hospital Information Management System) is a comprehensive, multi-tenant, on-premise hospital management platform built for healthcare facilities in Uganda and the East African region. It digitises the full patient care lifecycle — from registration through discharge — plus all supporting back-office functions (inventory, HR, finance, insurance).

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                      USERS / BROWSERS                       │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────┐
│              FRONTEND  (React + Vite + Nginx)               │
│   SPA served at port 80 · Proxies /api → backend:3000       │
└────────────────────────────┬────────────────────────────────┘
                             │ REST API
┌────────────────────────────▼────────────────────────────────┐
│              BACKEND  (NestJS + TypeORM)                     │
│   JWT Auth · RBAC · Multi-tenant · 60+ modules · Port 3000  │
├──────────┬──────────┬───────────────────────────────────────┤
│ Postgres │  Redis   │  Fingerprint Service (Python/SecuGen) │
│  DB:5432 │ Cache    │  Biometric enrollment & verification  │
└──────────┴──────────┴───────────────────────────────────────┘
```

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS | Single-page app for all user roles |
| **Backend** | NestJS (Node.js), TypeORM | REST API, business logic, 60+ domain modules |
| **Database** | PostgreSQL 16 | Primary data store, row-level security per tenant |
| **Cache** | Redis 7 (optional) | Session/query caching for production scale |
| **Biometrics** | Python + SecuGen SDK | Fingerprint capture & matching service |
| **Deployment** | Docker Compose, PM2, systemd | On-premise or containerised |

---

## Core Business Process Flows

### 1. Patient Journey — The Primary Flow

```
 ┌──────────┐   ┌─────────┐   ┌────────┐   ┌──────────────┐   ┌──────────────┐
 │REGISTER  │──▶│ TRIAGE  │──▶│ QUEUE  │──▶│ CONSULTATION │──▶│   ORDERS     │
 │Patient + │   │ Vitals  │   │Ticket  │   │ Doctor sees  │   │ Lab/Rx/Rad   │
 │Encounter │   │ capture │   │issued  │   │ patient      │   │ placed       │
 └──────────┘   └─────────┘   └────────┘   └──────────────┘   └──┬───┬───┬───┘
                                                                  │   │   │
                              ┌────────────────────────────────────┘   │   │
                              ▼                                       │   │
                        ┌───────────┐                                 │   │
                        │LABORATORY │                                 │   │
                        │Sample →   │                                 │   │
                        │Process →  │                                 │   │
                        │Result →   │                                 │   │
                        │Validate   │                                 │   │
                        └─────┬─────┘                                 │   │
                              │                    ┌──────────────────┘   │
                              │                    ▼                     │
                              │              ┌───────────┐               │
                              │              │ PHARMACY  │               │
                              │              │Dispense Rx│               │
                              │              │Track batch│               │
                              │              └─────┬─────┘               │
                              │                    │     ┌───────────────┘
                              │                    │     ▼
                              │                    │ ┌──────────┐
                              │                    │ │RADIOLOGY │
                              │                    │ │Image/Scan│
                              │                    │ └────┬─────┘
                              ▼                    ▼      ▼
                        ┌────────────────────────────────────┐
                        │     RETURN TO DOCTOR (review)      │
                        │  Doctor reviews results, adds Dx   │
                        └─────────────────┬──────────────────┘
                                          │
                              ┌───────────▼───────────┐
                              │       BILLING         │
                              │ Invoice generated     │
                              │ Cash / Insurance /    │
                              │ Corporate payment     │
                              └───────────┬───────────┘
                                          │
                    ┌─────────────────────┬┴─────────────────────┐
                    ▼                     ▼                      ▼
             ┌────────────┐      ┌──────────────┐       ┌──────────────┐
             │ DISCHARGE  │      │   ADMIT      │       │  FOLLOW-UP   │
             │ (OPD done) │      │   (IPD)      │       │  Scheduled   │
             └────────────┘      │ Ward→Bed     │       └──────────────┘
                                 │ Nursing notes│
                                 │ Med admin    │
                                 │ Bed transfer │
                                 └──────┬───────┘
                                        │
                                 ┌──────▼───────┐
                                 │   DISCHARGE  │
                                 │   Summary    │
                                 │   + Billing  │
                                 └──────────────┘
```

### Encounter Status State Machine

```
 REGISTERED → TRIAGE → WAITING → IN_CONSULTATION
                                       │
              ┌────────────────────────┬┼──────────────────┐
              ▼                        ▼▼                  ▼
        PENDING_LAB          PENDING_PHARMACY      PENDING_PAYMENT
              │                        │                   │
              └────────┬───────────────┘                   │
                       ▼                                   │
              RETURN_TO_DOCTOR ◄───────────────────────────┘
                       │
            ┌──────────┼──────────┐
            ▼          ▼          ▼
        COMPLETED   ADMITTED   DISCHARGED
```

### Queue Status State Machine

```
 PENDING_PAYMENT → WAITING → CALLED → IN_SERVICE → COMPLETED
                      ▲         │          │
                      │         ▼          ▼
                      │      NO_SHOW    TRANSFERRED → WAITING
                      │         │
                      └─────────┘
                      SKIPPED → WAITING
```

---

### 2. Insurance & Billing Flow

```
 Patient arrives with Insurance Card
         │
         ▼
 ┌────────────────┐    ┌─────────────────┐    ┌──────────────────┐
 │ Verify Policy  │───▶│ Pre-Authorization│───▶│ Services Rendered│
 │ (active, limit)│    │ (for costly Rx)  │    │ (during visit)   │
 └────────────────┘    └─────────────────┘    └────────┬─────────┘
                                                       │
                                                       ▼
                       ┌─────────────────┐    ┌──────────────────┐
                       │ Claim Filed     │◀───│ Invoice Created  │
                       │ to Insurer      │    │ (split: insurer  │
                       │ DRAFT→SUBMITTED │    │   + copay)       │
                       │ →APPROVED→PAID  │    └──────────────────┘
                       └─────────────────┘

 InsuranceProvider ──1:N──▶ InsurancePolicy ──1:N──▶ InsuranceClaim
                                  │                        │
                                  └──── Patient ◀──────────┘
```

### 3. Procurement & Inventory Flow

```
 ┌──────────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────────┐
 │ Purchase     │──▶│  RFQ     │──▶│  Purchase    │──▶│   Goods      │
 │ Request      │   │ (quotes) │   │  Order       │   │   Receipt    │
 └──────────────┘   └──────────┘   └──────────────┘   └──────┬───────┘
                                                              │
                                        ┌─────────────────────┘
                                        ▼
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │ Stock        │◀──│ Stock        │◀──│ Store        │
 │ Balance      │   │ Ledger       │   │ (warehouse)  │
 │ (aggregated) │   │ (movements)  │   └──────────────┘
 └──────────────┘   └──────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  ┌───────────┐    ┌──────────────┐   ┌──────────────┐
  │Dispensation│    │Stock Transfer│   │ Disposal     │
  │(Pharmacy) │    │(inter-store) │   │ (expired)    │
  └───────────┘    └──────────────┘   └──────────────┘
```

### 4. Laboratory Workflow

```
 Doctor places Lab Order
         │
         ▼
 ┌─────────────────┐   ┌────────────────┐   ┌──────────────┐
 │ Lab Sample      │──▶│ Processing     │──▶│ Results      │
 │ PENDING →       │   │ (technician    │   │ Entry →      │
 │ COLLECTED →     │   │  runs tests)   │   │ Validation → │
 │ RECEIVED        │   │                │   │ Release      │
 └─────────────────┘   └────────────────┘   └──────┬───────┘
                                                    │
                                                    ▼
                                            Doctor reviews
                                            results in
                                            encounter
```

### 5. Maternity Flow

```
 ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
 │ Antenatal        │──▶│ Labour Record    │──▶│ Delivery Outcome │
 │ Registration     │   │ (partograph)     │   │ (baby details)   │
 │ + ANC Visits     │   │                  │   │                  │
 └──────────────────┘   └──────────────────┘   └────────┬─────────┘
                                                        │
                                               ┌───────▼─────────┐
                                               │ Postnatal Visits │
                                               │ + Baby Wellness  │
                                               │   Checks         │
                                               └─────────────────┘
```

---

## Entity Relationship Diagram (ERD)

### Core Clinical Domain

```
┌───────────────┐         ┌──────────────────┐         ┌───────────────┐
│   TENANT      │◀────────│     FACILITY     │────────▶│  DEPARTMENT   │
│               │  1 : N  │                  │  1 : N  │               │
└───────────────┘         └────────┬─────────┘         └───────────────┘
                                   │ 1:N
                                   ▼
┌───────────────┐         ┌──────────────────┐
│    USER       │◀────────│   USER_ROLE      │────────▶┌───────────────┐
│ (staff/login) │  1 : N  │                  │  N : 1  │     ROLE      │
│               │         └──────────────────┘         │               │
│ staffCategory │                                      │  permissions  │
│ facility_id   │                                      └───────────────┘
│ department_id │
└───────┬───────┘
        │
        │ registers / treats
        ▼
┌───────────────┐   1:N    ┌──────────────────┐
│   PATIENT     │─────────▶│    ENCOUNTER     │
│               │          │                  │
│ mrn (unique)  │          │ visitNumber      │
│ fullName      │          │ type (OPD/IPD/   │
│ gender        │          │   Emergency/ANC) │
│ dateOfBirth   │          │ status           │
│ phone         │          │ payerType        │
│ bloodGroup    │          │ chiefComplaint   │
│ allergies     │          │                  │
│ nationalId    │          │ patient_id  ─────│──▶ Patient
│               │          │ facility_id ─────│──▶ Facility
│               │          │ department_id────│──▶ Department
│               │          │ provider_id ─────│──▶ User (doctor)
│               │          │ insurance_       │
│               │          │   policy_id ─────│──▶ InsurancePolicy
└───────┬───────┘          └────────┬─────────┘
        │                           │
        │                    ┌──────┼──────────┬────────────┬──────────┐
        │                    │      │          │            │          │
        │                    ▼      ▼          ▼            ▼          ▼
        │              ┌────────┐ ┌──────┐ ┌────────┐ ┌─────────┐ ┌────────┐
        │              │ VITAL  │ │ORDER │ │PRESCR- │ │CLINICAL │ │DIAGNOS-│
        │              │        │ │      │ │IPTION  │ │  NOTE   │ │IS (Enc)│
        │              │temp    │ │type: │ │        │ │         │ │icd10   │
        │              │pulse   │ │ lab  │ │items:  │ │soap/    │ │name    │
        │              │BP      │ │ rad  │ │ drug   │ │progress/│ │primary/│
        │              │SpO2    │ │ pharm│ │ dose   │ │hpi      │ │second. │
        │              │weight  │ │ proc │ │ freq   │ │         │ │        │
        │              │height  │ │      │ │ qty    │ │         │ │        │
        │              └────────┘ └──┬───┘ └───┬────┘ └─────────┘ └────────┘
        │                            │         │
        │                            │         │
        │                            ▼         ▼
        │                     ┌───────────┐  ┌────────────┐
        │                     │LAB_SAMPLE │  │DISPENSATION│
        │                     │           │  │batch/expiry│
        │                     │sampleNum  │  │qty/price   │
        │                     │status     │  └────────────┘
        │                     └─────┬─────┘
        │                           │ 1:N
        │                           ▼
        │                     ┌───────────┐
        │                     │LAB_RESULT │
        │                     │parameter  │
        │                     │value/unit │
        │                     │abnormal?  │
        │                     │validated? │
        │                     └───────────┘
        │
        │ 1:N
        ▼
┌───────────────┐
│INSURANCE_     │
│  POLICY       │
│               │
│ provider ─────│──▶ InsuranceProvider
│ policyNumber  │
│ memberNumber  │
│ coverageType  │
│ annualLimit   │
│ copay%        │
│ status        │
└───────┬───────┘
        │ 1:N
        ▼
┌───────────────┐
│INSURANCE_     │
│  CLAIM        │
│               │
│ claimNumber   │
│ status        │
│ totalClaimed  │
│ totalApproved │
│ totalPaid     │
└───────────────┘
```

### Billing & Finance Domain

```
┌──────────────────┐
│    ENCOUNTER     │
└────────┬─────────┘
         │ 1:N
         ▼
┌──────────────────┐    1:N    ┌──────────────────┐
│    INVOICE       │──────────▶│  INVOICE_ITEM    │
│                  │           │                  │
│ invoiceNumber    │           │ chargeType       │
│ status           │           │ (consult/lab/    │
│ subtotal         │           │  pharmacy/bed/   │
│ taxAmount        │           │  radiology)      │
│ totalAmount      │           │ quantity         │
│ amountPaid       │           │ unitPrice        │
│ balanceDue       │           │ insuranceCovered │
│ insuranceAmount  │           │ referenceType/Id │
│ paymentType      │           └──────────────────┘
│ (cash/insurance/ │
│  corporate)      │    1:N    ┌──────────────────┐
│                  │──────────▶│    PAYMENT       │
└──────────────────┘           │                  │
                               │ receiptNumber    │
                               │ amount           │
                               │ method (cash/    │
                               │  card/mobile/    │
                               │  insurance)      │
                               │ status           │
                               └──────────────────┘

┌──────────────────┐  1:N  ┌──────────────────┐
│ CHART_OF_ACCOUNT │◀──────│ JOURNAL_ENTRY    │
│ (GL accounts)    │       │ + JOURNAL_LINE   │
└──────────────────┘       └──────────────────┘
```

### Inventory & Supply Chain Domain

```
┌──────────────┐         ┌───────────────────┐         ┌──────────────┐
│  SUPPLIER    │◀────────│  PURCHASE_ORDER   │────────▶│   STORE      │
│              │  N:1    │  + PO_ITEMS       │         │ (warehouse)  │
│ name         │         │                   │         │              │
│ contact      │         │ DRAFT → APPROVED  │         └──────┬───────┘
│ rating       │         │ → SENT → RECEIVED │                │
└──────────────┘         └───────────────────┘                │
                                   │                          │
                                   ▼                          │
                         ┌───────────────────┐                │
                         │  GOODS_RECEIPT    │                │
                         └────────┬──────────┘                │
                                  │                           │
                                  ▼                           ▼
┌──────────────┐         ┌───────────────────┐       ┌──────────────┐
│ITEM          │◀────────│  STOCK_LEDGER     │──────▶│STOCK_BALANCE │
│              │         │  (every movement) │       │(aggregated)  │
│ code/name    │         │                   │       │              │
│ genericName  │         │ movementType:     │       │ totalQty     │
│ isDrug       │         │  purchase/sale/   │       │ reservedQty  │
│ sellingPrice │         │  transfer/return/ │       │ availableQty │
│ reorderLevel │         │  adjustment       │       │              │
│ category     │         │ batchNumber       │       │ per item     │
│ formulation  │         │ expiryDate        │       │ per facility │
│ strength     │         │ quantity (+/-)    │       │ per store    │
└──────────────┘         └───────────────────┘       └──────────────┘
                                  │
                         ┌────────┼────────────────┐
                         ▼        ▼                ▼
                  ┌──────────┐ ┌──────────────┐ ┌──────────┐
                  │BATCH_    │ │STOCK_        │ │DISPOSAL  │
                  │STOCK     │ │TRANSFER +    │ │(expired/ │
                  │          │ │TRANSFER_ITEM │ │ damaged) │
                  └──────────┘ └──────────────┘ └──────────┘
```

### Inpatient (IPD) Domain

```
┌───────────────┐   1:N   ┌──────────────┐   1:N   ┌────────────┐
│    WARD       │────────▶│     BED      │────────▶│ ADMISSION  │
│               │         │              │         │            │
│ name          │         │ bedNumber    │         │ patient    │
│ type          │         │ status       │         │ encounter  │
│ capacity      │         │ (available/  │         │ ward/bed   │
│               │         │  occupied)   │         │ status     │
└───────────────┘         └──────────────┘         └──────┬─────┘
                                                          │
                          ┌──────────────────┬────────────┼────────────┐
                          ▼                  ▼            ▼            ▼
                   ┌──────────────┐  ┌──────────────┐ ┌──────────┐ ┌──────────────┐
                   │NURSING_NOTE  │  │MED_ADMIN     │ │BED_      │ │DISCHARGE_    │
                   │              │  │(medication   │ │TRANSFER  │ │SUMMARY       │
                   │              │  │ given to pt) │ │          │ │              │
                   └──────────────┘  └──────────────┘ └──────────┘ └──────────────┘
```

### HR & Workforce Domain

```
┌──────────────┐
│    USER      │──── acts as employee record too
│              │
│ employeeNum  │     ┌────────────────┐   ┌────────────────┐
│ jobTitle     │────▶│ LEAVE_REQUEST  │   │ ATTENDANCE     │
│ staffCategory│     └────────────────┘   └────────────────┘
│ hireDate     │
│ basicSalary  │     ┌────────────────┐   ┌────────────────┐
│ allowances   │────▶│ PAYROLL_RUN    │──▶│ PAYSLIP        │
│ deductions   │     └────────────────┘   └────────────────┘
│ bankAccount  │
│ leaveBalance │     ┌────────────────┐   ┌────────────────┐
│              │────▶│ PERFORMANCE_   │   │ TRAINING_      │
│              │     │ APPRAISAL      │   │ ENROLLMENT     │
│              │     └────────────────┘   └────────────────┘
└──────────────┘
```

### Multi-Tenancy & Auth Domain

```
┌──────────────┐  1:N  ┌──────────────┐  1:N  ┌───────────────────┐
│   TENANT     │──────▶│   FACILITY   │──────▶│   FACILITY_MODULE │
│              │       │              │       │ (enabled features) │
│ name/slug    │       │ name/code    │       └───────────────────┘
│ subscription │       │ address      │
│ settings     │       │ type         │  1:N  ┌───────────────────┐
│              │       │              │──────▶│  FACILITY_CONFIG  │
└──────────────┘       └──────────────┘       │ (settings per     │
                              │                │  facility)        │
                              │ 1:N            └───────────────────┘
                              ▼
                       ┌──────────────┐
                       │     USER     │
                       │              │
                       │ username     │  N:M   ┌───────────────┐
                       │ email        │───────▶│     ROLE      │
                       │ mfaEnabled   │via     │               │
                       │ status       │UserRole│ permissions   │
                       └──────────────┘        └───────────────┘

                       Auth: JWT tokens + MFA (TOTP) + password policies
                       All tables carry tenant_id with row-level security
```

---

## Module Inventory (60+ backend modules)

| Domain | Modules |
|--------|---------|
| **Patient Care** | patients, encounters, vitals, clinical-notes, diagnoses, problems, treatment-plans, follow-ups |
| **Orders & Results** | orders, lab, lab-supplies, radiology, prescriptions, pharmacy |
| **Queue & Scheduling** | queue-management, appointments, schedules, doctor-duty |
| **Billing & Finance** | billing, invoices, pricing-engine, price-agreements, pos, finance, journal entries |
| **Insurance** | insurance, insurance claims, pre-authorization, invoice-matching |
| **Inpatient (IPD)** | ipd (admissions, beds, wards, bed-transfers, nursing notes, med admin), discharge |
| **Specialised Care** | emergency, maternity, surgery (theatre), chronic-care, referrals |
| **Inventory & Supply** | inventory, stores, stock-transfer, procurement, purchase orders, RFQs, goods-receipt, supplier management, supplier-returns, supplier-finance, vendor-contracts, vendor-ratings, disposal |
| **Drug Management** | drug-management, drug-classifications, controlled-substances, drug-labels, expiry-alerts |
| **HR & Workforce** | hr (attendance, leave, payroll, payslips, performance, training, recruitment, disciplinary), users, roles |
| **Platform** | auth, tenants, facilities, system-settings, feature-flags, notifications, in-app-notifications, analytics, audit-logs, sync, updates, licensing, support-access, biometrics, MDM |

---

## Key Design Decisions

1. **Multi-tenancy via `tenant_id`** — Every entity inherits a `tenant_id` column from `BaseEntity`. PostgreSQL row-level security (RLS) policies enforce data isolation.

2. **Encounter-centric model** — The `Encounter` is the central clinical record. Vitals, orders, prescriptions, diagnoses, clinical notes, invoices, and queue entries all reference an encounter.

3. **Unified User = Staff** — The `User` entity doubles as the HR/employee record (salary, leave, job title) to avoid duplicating identity.

4. **Inventory ledger pattern** — Stock is tracked via an append-only `StockLedger` (every movement in/out), with a materialised `StockBalance` for fast queries.

5. **State machines everywhere** — Encounter status, queue status, order status, prescription status, lab sample status, claim status, PO status — all follow explicit state machines with defined transitions.

6. **ICD-10 coded diagnoses** — The diagnosis catalog uses ICD-10 codes with support for notifiable diseases (malaria, TB, HIV).

7. **Insurance-first billing** — The billing pipeline splits charges into insurer-covered and patient-copay amounts, supports pre-authorization, and generates claims for submission.
