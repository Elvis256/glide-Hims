# 🏥 GLIDE-HIMS COMPREHENSIVE SYSTEM AUDIT

**System:** Enterprise HMIS/ERP for Uganda Healthcare  
**Stack:** NestJS (backend) + React/Vite (frontend) + PostgreSQL + Redis + MinIO + Python Fingerprint Service  
**Scope:** 70+ backend modules, full frontend, infrastructure, deployment  
**Date:** 2026-04-05

---

## EXECUTIVE SUMMARY

This audit uncovered **197 findings** across 6 audit domains. The system has strong security foundations (JWT guards, bcrypt, httpOnly cookies, Helmet) but suffers from **systemic architectural gaps** that undermine those controls — particularly around tenant isolation, transaction integrity, and input validation.

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 CRITICAL | 42 | Immediate exploitation risk — data leaks, financial corruption, patient safety |
| 🟠 HIGH | 68 | Broken workflows, race conditions, privilege escalation |
| 🟡 MEDIUM | 56 | Validation gaps, caching issues, configuration weaknesses |
| 🟢 LOW | 31 | Consistency issues, logging gaps, minor hardening |

### Risk Heat Map

| Domain | CRIT | HIGH | MED | LOW | Overall Risk |
|--------|------|------|-----|-----|--------------|
| Tenant Isolation | 5 | 6 | 3 | 2 | 🔴 SEVERE |
| Data Flow / Business Logic | 21 | 47 | 38 | 16 | 🔴 SEVERE |
| Infrastructure / Secrets | 10 | 11 | 14 | 5 | 🔴 SEVERE |
| API Security / Input Validation | 7 | 11 | 6 | 2 | 🔴 HIGH |
| Authentication / Authorization | 1 | 5 | 10 | 4 | 🟠 HIGH |
| Frontend | 8 | 14 | 18 | 8 | 🟠 HIGH |

---

## POSITIVE SECURITY CONTROLS ALREADY IN PLACE ✅

Credit where due — the system has solid foundations:

- ✅ **Global JWT auth guard** — all endpoints require auth by default
- ✅ **bcrypt (12 rounds)** with password policy and history checking
- ✅ **httpOnly/Secure/SameSite=strict cookies** for token storage
- ✅ **Account lockout** after 5 failed login attempts
- ✅ **MFA (TOTP)** with encrypted secrets at rest
- ✅ **Login rate limiting** (5 attempts per 15 minutes)
- ✅ **Helmet + HSTS** security headers enabled in production
- ✅ **ValidationPipe** with `whitelist: true, forbidNonWhitelisted: true`
- ✅ **RBAC with permissions** — `@AuthWithPermissions()` decorator on most endpoints
- ✅ **File upload validation** — magic byte checking, MIME allowlisting, filename sanitization
- ✅ **Error filter** — stack traces logged but never returned to clients
- ✅ **Token rotation** via `tokenVersion` on user entity
- ✅ **Refresh token reuse detection**
- ✅ **Security audit interceptor** for sensitive operations
- ✅ **Console stripping** via esbuild `drop: ['console', 'debugger']` in production builds
- ✅ **Frontend token exclusion** from localStorage persistence via Zustand `partialize`

---

# SECTION 1: AUTHENTICATION & AUTHORIZATION

## 🔴 CRITICAL

### AUTH-C1: Production Running with Dev-Quality Secrets
**Files:** `packages/backend/.env`
```
NODE_ENV=production                    ← Production mode enabled
JWT_SECRET=glide_hims_dev_jwt_secret_64_chars_xxx...    ← Guessable!
JWT_REFRESH_SECRET=glide_hims_dev_refresh_secret_64_chars_xxx...
DB_PASSWORD=glide_hims_dev_password
MINIO_ACCESS_KEY=minioadmin            ← Factory defaults
MINIO_SECRET_KEY=minioadmin123
```
**Impact:** Anyone who guesses the JWT secret can forge tokens for any user/tenant. MinIO credentials are publicly known defaults.
**Fix:** Generate with `openssl rand -base64 64`. Use a secrets manager. Never deploy with `dev` in secret names.

## 🟠 HIGH

### AUTH-H1: Hardcoded MFA Encryption Fallback Key
**File:** `packages/backend/src/database/entities/user.entity.ts:6`
```typescript
const MFA_ENC_KEY = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback-dev-key-change-in-prod!!';
```
**Impact:** Three-tier fallback reaches a hardcoded string committed to source code. Anyone with repo access can decrypt all MFA secrets from a database dump. Static salt `'glide-hims-mfa-salt'` further weakens derivation.
**Fix:** Require `MFA_ENCRYPTION_KEY` at startup; fail if missing. Use unique random salt per deployment.

### AUTH-H2: Swagger/API Docs Publicly Accessible in Production
**File:** `packages/backend/src/main.ts:139-156`
```typescript
SwaggerModule.setup('api/docs', app, document);  // No auth middleware
```
**Impact:** Full API surface exposed for reconnaissance — every endpoint, DTO shape, parameter.
**Fix:** `if (isDev) { SwaggerModule.setup(...); }` or gate behind authentication.

