
╔═════════════════════════════════════════════════════════════════════════════════╗
║              GLIDE-HIMS NESTJS BACKEND - COMPREHENSIVE ANALYSIS                ║
╚═════════════════════════════════════════════════════════════════════════════════╝

## 1. APPLICATION BOOTSTRAP (main.ts)

**Init Order:**
1. Create NestJS app → Validate ENV vars
2. Load Helmet (security headers) + SSL/HTTPS if certs exist
3. correlationIdMiddleware (X-Request-Id for tracing)
4. GlobalJwtAuthGuard (requires JWT on ALL routes except @Public())
5. Security interceptors: SecurityAuditInterceptor → TenantInterceptor
6. ResponseTransformInterceptor (wraps responses in standard envelope)
7. GlobalExceptionFilter (catches all errors)
8. ValidationPipe (DTO validation, whitelist)
9. CORS enabled for http://localhost:5173
10. Swagger UI at /api/docs
11. Listen port 3000

**Key ENV Variables Required:**
- DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME
- JWT_SECRET (32+ chars in production), JWT_REFRESH_SECRET
- JWT_EXPIRES_IN (default 15m), JWT_REFRESH_EXPIRES_IN (default 7d)
- NODE_ENV, CORS_ORIGINS, API_PREFIX, PORT

---

## 2. AUTHENTICATION FLOW (Login)

**POST /api/v1/auth/login**

Input:
```
{
  "username": "doctor@clinic.com",
  "password": "SecurePass123",
  "tenantId": "tenant-uuid",      // optional, for multi-tenant
  "mfaCode": "123456"             // optional, if MFA enabled
}
```

Process:
1. Rate limiting check (10 req/s, lock after 5 failures for 15 min)
2. Validate username/email (tenant-scoped search)
3. Compare password using bcrypt.compare()
4. Check account status (must be 'active')
5. MFA verification if enabled (speakeasy TOTP)
6. Load user roles + facility assignments
7. **Resolve permissions with inheritance chain** (parentRoleId relationships)
8. Load direct user permissions (overrides role perms)
9. Update last_login_at timestamp
10. Create JWT payload (includes sub, username, email, tenantId, roles, facilityId)
11. Sign accessToken (15m) + refreshToken (7d) using HS256
12. Return user object + tokens

**JWT Payload Structure:**
```
{
  "sub": "user-uuid",
  "username": "doctor@...",
  "email": "doctor@...",
  "tenantId": "tenant-uuid",          // CRITICAL for multi-tenancy
  "roles": ["Doctor", "Consultant"],
  "facilityId": "facility-uuid"
}
```

**Important:** Permissions NOT in JWT (too large)
→ Frontend calls GET /auth/me to fetch full permissions list

**Guards Used:**
- GlobalJwtAuthGuard (JWT validation)
- RateLimitGuard (per-IP login attempts)
- RolesGuard (@Roles decorator)
- PermissionsGuard (@Permissions decorator)
- FacilityGuard (@FacilityAccess decorator)
- OwnershipGuard (@ResourceOwnership decorator)
- EmployeeRequiredGuard (user must link to employee)

---

## 3. GET /auth/me (Current User Info)

**Response:**
```
{
  "id": "user-uuid",
  "username": "doctor@...",
  "fullName": "Dr. John Smith",
  "email": "doctor@...",
  "roles": ["Doctor", "Consultant"],
  "permissions": [
    "vitals.read", "vitals.create", "vitals.update",
    "patients.read", "patients.update",
    "prescriptions.create", "prescriptions.read",
    ...
  ],
  "accessibleModules": [
    "patients", "vitals", "prescriptions", "lab", ...
  ],
  "facilityId": "facility-uuid",
  "tenantId": "tenant-uuid"
}
```

Used by frontend to:
- Populate user profile
- Show/hide navigation items
- Determine sidebar menu visibility
- Control feature access

---

## 4. REQUEST LIFECYCLE (Per Request)

Pipeline (sequential order):

