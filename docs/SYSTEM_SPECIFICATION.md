# Glide-HIMS System Specification

> Enterprise Hospital Management Information System / ERP for Uganda Healthcare  
> Version 0.1.0 · Multi-Tenant · Offline-Capable · Role-Based

---

## 1. System Overview

### 1.1 Purpose
Glide-HIMS is a comprehensive healthcare management platform designed for Ugandan hospitals and clinics. It covers the full patient journey from registration through discharge, with integrated billing, pharmacy, laboratory, HR, and financial management.

### 1.2 Architecture Type
- **Pattern**: Monorepo, Client-Server SPA + REST API
- **Backend**: NestJS 10 (TypeScript) — modular, layered architecture
- **Frontend**: React 19 + Vite 5 (TypeScript) — component-based SPA
- **Database**: PostgreSQL 14+ with TypeORM 0.3
- **Real-time**: Socket.io for notifications and events
- **Offline**: Dexie.js (IndexedDB) with sync queue

### 1.3 Deployment
| Component | Technology | Port |
|-----------|-----------|------|
| Backend API | NestJS via PM2 | 3000 |
| Frontend SPA | Vite preview via PM2 | 5173 |
| Database | PostgreSQL 14+ | 5432 |
| Reverse Proxy | Nginx (HTTPS termination) | 80/443 |
| Process Manager | PM2 or systemd | — |
| Containerization | Docker Compose (dev + prod) | — |

---

## 2. Functional Modules

### 2.1 Module Inventory (67 Backend Modules)

| Phase | Module | Description |
|-------|--------|-------------|
| **Core** | Auth | JWT login, refresh, MFA, password management |
| | Users | User CRUD, profile management, staff details |
| | Tenants | Multi-tenant organization management |
| | Facilities | Facility hierarchy, config, modules |
| | Roles | RBAC with inheritance, permission groups |
| | Setup | First-run wizard, system initialization |
| | SystemSettings | Global/tenant configuration |
| **Phase 1** | Patients | Registration, MRN generation, duplicate detection, documents |
| | Encounters | OPD/IPD/Emergency visits, status machine |
| | Vitals | Temperature, BP, pulse, O2, BMI, glucose, pain |
| | ClinicalNotes | SOAP notes per encounter |
| | Prescriptions | Rx creation, items, dispensation tracking |
| | Billing | Invoices, payments, receipts, insurance billing |
| | Inventory | Items, stock balances, ledger, batch tracking |
| | Orders | Lab/radiology/pharmacy/procedure orders |
| **Phase 2** | IPD | Admissions, bed management, ward management |
| **Phase 3** | Lab | Tests, samples, results, QC, reagent tracking |
| | Emergency | Triage, emergency cases, severity classification |
| **Phase 4** | Surgery | Theatre management, cases, consumables |
| **Phase 5** | Maternity | Antenatal, labour, delivery, postnatal, immunization |
| **Phase 6** | HR | Employees, attendance, shifts, rosters, payroll, leave |
| **Phase 7** | Finance | Chart of accounts, journal entries, budgets, bank reconciliation |
| **Phase 8** | Radiology | Imaging orders, modalities, results |
| **Phase 9** | Insurance | Providers, policies, pre-auth, claims |
| **Phase 10** | Analytics | Dashboard KPIs, reports |
| **Phase 11** | Membership | Hospital scheme enrollment |
| | Services | Service catalog and categories |
| | Stores | Multi-store inventory, transfers |
| | Pharmacy | Queue, dispensing, stock, pricing, controlled substances |
| **Phase 12** | Suppliers | Supplier management, credit, payments |
| | Procurement | Purchase requests, purchase orders, goods receipt |
| **Phase 13** | Sync | Offline data synchronization, conflict resolution |
| **Phase 14** | Diagnoses | ICD-10 master data |
| | Problems | Patient problem list |
| | Providers | Clinical provider registry |
| | Cache | Application-level caching |
| | MDM | Master data management and versioning |
| **Phase 15** | Assets | Fixed asset tracking |
| | LabSupplies | Reagent and equipment management |
| | DrugManagement | Drug classifications, label templates, sync |
| | SupplierFinance | Credit notes, supplier payments |
| **Phase 16** | Referrals | Inter-facility/department referrals |
| | TreatmentPlans | Patient treatment planning |
| | FollowUps | Follow-up scheduling and tracking |
| | Discharge | Discharge summaries |
| | QueueManagement | Token system, multi-service queuing |
| | DoctorDuty | Doctor schedule and duty management |
| **Phase 17** | Disposal | Expired/damaged stock disposal |
| | SupplierReturns | Return to supplier workflow |
| **Phase 18** | RFQ | Request for quotation workflow |
| | VendorContracts | Vendor contract management |
| | VendorRatings | Supplier performance scoring |
| | PriceAgreements | Negotiated pricing |
| | InvoiceMatching | 3-way match (PO, receipt, invoice) |
| | ItemClassifications | Category/subcategory/brand/formulation/unit |
| **Phase 19** | Notifications | Email/SMS notification engine |
| | ChronicCare | Chronic disease management protocols |
| **Phase 20** | Integrations | openFDA, SMS gateways, LOINC codes |
| **Phase 21** | PricingEngine | Dynamic pricing rules |
| **Phase 22** | Adherence | Medication adherence tracking |
| **Cross-cutting** | Appointments | Scheduling, doctor calendars |
| | Biometrics | Fingerprint verification (SecuGen) |
| | InAppNotifications | WebSocket real-time notifications |
| | ScheduledTasks | Cron: expiry checks, cleanup, reminders |
| | Health | API health check endpoint |