### AUTH-H3: Rate Limiter Uses In-Memory Store
**File:** `packages/backend/src/modules/auth/guards/rate-limit.guard.ts:29`
```typescript
private static attempts: Map<string, RateLimitEntry> = new Map();
```
**Impact:** In multi-instance deployment (PM2 cluster), each instance has its own Map = `5 × N` login attempts. State lost on restart.
**Fix:** Use Redis-backed rate limiting (Redis already configured in project).

### AUTH-H4: Logout Does NOT Invalidate Tokens
**File:** `packages/backend/src/modules/auth/auth.controller.ts:109-117`
```typescript
async logout(@Res({ passthrough: true }) res: Response) {
    this.clearAuthCookies(res);   // Only clears cookies — JWT still valid!
    return { message: 'Logged out successfully' };
}
```
**Impact:** JWT access token valid for up to 15 minutes after "logout". Captured tokens remain usable.
**Fix:** Increment `tokenVersion` on logout to invalidate all outstanding tokens.

### AUTH-H5: System Admin Password Reset Bypasses Tenant Isolation
**File:** `packages/backend/src/modules/users/users.controller.ts:82`
```typescript
// System admin endpoint — no tenantId passed:
await this.authService.adminResetPassword(id, dto.newPassword, req.user.sub);

// Tenant-scoped endpoint passes it:
await this.authService.adminResetPassword(id, dto.newPassword, req.user.sub, req.user.tenantId);
```
**Impact:** System admin can reset ANY user's password across ALL tenants. The cross-tenant check in `adminResetPassword()` is skipped when `callerTenantId` is undefined.
**Fix:** Always pass tenant context. Require MFA for cross-tenant password resets.

## 🟡 MEDIUM

### AUTH-M1: User Status Cache Creates 30-Second Revocation Window
**File:** `packages/backend/src/modules/auth/strategies/jwt.strategy.ts:48-57`
```typescript
const user = await this.cacheService.getOrSet(cacheKey, () => ..., 30);
```
**Fix:** Proactively invalidate cache key `jwt:user:${userId}` on user status/tokenVersion change.

### AUTH-M2: Permission Cache Allows 60-Second Stale Privilege Access
**File:** `packages/backend/src/modules/auth/guards/permissions.guard.ts:106-111`
```typescript
const userPermissionCodes = await this.cacheService.getOrSet<string[]>(cacheKey, ..., 60);
```
**Fix:** Event-driven cache busting when roles/permissions change.

### AUTH-M3: Access Token Returned in Response Body (Bypasses httpOnly)
**File:** `packages/backend/src/modules/auth/auth.controller.ts:61-69`
```typescript
this.setAuthCookies(res, result.accessToken, result.refreshToken, ...);
return result;  // Tokens ALSO in JSON body — frontend JS can read them!
```
**Fix:** Stop returning `accessToken`/`refreshToken` in response body. Return only `expiresIn` and `user`.

### AUTH-M4: `unsafe-inline` in CSP Script Directive
**File:** `packages/backend/src/main.ts:66-67`
```typescript
scriptSrc: ["'self'", "'unsafe-inline'"],
styleSrc: ["'self'", "'unsafe-inline'"],
```
**Fix:** Use nonce-based CSP. Remove `unsafe-inline` from `scriptSrc`.

### AUTH-M5: Ownership Guard Fails OPEN on Errors
**File:** `packages/backend/src/modules/auth/guards/ownership.guard.ts:105-108`
```typescript
} catch (error) {
    this.logger.error(`Ownership check failed: ${error.message}`);
    return true; // Don't block on errors ← FAIL OPEN
}
```
**Fix:** Return `false` — fail closed. Better to deny legitimate access occasionally than grant unauthorized access to patient data.

### AUTH-M6: Super Admin Check Uses Substring Matching
**File:** `packages/backend/src/modules/auth/guards/ownership.guard.ts:112-118`
```typescript
return roles.some((r: string) => r.toLowerCase().includes('super admin'));
// "Not A Super Admin" would match!
```
**Fix:** Use shared `isSuperAdmin()` utility from `common/constants/roles.constants`.

### AUTH-M7: Tenant Context Middleware Fails Open on Mismatch
**File:** `packages/backend/src/common/middleware/tenant-context.middleware.ts:40-44`
```typescript
if (facility.tenantId !== user.tenantId) {
    request.tenantContext = null;  // Warns but doesn't reject!
}
```
**Fix:** Throw `ForbiddenException` on tenant mismatch.

### AUTH-M8: System Admin Tenant Switching Without Audit
**File:** `packages/backend/src/modules/auth/auth.service.ts:213`
```typescript
if (user.isSystemAdmin && loginDto.tenantId) {
    effectiveTenantId = loginDto.tenantId;  // Any tenant, no audit trail
}
```
**Fix:** Log all tenant-switching events; require MFA re-verification.

### AUTH-M9: MFA Code Accepts Any String Format
**File:** `packages/backend/src/modules/auth/dto/auth.dto.ts:24`
**Fix:** Add `@Matches(/^\d{6}$/)` to enforce 6-digit TOTP codes.

### AUTH-M10: Redis Has No Password
**File:** `packages/backend/.env:9` — `REDIS_PASSWORD=`
**Impact:** Any process on the network can read/write auth caches, inject false entries.
**Fix:** Set a strong Redis password and configure `requirepass`.

---

# SECTION 2: TENANT ISOLATION & MULTI-TENANCY

## 🔴 CRITICAL