1. **correlationIdMiddleware** → Add X-Request-Id (UUID)
2. **GlobalJwtAuthGuard** → Validate JWT (unless @Public())
3. **Route-Specific Guards** → @Roles, @Permissions, @FacilityAccess, etc.
4. **SecurityAuditInterceptor (BEFORE)** → Log request start
5. **TenantInterceptor (BEFORE)** → Extract tenantId from JWT
6. **ValidationPipe** → Transform DTO, validate decorators
7. **CONTROLLER METHOD** → Business logic
8. **SERVICE LAYER** → Database queries (TypeORM)
9. **ResponseTransformInterceptor (AFTER)** → Wrap in envelope
10. **AuditLogInterceptor (AFTER)** → Log mutations to audit_log
11. **GlobalExceptionFilter** → Catch errors, standardize response

**Interceptors:**
- SecurityAuditInterceptor: Logs sensitive operations for compliance
- TenantInterceptor: Propagates tenantId through request
- ResponseTransformInterceptor: Adds statusCode, data, meta, timestamp
- AuditLogInterceptor: Records CREATE/UPDATE/DELETE to audit_log (async)

---

## 5. DATABASE ARCHITECTURE

**Configuration:**
- Type: PostgreSQL
- ORM: TypeORM (no auto-sync, migrations only!)
- Connection pooling: Node-Postgres

**Key Entities:**

BaseEntity (all extend this):
├─ id (UUID PK)
├─ tenantId (UUID, indexed, nullable)
├─ createdAt (auto-set on INSERT)
├─ updatedAt (auto-set on UPDATE)
└─ deletedAt (NULL = active, soft delete)

users
├─ username, email (UNIQUE per tenant)
├─ passwordHash (bcrypt SHA512)
├─ mfaSecret, mfaEnabled (TOTP 2FA)
├─ isSystemAdmin (can log into any tenant)
├─ status, failedLoginAttempts, lockedUntil
├─ facilityId (default facility)
└─ user_roles (1-to-Many, facility-scoped)

roles
├─ name, description
├─ parentRoleId (inheritance - "Senior Doctor" extends "Doctor")
├─ role_permissions (Many-to-Many)
└─ permission_groups (Many-to-Many)

permissions
├─ code (e.g., vitals.read, patients.create)
├─ name, description
└─ Used by role_permissions + user_permissions

facilities
├─ name, code, tenantId
├─ address, contactDetails
└─ Wards, Departments, Beds, Theatres (1-to-Many)

patients
├─ patientNumber (UNIQUE per facility)
├─ demographics, insurance, contact info
├─ facilityId, tenantId
└─ (100+ clinical fields)

encounters
├─ patientId, status, type (OPD/IPD/Emergency/Surgery)
├─ priority, providers[], department
├─ facilityId, tenantId

vitals
├─ encounterId, patientId
├─ temperature, heartRate, bloodPressure, etc.
├─ createdBy (userId)
└─ facilityId, tenantId

prescriptions
├─ encounterId, patientId
├─ items (JSON: [{drugId, qty, frequency, duration}, ...])
├─ prescribedBy, status (draft/active/dispensed)
└─ facilityId, tenantId

audit_log (immutable)
├─ userId, action (CREATE/UPDATE/DELETE)
├─ entityType, entityId, newValue (JSON)
├─ ipAddress, userAgent, timestamp

**Migrations:**
- Manual control via typeorm CLI (NEVER auto-sync)
- Located: src/database/migrations/
- Reversible and testable

---

## 6. MULTI-TENANCY ISOLATION

**Layer 1: JWT Payload**
- Every token contains tenantId
- System admin users can log into different tenants

**Layer 2: Request Context**
- GlobalJwtAuthGuard extracts tenantId
- TenantInterceptor propagates via request.tenantId

**Layer 3: Database Schema**
- EVERY entity has tenantId column
- UNIQUE constraints include tenantId: UNIQUE(email, tenant_id)
- All queries filter: WHERE tenant_id = :tenantId AND deleted_at IS NULL

**Layer 4: Service Layer (CRITICAL)**
- Services MUST filter by tenantId on all queries
- Services MUST set tenantId on all INSERT/UPDATE
- TypeORM Subscribers auto-populate tenantId

**Layer 5: Future - PostgreSQL RLS**
- Set session variable: SET app.tenant_id = $1
- Database enforces isolation at row level
- Defense-in-depth if service bug

**Multi-Facility Within Tenant:**
- Tenant has multiple facilities
- User roles can be facility-scoped
- Example: Dr. Smith is "Doctor" at Clinic A, "Consultant" at Hospital B
- Frontend sends X-Facility-Id header
- Services filter by BOTH tenant_id AND facility_id

