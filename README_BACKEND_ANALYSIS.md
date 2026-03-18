# 🏥 Glide-HIMS NestJS Backend - Complete System Analysis

**Generated:** March 2025  
**Focus:** Enterprise HMIS Backend Architecture & Flows  
**Total Documentation:** 1,232 lines across 3 comprehensive files

---

## 📋 Documentation Files

### 1. **BACKEND_SYSTEM_OVERVIEW.txt** (21KB) 
**START HERE** - Visual overview of all 8 components with ASCII diagrams
- Bootstrap sequence flowchart
- All 8 key questions answered with bullet points
- Complete request flow diagram (Client → DB → Response)
- Standard response envelope examples
- Security features checklist
- Key files to understand
- Quick reference for all major concepts

**Best for:** Quick understanding of the complete system, getting oriented

---

### 2. **BACKEND_ANALYSIS.md** (17KB)
**DEEP DIVE** - Comprehensive technical analysis of all components
- Section 1: Application Bootstrap (main.ts)
- Section 2: Authentication Flow (login process with JWT)
- Section 3: Current User Info (/auth/me endpoint)
- Section 4: Request Lifecycle (11-step processing pipeline)
- Section 5: Database Architecture (TypeORM + PostgreSQL)
- Section 6: Multi-Tenancy Isolation (6-layer strategy)
- Section 7: Module Structure (60+ modules organized by phase)
- Section 8: Scheduled Tasks (3 cron jobs)
- Section 9: Key API Routes (by category)
- Section 10: Nginx Reverse Proxy (SSL, rate limiting, compression)
- Section 11: Standard Responses (success, error, pagination examples)
- Section 12: Complete Request Flow Diagram (Client → DB → Client)

**Best for:** Understanding technical implementation details, system design

---

### 3. **QUICK_REFERENCE.txt** (16KB)
**CHEAT SHEET** - Developer reference guide with quick lookups
- Bootstrap sequence checklist
- Authentication flow summary
- Guards, interceptors, pipes quick reference
- Database schema entities
- Multi-tenancy isolation layers
- Modules by category
- Scheduled tasks list
- Key routes by endpoint category
- Nginx proxy configuration
- Standard responses
- Environment variables
- Common decorators
- Development commands

**Best for:** Quick lookup during development, reference guide

---

## 🎯 8 Key Questions Answered

### 1. **Application Bootstrap** ✓
How does main.ts start the app? What global middleware, filters, interceptors, guards?

**Answer:** 
- Middleware: Helmet, correlationId, bodyParser
- Guards: GlobalJwtAuthGuard (JWT required), ThrottlerGuard (rate limit)
- Interceptors: SecurityAudit → Tenant → ResponseTransform → AuditLog
- Filters: GlobalExceptionFilter
- Pipes: ValidationPipe (DTO validation)
- CORS: Enabled for localhost:5173
- See: BACKEND_SYSTEM_OVERVIEW.txt (Section 1)

---

### 2. **Authentication Flow** ✓
How does login work? JWT strategy? How does /auth/me work? What guards protect routes?

**Answer:**
- Login: Rate limit → Bcrypt validate → MFA check → Resolve permissions (with inheritance) → Create JWT
- JWT Strategy: Extract from Bearer header → Validate with JWT_SECRET
- /auth/me: Returns user + all permissions + accessible modules (for frontend nav)
- Guards: GlobalJwtAuthGuard (default), @Roles, @Permissions, @FacilityAccess, @ResourceOwnership, @EmployeeRequiredGuard
- See: BACKEND_SYSTEM_OVERVIEW.txt (Section 2) or BACKEND_ANALYSIS.md (Sections 2-3)

---

### 3. **Module Structure** ✓
What are the main modules registered in app.module.ts? How are they organized?

**Answer:**
- 60+ modules organized by business phase (1-22)
- Core: Auth, Users, Tenants, Facilities, Roles, Patients, Encounters, Vitals, Prescriptions
- Clinical: Lab, Radiology, Pharmacy, Emergency, Surgery, Maternity
- Advanced: Procurement, Sync, Analytics, Integrations, PricingEngine
- Each module independent with: Controller, Service, Entities, Repos, DTOs, Guards
- See: BACKEND_SYSTEM_OVERVIEW.txt (Section 3) or QUICK_REFERENCE.txt