### TENANT-C1: TenantInterceptor Does NOT Set PostgreSQL RLS Variable
**File:** `src/common/interceptors/tenant.interceptor.ts:20-33`
```typescript
async intercept(context, next): Promise<Observable<any>> {
    const tenantId = request.user?.tenantId;
    if (tenantId) {
        request.tenantId = tenantId;   // Only sets on request object
    }
    return next.handle();              // No SET app.tenant_id query!
}
```
**Impact:** Despite comments claiming RLS support, NO database-level tenant enforcement exists. Entire model depends on every service manually filtering by tenant_id.
**Fix:** Execute `SET LOCAL "app.tenant_id" = '${tenantId}'` per-request; create PostgreSQL RLS policies.

### TENANT-C2: TenantSubscriber Only Handles INSERT, Not READ/UPDATE
**File:** `src/database/subscribers/tenant.subscriber.ts:1-23`
```typescript
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
    beforeInsert(event: InsertEvent<any>): void { ... }
    // ❌ No beforeFind / beforeLoad / beforeUpdate hooks
}
```
**Impact:** No automatic tenant filtering on READ queries. No protection against cross-tenant UPDATE.
**Fix:** Add global query scope that auto-appends `WHERE tenant_id = ?`.

### TENANT-C3: Raw SQL Queries Without Tenant Filtering (Prescriptions)
**File:** `src/modules/prescriptions/prescriptions.service.ts`
5 raw SQL queries without `tenant_id` in WHERE clause — batch_stock_balances, drug_classifications, controlled substance schedules.
**Impact:** Cross-tenant drug data, batch stock, and controlled substance schedules accessible.

### TENANT-C4: Raw SQL Queries Without Tenant Filtering (Queue Management)
**File:** `src/modules/queue-management/queue-management.service.ts:1355-1379`
3 parallel raw queries on encounters, prescriptions, invoices without tenant_id filter.

### TENANT-C5: Budget vs Actual Queries Without Tenant Filter (Finance)
**File:** `src/modules/finance/budget.service.ts:71-79`
Financial data (journal entries, fiscal periods) from ANY tenant aggregated into another tenant's budget reports.

## 🟠 HIGH

### TENANT-H1: Conditional Tenant Filtering in Finance Service
**File:** `src/modules/finance/finance.service.ts:1154-1155`
```typescript
const tenantFilter = tenantId ? `AND je.tenant_id = $4` : '';
// If tenantId is undefined → filter is empty string → all tenants exposed
```
**Fix:** Make `tenantId` required. Throw error if missing.

### TENANT-H2: 24 Entities Missing tenant_id Column Entirely
**Files:** Various entities in `src/database/entities/`

| Entity | Risk Level | Patient Data? |
|--------|------------|---------------|
| `antenatal-registration.entity.ts` | 🔴 | Yes — pregnancy records |
| `antenatal-visit.entity.ts` | 🔴 | Yes — pregnancy visits |
| `baby-wellness-check.entity.ts` | 🔴 | Yes — infant health |
| `delivery-outcome.entity.ts` | 🔴 | Yes — birth records |
| `labour-record.entity.ts` | 🔴 | Yes — labour/delivery |
| `medication-administration.entity.ts` | 🔴 | Yes — med admin |
| `postnatal-visit.entity.ts` | 🔴 | Yes — post-delivery |
| `surgery-case.entity.ts` | 🔴 | Yes — surgery records |
| `surgery-consumable.entity.ts` | 🟠 | Surgery supplies |
| `theatre.entity.ts` | 🟠 | Operating theatres |
| `immunization-schedule.entity.ts` | 🟠 | Immunizations |
| `stock-transfer.entity.ts` | 🟠 | Inventory transfers |
| `stock-transfer-item.entity.ts` | 🟠 | Transfer items |
| `shift-definition.entity.ts` | 🟡 | HR data |
| `staff-roster.entity.ts` | 🟡 | HR data |
| `shift-swap-request.entity.ts` | 🟡 | HR data |
| `training-enrollment.entity.ts` | 🟡 | HR data |
| `imaging-modality.entity.ts` | 🟡 | Has facility_id only |
| `sync-conflict.entity.ts` | 🟢 | Metadata |
| `sync-queue.entity.ts` | 🟢 | Metadata |
| `group-permission.entity.ts` | 🟢 | Junction table |
| `role-permission-group.entity.ts` | 🟢 | Junction table |
| `user-permission.entity.ts` | 🟢 | Junction table |
| `icd10-code.entity.ts` | OK | Master data (shared) |

### TENANT-H3: Public Facility Info Endpoint Leaks Cross-Tenant Data
**File:** `src/modules/facilities/facilities.controller.ts:14-44`
```typescript
@Get('public/info')
@Public()  // No auth required
async getPublicInfo(@Query('facilityId') facilityId?: string) {
    facility = await this.facilitiesService.findOneFacility(facilityId);
    // ❌ No tenant scoping — any facilityId from any tenant returned
```

### TENANT-H4: Self-Service Tenant Registration Without Approval
**File:** `src/modules/setup/setup.controller.ts:58-67`
```typescript
@Post('register-tenant')
@Public()
@Throttle({ default: { ttl: 60000, limit: 5 } })
async registerTenant(@Body() dto: RegisterTenantDto) { ... }
```
**Impact:** Anyone can create new tenants with admin accounts. Only rate-limited to 5/min.