---

## 7. MODULE STRUCTURE (60+ modules)

Core (1-10):
- AuthModule, UsersModule, TenantsModule, FacilitiesModule, RolesModule
- PatientsModule, EncountersModule, VitalsModule, ClinicalNotesModule
- PrescriptionsModule, BillingModule, InventoryModule, OrdersModule

Clinical (11-20):
- IpdModule (ward mgmt), LabModule, EmergencyModule, SurgeryModule
- MaternityModule, HrModule, FinanceModule, RadiologyModule
- InsuranceModule, AnalyticsModule

Advanced (21-30):
- PharmacyModule, ProcurementModule, SyncModule, DrugManagementModule
- ReferralsModule, TreatmentPlansModule, DischargeModule, AppointmentsModule
- NotificationsModule, ChronicCareModule, IntegrationsModule, PricingEngineModule
- BiometricsModule, AdherenceModule, SetupModule, SystemSettingsModule

Each module independently handles:
- Controllers (HTTP endpoints)
- Services (business logic)
- Entities (TypeORM models)
- DTOs (validation)
- Guards/Decorators
- Repositories (@InjectRepository)

---

## 8. SCHEDULED TASKS (Cron Jobs)

**ScheduleModule Integration:**
Uses @Cron() and @Interval() decorators

**Jobs:**

1. **CHECK-MEDICATION-EXPIRY**
   - Time: 0 7 * * * (7:00 AM UTC daily)
   - Action: Find batches expiring within 30 days
   - Status: ACTIVE if ≤7 days (urgent!), NEAR_EXPIRY if >7 days
   - Creates ExpiryAlert records

2. **CLEANUP-OLD-SYNC-RECORDS**
   - Time: 0 2 * * 0 (2:00 AM UTC every Sunday)
   - Action: DELETE sync conflicts resolved 30+ days ago
   - Keeps database lean

3. **DAILY-HEALTH-SUMMARY**
   - Time: 0 6 * * * (6:00 AM UTC daily)
   - Action: Log appointment count + active alerts

All wrapped in try-catch, errors logged but don't crash app.

---

## 9. NGINX REVERSE PROXY

```
CLIENT
  ↓
NGINX (443)
├─ HTTP 80 → HTTPS 301 redirect
├─ SSL/TLS termination (TLSv1.2+, AES-256)
├─ Security headers: HSTS, X-Frame-Options, CSP (partial)
├─ Rate limiting: 10 req/s, burst 20
├─ Gzip compression (level 6)
│
├─ Routing:
│  ├─ /api/* → http://backend:3000/api/* (API proxy)
│  ├─ /socket.io/* → http://backend:3000 (WebSocket)
│  ├─ / → /usr/share/nginx/html/index.html (SPA)
│  └─ /health → 200 OK (health check)
│
└─ Proxy headers added:
   ├─ X-Real-IP
   ├─ X-Forwarded-For
   └─ X-Forwarded-Proto (https)
```

---

## 10. STANDARD API RESPONSE ENVELOPE

**Success (200/201):**
```json
{
  "statusCode": 200,
  "data": { /* actual payload */ },
  "timestamp": "2025-03-16T12:34:56.789Z"
}
```

**Paginated (200):**
```json
{
  "statusCode": 200,
  "data": [ /* array */ ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasMore": true
  },
  "timestamp": "..."
}
```

**Validation Error (400):**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    { "field": "temperature", "errors": ["must not be less than 35"] }
  ],
  "path": "/api/v1/vitals",
  "timestamp": "..."
}
```

**Auth Error (401):**
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Authentication required",
  "path": "...",
  "timestamp": "..."
}
```