### 2.2 Key Workflows

#### Patient Registration → Treatment → Discharge
```
1. Registration: Patient → MRN generation → Duplicate check → Queue token
2. Triage: Nurse records vitals → Priority assignment
3. Consultation: Doctor reviews → SOAP notes → Diagnosis → Orders + Rx
4. Diagnostics: Lab samples → Processing → Results → Validation → Release
5. Pharmacy: Rx queue → Verify → Pick batches → Counsel → Dispense
6. Billing: Invoice generated → Insurance pre-auth → Payment collection
7. If admitted: Ward → Bed → Nursing notes → Med administration
8. Discharge: Summary → Follow-up plan → Final bill → Receipt
```

#### Procurement Cycle
```
1. Purchase Request → Approval
2. RFQ → Vendor Quotations → Quotation Approval
3. Purchase Order → Supplier → Goods Receipt
4. Invoice Matching (3-way: PO + Receipt + Invoice)
5. Supplier Payment → Credit Note (if applicable)
```

#### Maternity Pathway
```
1. Antenatal Registration → Antenatal Visits (ANC 1-8+)
2. Labour Record → Delivery Outcome(s) → Baby Wellness Checks
3. Postnatal Visits → Immunization Schedule
```

---

## 3. Non-Functional Specifications

### 3.1 Security

| Feature | Implementation |
|---------|---------------|
| **Authentication** | JWT with access (short-lived) + refresh tokens |
| **MFA** | TOTP-based (mfa_secret on User entity) |
| **Password Policy** | Configurable via PasswordPolicy entity |
| **Rate Limiting** | Global: 100 req/60s (Throttler) · Login: 5 attempts/15min |
| **Authorization** | 5-layer RBAC (roles, permissions, groups, modules, ownership) |
| **HTTP Security** | Helmet (HSTS, X-Frame, X-XSS, nosniff) |
| **HTTPS** | Self-signed SSL or Nginx termination (TLS 1.2/1.3) |
| **Input Validation** | class-validator whitelist + forbidNonWhitelisted |
| **SQL Injection** | Parameterized queries, table name whitelist (sync) |
| **Audit Trail** | AuditLogInterceptor on all mutations |
| **Soft Deletes** | All entities use deletedAt (no data destruction) |
| **Session Timeout** | 30 min inactivity (frontend) with 5 min warning |
| **Data Wipe** | sessionStorage + IndexedDB cleared on logout |
| **Account Lockout** | 5 failed attempts → 15 min lockout |

### 3.2 Multi-Tenancy

| Layer | Mechanism |
|-------|-----------|
| **Data Isolation** | `tenant_id` column on all entities (BaseEntity) with index |
| **JWT Payload** | `tenantId` embedded in token |
| **Request Interception** | TenantInterceptor extracts from JWT → `req.tenantId` |
| **Query Filtering** | Services add `WHERE tenant_id = :tenantId` |
| **Auto-Population** | TenantSubscriber sets tenant_id on INSERT |
| **Frontend Header** | `X-Tenant-Id` sent on every API request |
| **Facility Scoping** | `X-Facility-Id` for multi-facility operations |

### 3.3 Database