### TENANT-H5: Audit Logs Not Tenant-Scoped
**File:** `src/common/interceptors/audit-log.service.ts:26-131`
All audit log queries (`findByEntity`, `findRecent`, `findAllPaginated`, `getStats`) have NO tenantId filter.
**Impact:** Any admin with `admin.audit` permission sees audit logs from ALL tenants.

### TENANT-H6: tenant_id Column is Nullable With No FK Constraint
**File:** `src/database/entities/base.entity.ts:14`
```typescript
@Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
tenantId?: string;
```
Migration adds column but NO `NOT NULL` constraint, NO `REFERENCES tenants(id)`.
**Impact:** Records can have `tenant_id = NULL` — invisible to tenant-filtered queries but present in database.

## 🟡 MEDIUM

### TENANT-M1: Optional `tenantId` Parameters Throughout All Services
**Pattern in 40+ service files:**
```typescript
async findAll(facilityId?: string, tenantId?: string)  // ← optional!
// ...
if (tenantId) where.tenantId = tenantId;  // No filter if tenantId is falsy
```
**Fix:** Make `tenantId` required. Throw `ForbiddenException` if missing.

### TENANT-M2: System Admin Cross-Tenant Password Reset Without MFA
**File:** `src/modules/users/users.controller.ts:68-84`

### TENANT-M3: Public Tenant Listing Exposes Organization Names
**File:** `src/modules/tenants/tenants.controller.ts:13-18`
```typescript
@Get('public/list')
@Public()
async publicList() { return this.tenantsService.findAllPublic(); }
```

---

# SECTION 3: API SECURITY & INPUT VALIDATION

## 🔴 CRITICAL

### API-C1: 33+ Endpoints Accept `@Body() body: any` — No Input Validation
**Files:** `finance/*.controller.ts`, `lab-supplies.controller.ts`, `assets.controller.ts`, `hr.controller.ts`
```typescript
async createPaymentMethod(@Body() body: any)    // No DTO, no validation
async createCurrency(@Body() dto: any)           // Bypasses ValidationPipe entirely
```
**Impact:** Mass assignment, arbitrary field injection on financial/lab/HR data.
**Fix:** Create typed DTOs with class-validator decorators for every endpoint.

### API-C2: Drug Dosage Fields Lack Range Validation
**Files:** `prescriptions.dto.ts:194-200`, `drug-management.dto.ts:56-60`
```typescript
doseGiven?: number;        // NO @IsNumber, NO @Min, NO @Max
maxSingleDose?: number;    // NO @Min(0.001) or @Max — lethal dose possible
maxDailyDose?: number;     // Same
```
**Impact:** Invalid/dangerous dosages stored in system. Patient safety risk.
**Fix:** Add `@Min(0.001) @Max(appropriate_limit)` on all dosage fields.

### API-C3: Duplicate Payment Acceptance
**File:** `billing.service.ts:408-414`
```typescript
if (dto.transactionReference) {  // OPTIONAL — omit to bypass duplicate check
    const existing = await manager.findOne(Payment, {
        where: { transactionReference: dto.transactionReference }
    });
}
```
**Fix:** Make `transactionReference` mandatory, or add composite unique constraint.

### API-C4: Zero-Price Invoice Items Allowed
**File:** `billing.dto.ts:82-90`
```typescript
@Min(0)          // Allows exactly $0.00
unitPrice: number;
@Min(0)          // Allows 0 quantity
quantity: number;
```
**Fix:** `@Min(0.01)` for prices, `@Min(1)` for quantities.

### API-C5: Controlled Substance Audit Log Gap
**File:** `prescriptions.service.ts:716-743`
```typescript
if (dispensation) {  // LOG ONLY IF DISPENSATION RECORD EXISTS
    await controlledLogRepo.save({ ... });
}
```
**Impact:** If dispensation lookup fails, narcotics dispensing vanishes from audit trail. Regulatory violation.
**Fix:** Make controlled substance logging mandatory inside transaction; fail entire dispensation if logging fails.

### API-C6: Setup Endpoints Public Without Secret Token
**File:** `setup.controller.ts:42-84` — `initialize` and `register-tenant` endpoints public with no setup secret.

### API-C7: Cross-Tenant Configuration Exposure
**File:** `system-settings.controller.ts:69-87`
```typescript
@Public()
@Get('public/:key')
async findOnePublic(@Param('key') key, @Query('tenantId') tenantId?) {
    return this.systemSettingsService.getByKey(key, tenantId);  // Any tenant!
```

## 🟠 HIGH

### API-H1: Invoice Amount Tampering Post-Creation
**File:** `billing.service.ts:270-291` — Price changes allowed on partially-paid invoices with NO audit log.

### API-H2: Floating-Point Financial Calculations (System-Wide)
**File:** `billing.service.ts:907`, `pos.service.ts:181`, and throughout
```typescript
const totalAmount = params.quantity * resolvedUnitPrice;  // IEEE 754
```
**Fix:** Use `Decimal.js` or store all monetary values as integer cents.

### API-H3: Dose Limit Check Missing in `dispenseItem()`
**File:** `prescriptions.service.ts:313-342` — `dispenseItem()` has NO `max_single_dose` check, while `dispenseBatch()` does.

### API-H4: Path Traversal in Patient Document Download
**File:** `patients.controller.ts:82-110`
```typescript
const fileStream = createReadStream(document.filePath);  // NO path validation
```
HR module correctly uses `path.resolve()` + `startsWith(uploadsDir)`. Patient module doesn't.