---

### 4. **Database Configuration** ✓
How is TypeORM configured? What's the entity/migration strategy?

**Answer:**
- ORM: TypeORM (NO auto-sync! Migrations only)
- DB: PostgreSQL with connection pooling
- Strategy: Manual migrations via typeorm CLI, all schema changes versioned
- Base Entity: id (UUID), tenantId (multi-tenancy), createdAt, updatedAt, deletedAt (soft delete)
- Key tables: users, roles, permissions, facilities, patients, encounters, vitals, prescriptions, audit_log
- See: BACKEND_SYSTEM_OVERVIEW.txt (Section 4) or BACKEND_ANALYSIS.md (Section 5)

---

### 5. **Request Lifecycle** ✓
What interceptors/guards/pipes does a typical request go through?

**Answer:**
- 11-step pipeline: correlationId → Guard → Route Guards → Interceptor (BEFORE) → Validation → Handler → Interceptor (AFTER) → Exception Filter
- Interceptors: SecurityAudit (log), Tenant (propagate), ResponseTransform (wrap), AuditLog (async)
- See: BACKEND_SYSTEM_OVERVIEW.txt (Section 5) or BACKEND_ANALYSIS.md (Section 4)

---

### 6. **Multi-Tenancy** ✓
How is tenant isolation enforced?

**Answer:**
- 6-layer defense: JWT tenantId → Guard extract → Interceptor propagate → DB schema → Service filtering → Future RLS
- Multi-facility: Tenant has multiple facilities, user roles facility-scoped, services filter by both tenant_id AND facility_id
- Service layer MUST filter all queries: WHERE tenant_id = :tenantId AND deleted_at IS NULL
- See: BACKEND_SYSTEM_OVERVIEW.txt (Section 6) or BACKEND_ANALYSIS.md (Section 6)

---

### 7. **Scheduled Tasks** ✓
What cron jobs run?

**Answer:**
- 3 scheduled tasks via @Cron decorators:
  1. CHECK-MEDICATION-EXPIRY (7:00 AM daily) - Find 30-day expiring batches
  2. CLEANUP-OLD-SYNC-RECORDS (2:00 AM Sundays) - Delete old sync conflicts
  3. DAILY-HEALTH-SUMMARY (6:00 AM daily) - Log system health metrics
- See: BACKEND_SYSTEM_OVERVIEW.txt (Section 7) or BACKEND_ANALYSIS.md (Section 8)

---

### 8. **Key API Routes** ✓
What are the main controller endpoints?

**Answer:**
- Auth: /auth/login, /auth/refresh, /auth/me, /auth/change-password
- Users: POST/GET/PATCH/DELETE /users, /users/:id/roles, /users/:id/permissions
- Patients: 50+ routes for patients, encounters, vitals, documents, etc.
- Clinical: Prescriptions, Lab, Radiology, Pharmacy, Billing
- Health: GET / (public), GET /health (public), GET /api/docs (Swagger)
- See: BACKEND_SYSTEM_OVERVIEW.txt (Section 8) or BACKEND_ANALYSIS.md (Section 9)

---

## 📊 Request Flow Diagram (Visual)

```
CLIENT (Browser/Mobile)
    ↓ HTTP/HTTPS POST /api/v1/patients (Authorization: Bearer <JWT>)
    ↓
NGINX (443) - SSL/TLS, rate limit, gzip
    ↓
NestJS Backend (3000) - 11-step pipeline
    ├─ JWT validation
    ├─ Route guards (@Roles, @Permissions)
    ├─ Security audit logging
    ├─ Tenant context extraction
    ├─ DTO validation
    ├─ Business logic execution
    ├─ Response wrapping
    └─ Audit logging (async)
    ↓
PostgreSQL (5432) - tenantId auto-populated
    ↓ INSERT / SELECT / UPDATE
    ↓
HTTP 201 Response
{
  "statusCode": 201,
  "data": { id, name, email, createdAt },
  "timestamp": "2025-03-16T12:34:56.789Z"
}
    ↓
NGINX - compress, send
    ↓
CLIENT RECEIVES
```

---

## 🔐 Security Features