| Property | Value |
|----------|-------|
| **Engine** | PostgreSQL 14+ |
| **ORM** | TypeORM 0.3.19 |
| **Entities** | 132 (all extend BaseEntity) |
| **Migrations** | 5 explicit (synchronize: false, migrationsRun: false) |
| **Schema Changes** | Require `npx typeorm migration:run -d dist/config/database.config.js` |
| **Pool Size** | 20 max, 5 min, 30s idle timeout, 5s connection timeout |
| **Soft Deletes** | `deleted_at` column with `@DeleteDateColumn` |
| **Primary Keys** | UUID v4 (generated by PostgreSQL) |
| **Indexing** | tenant_id (all), unique constraints, composite indexes |
| **Seed Data** | 8 scripts (clinical, lab, insurance, employees, theatres, etc.) |
| **Backup** | pg_dump with daily (7d) / weekly (30d) / manual (90d) retention |

### 3.4 Performance

| Feature | Implementation |
|---------|---------------|
| **Code Splitting** | 100+ React.lazy routes reduce initial bundle |
| **Server-Side Caching** | CacheModule (application-level) |
| **Client Caching** | React Query with configurable stale times |
| **Connection Pooling** | PostgreSQL pool (20 max connections) |
| **Rate Limiting** | Per-IP throttling at Nginx (10r/s) and NestJS (100/60s) |
| **Gzip Compression** | Nginx gzip level 6 on text assets |
| **Lazy Relations** | Encounter→Patient NOT eager (explicit join to avoid N+1) |

### 3.5 Offline Capability

| Feature | Implementation |
|---------|---------------|
| **Storage** | Dexie.js (IndexedDB) with 14 entity tables |
| **Sync Queue** | Pending operations queued with status tracking |
| **Sync Protocol** | Phase 1: PUSH local → Phase 2: PULL remote |
| **Conflict Resolution** | Side-by-side comparison, manual or auto-merge |
| **Clearance** | `clearAllData()` wipes all 18 tables on logout |
| **Status Tracking** | `useSyncStatus()`, `usePendingCount()`, `useOnlineStatus()` hooks |

### 3.6 Real-Time

| Feature | Implementation |
|---------|---------------|
| **Technology** | Socket.io (WebSocket with fallback) |
| **Server** | @nestjs/websockets + @nestjs/platform-socket.io |
| **Client** | socket.io-client with useNotificationSocket hook |
| **Use Cases** | In-app notifications, queue updates, lab result alerts |
| **Persistence** | InAppNotification entity (target_user_id, read status) |

---

## 4. API Specification

### 4.1 API Design
- **Base URL**: `/api/v1`
- **Format**: JSON (application/json)
- **Authentication**: Bearer JWT token
- **Response Envelope**: `{ statusCode, data, meta?, timestamp }`
- **Error Format**: `{ statusCode, message, details?, error?, timestamp }`
- **Pagination**: `?page=1&limit=25` → `meta: { total, page, limit, totalPages }`
- **Documentation**: Swagger UI at `/api/docs`
- **CORS**: Configurable origins, credentials enabled

### 4.2 Core Endpoints