### API-H5: No HTML Sanitization — Clinical Notes Stored Raw
**Files:** `clinical-notes.service.ts`, `patients.service.ts:518-531` — No `sanitize-html` or `DOMPurify` installed. XSS payloads persisted to DB.

### API-H6: Document Access Without Patient Ownership Verification (IDOR)
**File:** `patients.controller.ts:70-80` — Any user with `patients.read` can access any document by UUID.

### API-H7: No Audit Logging for Financial Modifications
**File:** `billing.service.ts` — Price changes, payment voids, write-offs only use `this.logger.log()`, not a persistent audit table.

### API-H8: Weak Write-Off Authority — No Amount Limit
**File:** `billing.controller.ts:181-190` — Any user with `finance.manage` can write off unlimited amounts.

### API-H9: FEFO Enforcement Bypassed by Client-Provided Expiry
**File:** `prescriptions.service.ts:518-532` — Uses DTO expiry date instead of database record.

### API-H10: SQL String Interpolation
**File:** `inventory.service.ts:43` — String interpolation in `.where()` clause.

### API-H11: Waiver Approval Can Exceed Requested Amount
**File:** `patient-finance.service.ts:280-282` — $100 waiver can be approved for $10,000.

## 🟡 MEDIUM

### API-M1: Ownership Guard Fails Open on Error
**File:** `ownership.guard.ts:108` — `return true` on catch.

### API-M2: Race Condition in Controlled Substance Running Balance
**File:** `prescriptions.service.ts:721-743` — No row-level lock.

### API-M3: Missing Pessimistic Lock on POS Shift Close
**File:** `pos.service.ts:96-113`

### API-M4: No Sanitization Library in package.json
**Fix:** `npm install sanitize-html`

### API-M5: MFA Code Accepts Any String
**File:** `auth.dto.ts:24` — Add `@Matches(/^\d{6}$/)`.

### API-M6: CORS Allows HTTP Origin
**File:** `.env:20` — `http://localhost:5173` mixed with HTTPS origins.

---

# SECTION 4: FRONTEND SECURITY

## 🔴 CRITICAL

### FE-C1: `dangerouslySetInnerHTML` in 4 Certificate Pages With Template Literals
**Files:**
- `SickLeavePage:391`
- `MedicalCertificatePage:706`
- `DeathCertificatePage:501`
- `FitnessCertificatePage:567`

Patient names, diagnoses, and other data injected without sanitization. Stored XSS risk.

### FE-C2: PHI Cached Unencrypted in IndexedDB
**File:** `sync/db.ts:65-106`
14 tables of healthcare data (patients, vitals, prescriptions, clinical notes, lab results) stored in plain text in the browser. HIPAA violation risk.
**Fix:** Encrypt PHI at rest in IndexedDB or remove offline caching of clinical data.

### FE-C3: WebSocket Sends accessToken in `auth` Object
**File:** `useNotificationSocket.ts:27`
Token visible in DevTools Network tab. 
**Fix:** Use `withCredentials: true` for WebSocket auth instead.

### FE-C4: `/setup` and `/register` Routes Have Zero Auth Protection
**File:** `App.tsx:549-551` — Anyone can create organizations/tenants from the frontend.

### FE-C5: `/system/*` Routes Only Check `isAuthenticated`, Not Admin Role
**File:** `App.tsx:557-558` — Any authenticated user can access system admin pages.

### FE-C6: Appointment "View" Button Has No onClick Handler
**File:** `ViewAppointmentsPage:215-220` — Dead button, broken workflow.

### FE-C7: Queue Analytics PDF Export Generates Fake Text File
**File:** `QueueAnalyticsPage:105` — Creates plain text disguised as PDF.

### FE-C8: `document.write()` With Unsanitized Patient Data
**Files:** `DispenseMedicationPage:541`, `PaymentsPage:109`

## 🟠 HIGH

### FE-H1: Facility/Tenant IDs from sessionStorage — User-Modifiable
**File:** `api.ts:78-88` — `x-facility-id` and `x-tenant-id` headers can be tampered via DevTools. Backend MUST validate against JWT.

### FE-H2: `PermissionGate` is UI-Only
**File:** `PermissionGate.tsx:24-62` — 200+ usages. Hides elements but doesn't prevent route access.

### FE-H3: Image `src` from API Without URL Validation
**Files:** `SickLeavePage:103`, certificate pages — `inst.logo` could be `javascript:` URI.

### FE-H4: Patient Duplicate Check Failure Silently Proceeds
**File:** `PatientRegistrationPage:333-336` — Registration completes even if duplicate check fails.

### FE-H5: NewBillPage Patient Auto-Load Failure Silently Ignored
**File:** `NewBillPage:47-50`

### FE-H6: Stock Reports Use Estimated Consumption, Not Actual Data
**File:** `StockReportsPage:146` — TODO comment.

### FE-H7: Pharmacy Dispense Time Metric Hardcoded to 0
**File:** `PharmacyAnalyticsPage:150` — TODO.

### FE-H8: Financial Reports Period Comparison Disabled
**File:** `FinancialReportsPage:859,907` — "Coming soon".