**Permission Error (403):**
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Insufficient permissions",
  "path": "...",
  "timestamp": "..."
}
```

**Server Error (500):**
```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "path": "...",
  "timestamp": "..."
}
// Full stack trace logged server-side ONLY (not sent to client)
```

---

## 11. KEY API ROUTES

**Authentication:**
- POST /auth/login (public, rate-limited)
- POST /auth/refresh (public)
- GET /auth/me (requires JWT)
- GET /auth/profile (requires JWT)
- POST /auth/change-password (requires JWT)
- POST /auth/mfa/setup, /mfa/verify, /mfa/disable

**Users:**
- POST/GET/PATCH/DELETE /users
- POST/DELETE /users/:id/roles
- GET /users/:id/permissions
- POST/DELETE /users/:id/permissions

**Patients:**
- POST/GET/PATCH/DELETE /patients
- GET /patients/:id/encounters
- GET /patients/:id/vitals
- GET /patients/:id/prescriptions
- (100+ more routes)

**Clinical:**
- POST/GET /encounters
- POST/GET /vitals
- POST/GET /prescriptions
- POST /prescriptions/:id/sign (doctor)
- POST /prescriptions/:id/dispense (pharmacist)

**Billing:**
- POST/GET /billing/invoices
- POST /billing/invoices/:id/payment
- GET /billing/revenue

**Pharmacy:**
- POST/GET /pharmacy/inventory
- POST /pharmacy/inventory/:id/dispense
- GET /pharmacy/reports/expiry-alerts

**Lab/Radiology:**
- POST/GET /lab/orders
- POST /lab/orders/:id/results
- POST/GET /radiology/orders

**Health (public):**
- GET / (API root)
- GET /health

**Swagger:**
- GET /api/docs (with Bearer auth)

---

## 12. COMPLETE REQUEST FLOW DIAGRAM

```
┌─────────────────────────────────────┐
│ CLIENT: POST /api/v1/patients       │
│ Authorization: Bearer <JWT>         │
│ X-Facility-Id: <FACILITY_UUID>      │
└──────────────┬──────────────────────┘
               │
               ▼
         ┌─────────────┐
         │  NGINX 443  │
         │ SSL/Rate    │
         │ Gzip/Proxy  │
         └──────┬──────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ NestJS Backend (Port 3000)    │
    ├───────────────────────────────┤
    │ correlationIdMiddleware       │ (X-Request-Id)
    │ GlobalJwtAuthGuard            │ (JWT validation)
    │ RolesGuard                    │ (@Roles check)
    │ PermissionsGuard              │ (@Permissions check)
    │ SecurityAuditInterceptor      │ (Log request start)
    │ TenantInterceptor             │ (Extract tenantId)
    │ ValidationPipe                │ (DTO validation)
    │ ───────────────────────────── │
    │ PatientsController.create()   │ (Handler)
    │ PatientsService.create()      │ (Business logic)
    │ ───────────────────────────── │
    │ ResponseTransformInterceptor  │ (Wrap envelope)
    │ AuditLogInterceptor           │ (Log to audit_log)
    │ GlobalExceptionFilter         │ (Error handling)
    └────────────┬──────────────────┘
                 │
                 ▼
      ┌──────────────────────────┐
      │ PostgreSQL (Port 5432)   │
      │ INSERT INTO patients     │
      │ VALUES (...)             │
      │ (tenantId auto-populated)│
      └────────────┬─────────────┘
                   │
                   ▼
           Response: 201 Created
           {
             "statusCode": 201,
             "data": { id, name, ... },
             "timestamp": "..."
           }
               │
               ▼
         ┌─────────────┐
         │  NGINX 443  │
         │  Gzip/Send  │
         └──────┬──────┘
                │
                ▼
         ┌─────────────┐
         │   CLIENT    │
         │  (Browser)  │
         └─────────────┘
```

---

## SUMMARY

✓ **Multi-tenant HIMS** with 60+ modules (clinical, HR, finance, pharmacy)
✓ **JWT authentication** with role inheritance + permission grouping
✓ **MFA support** (TOTP via speakeasy)
✓ **Multi-facility** within tenant with facility-scoped roles
✓ **Brute-force protection** (5 failed attempts = 15 min lockout per IP)
✓ **Soft delete** pattern (deleted_at IS NULL) for audit trail
✓ **Comprehensive audit logging** (SecurityAuditInterceptor + AuditLogInterceptor)
✓ **TypeORM + PostgreSQL** (migrations-only, no auto-sync)
✓ **Nginx reverse proxy** with SSL/TLS, rate limiting, compression
✓ **Scheduled tasks** (medication expiry, sync cleanup, health summaries)
✓ **Standardized API responses** with error handling + request tracing
✓ **Global exception filter** for security (stack traces not sent to client)
✓ **CORS + Helmet** security headers
✓ **Pagination support** with meta information
✓ **Lazy-loaded modules** for scalability

___BEGIN___COMMAND_DONE_MARKER___0