| Module | Endpoints | Auth |
|--------|-----------|------|
| **Auth** | POST /login, /refresh, /change-password, /mfa/* · GET /profile, /me | @Public for login/refresh |
| **Users** | CRUD + status/role management | @Auth + permissions |
| **Patients** | CRUD + search + duplicate detection + documents | @Auth + patients.* |
| **Encounters** | CRUD + status transitions + clinical summary | @Auth + encounters.* |
| **Vitals** | Record + history per encounter | @Auth + vitals.* |
| **Prescriptions** | Create + dispense workflow + signature | @Auth + prescriptions.* |
| **Orders** | Create lab/radiology + assign + complete | @Auth + orders.* |
| **Billing** | Invoices + payments + receipts + insurance | @Auth + billing.* |
| **Inventory** | Items + stock receive/adjust/transfer | @Auth + inventory.* |
| **Lab** | Samples + results + QC + validation chain | @Auth + lab.* |
| **Pharmacy** | Queue + dispense + stock + sales | @Auth + pharmacy.* |
| **HR** | Employees + payroll + leave + attendance | @Auth + hr.* |
| **Finance** | GL + journals + budgets + reconciliation | @Auth + finance.* |
| **Health** | GET /health (system status) | @Public |

### 4.3 Request Headers

| Header | Purpose | Required |
|--------|---------|----------|
| `Authorization` | Bearer JWT token | Yes (except @Public) |
| `X-Facility-Id` | Active facility context | Recommended |
| `X-Tenant-Id` | Tenant isolation | Recommended |
| `X-Request-Id` | Correlation/tracing ID | Auto-generated |
| `Content-Type` | application/json | Yes (for POST/PUT) |

---

## 5. Data Model Summary

### 5.1 Entity Count by Domain

| Domain | Entities | Key Tables |
|--------|----------|------------|
| **Core Identity** | 12 | tenants, facilities, users, roles, permissions, user_roles, departments |
| **Clinical** | 18 | patients, encounters, vitals, clinical_notes, diagnoses, prescriptions, orders |
| **Laboratory** | 6 | lab_tests, lab_samples, lab_results, lab_equipment, lab_reagents, lab_qc |
| **Pharmacy** | 8 | prescription_items, dispensations, pharmacy_sales, controlled_substance_logs, drug_classifications |
| **IPD** | 7 | admissions, wards, beds, bed_transfers, nursing_notes, medication_administrations, discharge_summaries |
| **Billing/Finance** | 14 | invoices, invoice_items, payments, chart_of_accounts, journal_entries, fiscal_periods, budgets |
| **Insurance** | 7 | insurance_providers, insurance_policies, insurance_claims, claim_items, pre_authorizations |
| **Inventory** | 10 | items, stock_balances, stock_ledger, batch_stock_balances, expiry_alerts, stores, stock_transfers |
| **Procurement** | 12 | suppliers, purchase_orders, purchase_requests, rfqs, vendor_contracts, price_agreements |
| **HR** | 12 | employees, payroll_runs, payslips, leave_requests, attendance_records, shift_definitions, staff_rosters |
| **Maternity** | 7 | antenatal_registrations, antenatal_visits, labour_records, delivery_outcomes, postnatal_visits |
| **Surgery/Emergency** | 4 | surgery_cases, surgery_consumables, emergency_cases, theatres |
| **Radiology** | 3 | imaging_orders, imaging_results, imaging_modalities |
| **System** | 12 | audit_logs, sync_queue, sync_conflicts, system_settings, facility_configs, in_app_notifications |
| **Total** | **132** | |

### 5.2 BaseEntity Contract (All Tables)

```typescript
abstract class BaseEntity {
  id: UUID                    // PK, auto-generated
  tenantId?: UUID             // Multi-tenant isolation (indexed)
  createdAt: Timestamp        // Auto-set on creation
  updatedAt: Timestamp        // Auto-set on update
  deletedAt?: Timestamp       // Soft delete (null = active)
}
```

### 5.3 Key Enumerations

| Entity | Enum | Values |
|--------|------|--------|
| Encounter | Type | OPD, IPD, EMERGENCY |
| Encounter | Status | REGISTERED, WAITING, TRIAGE, IN_CONSULTATION, LAB_PENDING, PHARMACY_PENDING, COMPLETED, DISCHARGED, CANCELLED, etc. |
| Prescription | Status | PENDING, DISPENSING, PARTIALLY_DISPENSED, DISPENSED, COLLECTED, CANCELLED |
| Invoice | Status | PENDING, PARTIALLY_PAID, PAID, CANCELLED, REFUNDED |
| Order | Type | LAB, RADIOLOGY, PHARMACY, PROCEDURE |
| Order | Priority | ROUTINE, URGENT, STAT, ASAP |
| Inventory | MovementType | PURCHASE, SALE, ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT, RETURN, EXPIRED, DAMAGED |
| Admission | Status | ADMITTED, DISCHARGED, TRANSFERRED, DECEASED |

---

## 6. Frontend Specification

### 6.1 Architecture

| Layer | Technology | Count |
|-------|-----------|-------|
| **Pages** | React lazy-loaded components | 338 files |
| **Services** | Axios API clients | 55 files |
| **Components** | Shared UI components | 26 files |
| **Stores** | Zustand state management | 3 stores |
| **Hooks** | Custom React hooks | 3 hooks |
| **Lib** | Utilities (print, sync, config) | 11 files |

### 6.2 Route Protection

```
Public Routes: /login, /setup, /register
Protected Routes: /* (requires JWT)
  └── Role Guards: DoctorRoute, NurseRoute, PharmacistRoute,
      LabTechRoute, ReceptionistRoute, CashierRoute,
      StoreKeeperRoute, AccountantRoute, AdminRoute,
      FinanceRoute, HRRoute, BillingRoute, RadiologyRoute
  └── Permission Gates: hasPermission(), hasAnyPermission()
  └── Module Access: hasModuleAccess() via /auth/me
  └── Super Admin: bypasses all checks
```

### 6.3 State Persistence

| Store | Persistence | Key |
|-------|-------------|-----|
| Auth (user, tokens) | localStorage | `glide-hims-auth` |
| Active Facility | sessionStorage | `glide_active_facility_id` |
| Active Tenant | sessionStorage | `glide_active_tenant_id` |
| Offline Data | IndexedDB (Dexie) | `GlideHIMSOfflineDB` |
| Server State | React Query (memory) | — |

### 6.4 UI Framework

| Component | Library |
|-----------|---------|
| Styling | Tailwind CSS 4.1 |
| Icons | Lucide React |
| Charts | Recharts 3.7 |
| Forms | React Hook Form + Zod |
| Toasts | Sonner 2.0 |
| PDF Generation | jsPDF + jspdf-autotable |
| Barcodes | jsbarcode + qrcode.react |
| Date Handling | date-fns 4.1 |

---

## 7. Infrastructure Specification

### 7.1 Development Environment (Docker Compose)

| Service | Image | Purpose |
|---------|-------|---------|
| PostgreSQL | postgres:16-alpine | Primary database |
| Redis | redis:7-alpine | Caching (AOF persistence) |
| MinIO | minio/minio | S3-compatible object storage |
| RabbitMQ | rabbitmq:3-management-alpine | Message queue |
| pgAdmin | dpage/pgadmin4 | Database UI |

### 7.2 Production Environment

| Component | Configuration |
|-----------|--------------|
| **Nginx** | HTTPS (TLS 1.2/1.3), rate limiting (10r/s), gzip, security headers, WebSocket proxy |
| **PM2** | Auto-restart, max 10 restarts, production env |
| **Backup** | pg_dump cron: daily 2 AM (7d), weekly Sunday 3 AM (30d) |
| **Logging** | NestJS Logger (structured), Nginx access/error logs |
| **Health Check** | GET /api/v1/health |

### 7.3 Scheduled Tasks

| Schedule | Task | Description |
|----------|------|-------------|
| Daily 7 AM | Medication Expiry Check | Scan batches expiring in 30 days, create ExpiryAlerts |
| Weekly Sun 2 AM | Sync Conflict Cleanup | Remove orphaned sync records |
| Daily 6 AM | Appointment Reminders | Notify patients with appointments in next 24h |

---

## 8. Integration Points

| Integration | Technology | Purpose |
|-------------|-----------|---------|
| **openFDA** | REST API | Drug interaction checks, adverse event lookup |
| **SMS Gateway** | Configurable provider | Patient notifications, appointment reminders |
| **LOINC** | Code mapping | Lab test standardization |
| **SecuGen** | USB SDK | Fingerprint biometric verification |
| **Socket.io** | WebSocket | Real-time notifications and queue updates |
| **IndexedDB** | Dexie.js | Offline data storage and sync |

---

## 9. Compliance & Standards

| Standard | Implementation |
|----------|---------------|
| **ICD-10** | Diagnosis coding (ICD10Code entity) |
| **LOINC** | Lab test codes (via Integrations module) |
| **HMIS** | Uganda MoH reporting compatibility |
| **Data Privacy** | Tenant isolation, audit trails, soft deletes, session wipe |
| **Financial** | Double-entry bookkeeping (Journal Entries), fiscal periods |
| **Pharmacy** | Controlled substance logging, batch tracking, expiry management |

---

## 10. System Requirements

### Minimum Server Requirements
| Resource | Specification |
|----------|--------------|
| **CPU** | 2 cores |
| **RAM** | 4 GB |
| **Storage** | 50 GB SSD |
| **OS** | Ubuntu 20.04+ / Debian 11+ |
| **Node.js** | ≥ 20.0.0 |
| **pnpm** | ≥ 8.0.0 |
| **PostgreSQL** | ≥ 14 |

### Client Requirements
| Requirement | Specification |
|-------------|--------------|
| **Browser** | Chrome 90+, Edge 90+, Firefox 88+, Safari 14+ |
| **Network** | Works offline (sync on reconnect) |
| **Screen** | Responsive (desktop-optimized) |