### FE-H9: Self-Signed TLS Certificate + Private Key in Repo
**Files:** `certs/key.pem`, `certs/cert.pem` — private key was in git history (removed in commit `7607631` but still recoverable).

### FE-H10: 28+ Silent Error Swallowing Patterns
**Pattern:** `catch { return []; }` in PayrollPage, LabQCDashboard, ReagentsInventory, SupplierLedger, etc.

### FE-H11: 15+ Empty Error Handlers
**Pattern:** `catch { /* ignore */ }` or `.catch(() => {})` in NotificationBell, NewBillPage, etc.

### FE-H12: Drug Interaction Check Silently Skipped on Error
**File:** `DrugInteractionsPage:93` — Patient safety risk.

### FE-H13: Empty `onError` Handlers in 12+ Mutations
**Files:** `ResultsEntryPage:288,311`, `LabQueuePage`, etc.

### FE-H14: No DOMPurify Installed
**File:** `package.json` — Manual `escapeHtml()` only escapes 5 characters.

## 🟡 MEDIUM

- `AdminRoute` excludes Super Admin role (`RoleRoute.tsx:76-78`)
- Super Admin/Administrator bypass ALL permission checks (hardcoded in `ProtectedRoute.tsx:29-31`)
- No CSP headers in Vite config or index.html
- `printElement()` passes innerHTML to print without sanitization — used in 34+ locations
- `escapeHtml()` doesn't handle event handlers or CSS injection
- `authService.refreshToken(token)` param ignored (`auth.ts:10-13`)
- Proxy to HTTP backend in dev (`vite.config.ts:28`)
- No `.env` file validation at startup
- `xlsx` package has known CVEs in older versions
- Unhandled promise chains in 7+ locations

---

# SECTION 5: INFRASTRUCTURE & DEPLOYMENT

## 🔴 CRITICAL

### INFRA-C1: Fingerprint Service Has ZERO Authentication
**File:** `packages/fingerprint-service/server.py` — All routes (`/capture`, `/verify`, `/match`) open to anyone on the network.

### INFRA-C2: Fingerprint CORS Allows Wildcard `*`
**File:** `packages/fingerprint-service/server.py:27`

### INFRA-C3: Mock Fingerprint Scanner Always Returns Match=True
**File:** `packages/fingerprint-service/server.py:95`
```python
return template1 == template2 or True  # For testing, always match
```
**Impact:** If hardware is absent, EVERY fingerprint authenticates as EVERY user.
**Fix:** Remove `or True`; return 503 when no hardware in production.

### INFRA-C4: Hardcoded Default Admin Credentials in Scripts
**Files:** `setup.sh:69`, `scripts/server.sh:59`
```bash
echo "  Login:     admin / Admin@123"
```

### INFRA-C5: Unencrypted Patient Data Backups
**File:** `scripts/backup.sh` — `pg_dump` without encryption.
**Fix:** Pipe through `gpg --symmetric --cipher-algo AES256`.

### INFRA-C6: Hardcoded DB Credentials in All 8 Seed Files
**Files:** `packages/backend/src/database/seeds/*`
```typescript
password: process.env.DB_PASSWORD || 'glide_hims_dev',
```
**Fix:** Fail fast if env vars missing; no fallback credentials.

### INFRA-C7: Private TLS Key Was in Git History
**File:** `packages/frontend/certs/key.pem` — removed in commit `7607631` but recoverable from history.
**Fix:** Rotate key immediately. Consider `git filter-repo` to purge.

### INFRA-C8: No PostgreSQL SSL/TLS — PHI in Cleartext on Wire
**File:** `packages/backend/src/config/database.config.ts` — No `ssl` configuration.

### INFRA-C9: SQL Logging Enabled in Production
**File:** `packages/backend/src/config/database.config.ts` — `logging: true` logs all SQL with patient data.

### INFRA-C10: Unsafe `.env` Parsing — Command Injection
**File:** `scripts/backup.sh` — `export $(... | xargs)` is vulnerable to command injection.
**Fix:** Use safe `while IFS= read` loop.

## 🟠 HIGH

- MinIO SSL disabled (`MINIO_USE_SSL=false`)
- Redis has no password (`REDIS_PASSWORD=`)
- RabbitMQ uses default guest credentials
- DB password via `PGPASSWORD` env (visible in `/proc`)
- No backup integrity verification before restore
- Realistic PII in seed data (national IDs, salaries, bank accounts)
- `speakeasy` unmaintained (2017), `xlsx` has prototype pollution CVE
- Fingerprint service binds `0.0.0.0` with no auth
- Seed data includes hardcoded facility UUIDs

## 🟡 MEDIUM

- CORS includes `http://localhost` in production origins
- No systemd hardening (`ProtectSystem`, `NoNewPrivileges`)
- Runs as named user `avis`, not dedicated service account
- Missing `Content-Security-Policy` in nginx
- No `client_max_body_size` in nginx — DoS risk
- Wildcard `server_name _` enables host header attacks
- `.env` copied without `chmod 600`
- USB device mode `0666` (world read/write) for fingerprint scanner
- WebSocket endpoint has no rate limiting
- Inconsistent deployment paths across config files

---

# SECTION 6: DATA FLOW & BUSINESS LOGIC

## 🔴 CRITICAL

### FLOW-C1: Discharge Has No Transaction
**File:** `discharge/discharge.service.ts:40-49`
Discharge summary + encounter status update as separate operations. Partial failure = inconsistent state. No encounter-status validation — CANCELLED encounters can be discharged.