✓ JWT with HS256 (15m access, 7d refresh)  
✓ MFA (TOTP 2FA)  
✓ Brute force protection (5 fails = 15 min lockout)  
✓ HTTPS/TLS 1.2+ (Nginx)  
✓ HSTS headers  
✓ CORS whitelist  
✓ Rate limiting (10 req/s)  
✓ Bcrypt password hashing  
✓ Comprehensive audit logging  
✓ Soft delete for audit trail  
✓ 6-layer multi-tenancy isolation  
✓ Input validation + whitelist  
✓ Global error handler (no info leakage)  

---

## 🛠️ Key Technologies

- **Framework:** NestJS v9+
- **Database:** PostgreSQL with TypeORM (no auto-sync)
- **Authentication:** JWT + Passport + MFA (speakeasy)
- **Reverse Proxy:** Nginx with SSL/TLS, rate limiting
- **Scheduling:** @nestjs/schedule with @Cron
- **Validation:** class-validator decorators
- **API Docs:** Swagger UI at /api/docs
- **Tracing:** X-Request-Id correlation IDs
- **Testing:** Jest + Supertest

---

## 📝 How to Use This Documentation

### For Understanding the System:
1. Start with **BACKEND_SYSTEM_OVERVIEW.txt**
2. Read the request flow diagram
3. Review the 8 key questions answered

### For Deep Technical Dive:
1. Read **BACKEND_ANALYSIS.md** sections 1-12
2. Study the database schema
3. Trace through the authentication flow

### For Development:
1. Use **QUICK_REFERENCE.txt** as a cheat sheet
2. Look up guards, interceptors, decorators
3. Check environment variables
4. Reference common patterns

### For Code Review:
1. Check multi-tenancy isolation (Layer 5: service filtering)
2. Verify permission resolution with inheritance
3. Ensure AuditLogInterceptor logs mutations
4. Validate route guards are applied

---

## 🎓 Learning Path

**Beginner (1-2 hours):**
1. Read BACKEND_SYSTEM_OVERVIEW.txt
2. Run `npm run start` and test /health endpoint
3. Try login endpoint, examine JWT

**Intermediate (2-4 hours):**
1. Read BACKEND_ANALYSIS.md sections 1-6
2. Examine auth flow code (auth.service.ts)
3. Trace request through interceptors

**Advanced (4+ hours):**
1. Deep dive BACKEND_ANALYSIS.md sections 7-12
2. Study multi-tenancy isolation (6 layers)
3. Review permission inheritance chain
4. Understand role-based access control

---

## 📞 Key Files to Review

- `src/main.ts` - Bootstrap + middleware setup
- `src/app.module.ts` - Module imports + TypeORM config
- `src/modules/auth/auth.controller.ts` - Login/refresh endpoints
- `src/modules/auth/auth.service.ts` - Authentication logic
- `src/modules/auth/guards/global-jwt.guard.ts` - JWT validation
- `src/common/interceptors/` - Request processing
- `src/database/entities/base.entity.ts` - Multi-tenancy base

---

## ✅ Checklist for Understanding

- [ ] Read BACKEND_SYSTEM_OVERVIEW.txt (15 min)
- [ ] Understand 11-step request pipeline (20 min)
- [ ] Trace login flow from POST /auth/login to JWT creation (30 min)
- [ ] Review 6-layer multi-tenancy isolation (15 min)
- [ ] Study guard/interceptor/pipe flow (30 min)
- [ ] Examine database entity relationships (20 min)
- [ ] Review permission resolution with inheritance (20 min)
- [ ] Understand audit logging strategy (15 min)

**Total: ~2.5 hours for comprehensive understanding**

---

## 📦 Deliverables

✓ 3 comprehensive documentation files (1,232 lines total)  
✓ All 8 key questions answered  
✓ Complete request flow diagrams  
✓ Database schema with relationships  
✓ Security features checklist  
✓ Developer quick reference guide  
✓ Example responses for all scenarios  
✓ Environment variables documented  

---

**Last Updated:** March 2025  
**Backend Version:** NestJS 9+  
**Documentation Quality:** Enterprise-Grade

For more details, see the individual documentation files:
- BACKEND_SYSTEM_OVERVIEW.txt
- BACKEND_ANALYSIS.md
- QUICK_REFERENCE.txt