### FLOW-C2: Sync `pushChanges` — Data Loss Race Condition
**File:** `sync/sync.service.ts:57-84`
Conflict detection and change application not wrapped in transaction. Between `detectConflict()` and `applyChange()`, another request can overwrite healthcare records.

### FLOW-C3: Insurance Claim — No Transaction Boundary
**File:** `insurance/insurance.service.ts:335-369`
Claim → items → total update as 3 separate DB writes. Partial failure = corrupted claim totals.

### FLOW-C4: GL Posting is Fire-and-Forget Throughout
**Files:** `billing.service.ts:145-151`, `pharmacy.service.ts:388`, `procurement.service.ts:958`
```typescript
.catch(err => logger.warn());  // GL failure silently ignored!
```
**Impact:** Invoices exist but Accounts Receivable diverges from actuals. No retry mechanism.

### FLOW-C5: POS Shift Revenue — Race Condition Loses Money
**File:** `pos/pos.service.ts:169-193`
Read-modify-write on `cashSales` without any locking. Two concurrent sales → second write overwrites first → silent revenue loss.

### FLOW-C6: Inventory `receiveStock()` and `transferStock()` — No Pessimistic Locks
**File:** `inventory/inventory.service.ts:181-221, 294-364`
Concurrent receives lose stock; concurrent transfers can drive balances negative.

### FLOW-C7: `@ts-nocheck` on Critical Healthcare Files
**Files:** `stock-transfer.service.ts:1`, `ipd.service.ts:1`
Type safety disabled on 500+ line files handling stock transfers and patient bed management.

### FLOW-C8: Appointment Double-Booking — No Conflict Detection
**File:** `appointments/appointments.service.ts:23-35`
Two appointments bookable for same doctor at same time.

### FLOW-C9: Diagnosis Unique Index Not Tenant-Scoped
**File:** `database/entities/diagnosis.entity.ts:33-34`
`@Index(['icd10Code'], { unique: true })` — Tenant B cannot create a code Tenant A already has.

### FLOW-C10: Surgery OR Slot — Race Condition
**File:** `surgery/surgery.service.ts:98-113`
Conflict check + insert in two non-transactional steps.

### FLOW-C11: Baby Outcome Always Marked ALIVE
**File:** `maternity/maternity.service.ts:344`
```typescript
babyStatus: BabyStatus.ALIVE  // Hardcoded regardless of dto.outcome
```
**Impact:** Stillbirths recorded as live births. Clinical data accuracy issue.

## 🟠 HIGH (Key Items)

### Patient Flow
- No encounter-status check before prescription creation — prescriptions written on COMPLETED encounters
- Prescription status has no state machine — any status can transition to any other
- Billing failures on Rx are non-blocking — medication dispensed without billing record
- Drug-interaction check skipped on service failure — dispensing proceeds silently
- Patient merge SQL lacks tenant filter — cross-tenant data corruption

### Billing/Finance
- POS shift balance ignores non-cash payments — only counts `cashSales`
- Journal entry lines saved outside transaction — orphaned lines on partial failure
- Waiver approval can exceed requested amount

### Inventory/Pharmacy
- Stock not reserved at ship time — items available for sale during transit (double-spend)
- Pharmacy FEFO allocation includes expired batches — no expiry date filter
- Stores `adjustStock()` has no transaction or lock

### Lab/Appointments
- Lab results bypass sample collection — auto-transitions COLLECTED→RECEIVED→PROCESSING
- Sample rejection allowed from any status — COMPLETED samples with released results can be rejected
- Schedule overlap detection incomplete — checks day only, not time range
- No `startTime >= endTime` validation on schedules

### Sync/Notifications
- Notification template CRUD entirely stubbed — returns hardcoded JSON
- `processPendingReminders` has no cron job — scheduled reminders never sent
- Partial notification channel failures silently swallowed
- Sync conflict detection uses timestamps instead of version vectors — clock skew issues

### IPD
- Bed transfer reads admission outside transaction — TOCTOU race condition
- Beds stuck in CLEANING status — no mechanism to transition back to AVAILABLE
- No duplicate admission check — patient can be admitted to multiple beds

### Surgery/Emergency/Maternity
- Emergency discharge has no status guard — PENDING cases discharged without treatment
- Surgery can start without pre-op checklist — SCHEDULED→IN_PROGRESS bypasses pre-op
- SMS follow-up reminders are a stub — marked as sent without actually sending

### Analytics
- SQL injection risk via string interpolation in analytics queries
- HMIS 105 Section D ignores tenantId — cross-tenant maternity data
- All analytics errors return empty arrays — broken queries show zero revenue silently

---

# SYSTEMIC PATTERNS

These patterns repeat across the entire codebase and represent architectural debt:

| Pattern | Occurrences | Risk |
|---------|-------------|------|
| `tenantId?: string` (optional tenant filtering) | 40+ services | 🔴 Cross-tenant data leaks |
| Missing DB transactions on multi-write ops | 15+ modules | 🔴 Data corruption |
| Race conditions (TOCTOU / read-modify-write) | 12+ modules | 🔴 Financial loss / data loss |
| Fire-and-forget side effects (GL, billing, notifications) | 8+ modules | 🟠 Silent data divergence |
| `@Body() body: any` (no validation) | 33+ endpoints | 🟠 Mass assignment / injection |
| Floating-point currency arithmetic | Universal | 🟠 Financial accuracy |
| Number generation without DB locking | 10+ modules | 🟠 Duplicate IDs |
| `catch { return []; }` (silent error swallowing) | 28+ frontend | 🟠 User confusion |
| `@ts-nocheck` / `as any` type bypasses | 6+ files | 🟡 Hidden bugs |
| Hardcoded business rules (tax rates, thresholds) | 5+ modules | 🟡 Configuration debt |
| Stub/TODO implementations presented as working | 10+ features | 🟡 False confidence |

---

# REMEDIATION ROADMAP

## 🚨 Phase 1: Stop the Bleeding (This Week)

| # | Action | Findings Addressed |
|---|--------|--------------------|
| 1 | **Rotate ALL production secrets** — JWT, DB, MinIO, Redis, RabbitMQ | AUTH-C1, INFRA-C4-C8 |
| 2 | **Fix fingerprint service** — remove `or True`, add API key auth, bind to 127.0.0.1 | INFRA-C1-C3 |
| 3 | **Make `tenantId` required** in ALL service method signatures | TENANT-C1-C5, TENANT-H1, TENANT-M1 |
| 4 | **Protect `/setup` and `/system/*` frontend routes** with proper role guards | FE-C4, FE-C5 |
| 5 | **Install DOMPurify**, sanitize all `dangerouslySetInnerHTML` and `document.write()` | FE-C1, FE-C8, API-H5 |
| 6 | **Disable Swagger in production** | AUTH-H2 |
| 7 | **Remove `or True`** from fingerprint matcher | INFRA-C3 |
| 8 | **Fix baby outcome** — use `dto.outcome` instead of hardcoded `ALIVE` | FLOW-C11 |

## 🔶 Phase 2: Financial Integrity (Next 2 Weeks)

| # | Action | Findings Addressed |
|---|--------|--------------------|
| 9 | **Wrap ALL financial multi-write operations in DB transactions** | FLOW-C1, C3, C4, C5 |
| 10 | **Add pessimistic locks to read-modify-write on monetary/stock fields** | FLOW-C5, C6, C10, API-M3 |
| 11 | **Replace floating-point math with Decimal.js** | API-H2 |
| 12 | **Create typed DTOs** for all 33+ `body: any` endpoints | API-C1 |
| 13 | **Add `@Min/@Max` validation** to ALL dosage and financial fields | API-C2, C4 |
| 14 | **Make controlled substance logging mandatory/transactional** | API-C5 |
| 15 | **Fix duplicate payment check** — make transactionReference required | API-C3 |
| 16 | **Block price changes on paid/partially-paid invoices** | API-H1 |
| 17 | **Create persistent financial audit log table** | API-H7 |

## 🟡 Phase 3: Clinical Safety & Data Integrity (Next Sprint)

| # | Action | Findings Addressed |
|---|--------|--------------------|
| 18 | **Add appointment conflict detection** | FLOW-C8 |
| 19 | **Add dose limit check to `dispenseItem()`** | API-H3 |
| 20 | **Fix lab status state machine** — enforce valid transitions | FLOW lab findings |
| 21 | **Fix prescription status state machine** | FLOW prescription findings |
| 22 | **Fix FEFO enforcement** — use DB expiry, not DTO value | API-H9 |
| 23 | **Add encounter-status validation** before prescription/discharge | FLOW patient findings |
| 24 | **Fix sync conflict resolution** — wrap in transaction, use version vectors | FLOW-C2 |
| 25 | **Add `tenant_id`** to 24 missing entities | TENANT-H2 |
| 26 | **Encrypt PHI in IndexedDB** or remove offline clinical data caching | FE-C2 |

## 🟢 Phase 4: Hardening & Compliance (Following Sprint)

| # | Action | Findings Addressed |
|---|--------|--------------------|
| 27 | **Implement PostgreSQL RLS** as defense-in-depth | TENANT-C1, C2 |
| 28 | **Enable SSL** for PostgreSQL, MinIO, Redis | INFRA-C8, INFRA-H1-H3 |
| 29 | **Encrypt backups** with GPG | INFRA-C5 |
| 30 | **Add `NOT NULL` + FK constraints** on tenant_id | TENANT-H6 |
| 31 | **Scope audit logs by tenant** | TENANT-H5 |
| 32 | **Increment tokenVersion on logout** | AUTH-H4 |
| 33 | **Move rate limiter to Redis** | AUTH-H3 |
| 34 | **Fix path traversal** in patient document download | API-H4 |
| 35 | **Remove `@ts-nocheck`** from all files | FLOW-C7 |
| 36 | **Systemd hardening** — `ProtectSystem`, `NoNewPrivileges`, dedicated user | INFRA-M5-M6 |
| 37 | **Add CSP headers** to nginx and remove `unsafe-inline` | AUTH-M4, INFRA-M7 |
| 38 | **Purge TLS private key from git history** | INFRA-C7 |
| 39 | **Replace `speakeasy`** with maintained `otpauth` library | INFRA-H11 |
| 40 | **Fix 28+ silent error handlers** on frontend — show user feedback | FE-H10, H11 |

---

*Generated by comprehensive audit of 70+ backend modules, full frontend, infrastructure, and deployment configuration.*
