# Glide HIMS: Deployment & Operations Guide

**Version:** 1.0  
**Last Updated:** April 2026  
**Author:** IT Solutions Uganda  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architecture Overview](#2-architecture-overview)
3. [Multi-Tenant Model](#3-multi-tenant-model)
4. [Deployment Modes](#4-deployment-modes)
5. [Security & Tenant Isolation](#5-security--tenant-isolation)
6. [Authentication System](#6-authentication-system)
7. [Licensing & Code Protection](#7-licensing--code-protection)
8. [Updates & Maintenance](#8-updates--maintenance)
9. [Feature Flags & Customization](#9-feature-flags--customization)
10. [Operational Procedures](#10-operational-procedures)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Introduction

### 1.1 What is Glide HIMS?

Glide HIMS (Healthcare Information Management System) is a comprehensive healthcare management platform designed for hospitals, clinics, and healthcare facilities in Uganda and East Africa.

### 1.2 Purpose of This Guide

This guide covers:
- How the system is architected for multiple deployment scenarios
- How tenant isolation and security work
- How to deploy, update, and maintain the system
- How to handle customer-specific requirements

### 1.3 Target Audience

- System Administrators
- DevOps Engineers
- Support Team
- Business Stakeholders

---

## 2. Architecture Overview

### 2.1 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Vite |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL 15 |
| Cache | In-Memory (Redis optional) |
| Process Manager | PM2 |
| Web Server | Nginx |
| Containerization | Docker (optional) |

### 2.2 System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         GLIDE HIMS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   Frontend  │    │   Backend   │    │  Database   │        │
│  │   (React)   │───▶│  (NestJS)   │───▶│ (PostgreSQL)│        │
│  │   Port 5173 │    │   Port 3000 │    │  Port 5432  │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│        │                  │                   │                │
│        │                  │                   │                │
│        ▼                  ▼                   ▼                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    NGINX (Port 443)                      │  │
│  │              SSL Termination + Reverse Proxy             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Directory Structure

```
glide-Hims/
├── packages/
│   ├── backend/           # NestJS API
│   │   ├── src/
│   │   │   ├── database/  # Entities, migrations
│   │   │   ├── modules/   # Feature modules
│   │   │   └── common/    # Shared utilities
│   │   └── dist/          # Compiled output
│   └── frontend/          # React application
│       ├── src/
│       └── dist/          # Production build
├── docs/                  # Documentation
├── scripts/               # Utility scripts
└── infrastructure/        # Deployment configs
```

---

## 3. Multi-Tenant Model

### 3.1 What is Multi-Tenancy?

Multi-tenancy allows multiple organizations (hospitals/clinics) to share the same application instance while keeping their data completely isolated.

### 3.2 Tenant Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                      GLIDE HIMS PLATFORM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Tenant A  │  │   Tenant B  │  │   Tenant C  │            │
│  │   (Amani    │  │   (Mulago   │  │   (Kisasi   │            │
│  │   Clinic)   │  │   Hospital) │  │   Medical)  │            │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤            │
│  │ • Patients  │  │ • Patients  │  │ • Patients  │            │
│  │ • Staff     │  │ • Staff     │  │ • Staff     │            │
│  │ • Invoices  │  │ • Invoices  │  │ • Invoices  │            │
│  │ • Settings  │  │ • Settings  │  │ • Settings  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│  COMPLETE ISOLATION: Tenant A cannot see Tenant B's data      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Tenant Identification

Each tenant is identified by:

| Field | Purpose | Example |
|-------|---------|---------|
| `id` | Unique UUID | `ac8efa30-abb5-4ad3-b62c-76a35c680915` |
| `slug` | URL-friendly identifier | `amani-childrens-clinic` |
| `name` | Display name | `Amani Children's Clinic` |

### 3.4 Login URLs

```
# Tenant-specific login
https://hmisdemo.itsolutionsuganda.com/login/amani-childrens-clinic
https://hmisdemo.itsolutionsuganda.com/login/mulago-hospital

# System admin login (platform-level)
https://hmisdemo.itsolutionsuganda.com/system/login
```

### 3.5 Database Schema

Every table with tenant data includes a `tenant_id` column:

```sql
CREATE TABLE patients (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),  -- Tenant isolation
    full_name VARCHAR NOT NULL,
    date_of_birth DATE,
    -- ... other fields
);

-- Unique constraints are per-tenant
ALTER TABLE users ADD CONSTRAINT unique_username_per_tenant 
    UNIQUE (username, tenant_id);
```

---

## 4. Deployment Modes

Glide HIMS supports three deployment modes:

### 4.1 Mode Comparison

| Aspect | SaaS (Shared) | Dedicated Cloud | On-Premise |
|--------|---------------|-----------------|------------|
| Data Location | Your server | Your cloud (their region) | Their server |
| Who Manages | You | You | Customer + You |
| Internet Required | Yes | Yes | No |
| Pricing | Monthly subscription | Premium subscription | License + Support |
| Best For | Small clinics | Regional hospitals | Government |

### 4.2 Mode 1: Multi-Tenant SaaS

**Configuration:**
```bash
# .env
DEPLOYMENT_MODE=multi-tenant
DATABASE_URL=postgresql://glide_hims:password@localhost:5432/glide_hims
MULTI_TENANT=true
```

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR CENTRAL SERVER                          │
│              hmisdemo.itsolutionsuganda.com                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Single Application Instance                                    │
│  Single Database                                                │
│  Multiple Tenants (isolated by RLS)                            │
│                                                                 │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐          │
│  │Tenant A │Tenant B │Tenant C │Tenant D │   ...   │          │
│  └─────────┴─────────┴─────────┴─────────┴─────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Pros:**
- Single deployment to maintain
- Cost-effective
- Instant updates for all tenants
- Easy monitoring

**Cons:**
- Noisy neighbor potential
- No physical data isolation
- Shared backup schedule

### 4.3 Mode 2: Dedicated Cloud

**Configuration:**
```bash
# .env.mulago
DEPLOYMENT_MODE=dedicated
DATABASE_URL=postgresql://mulago:password@mulago-db:5432/mulago_hims
MULTI_TENANT=false
TENANT_ID=def-456
```

**Architecture:**
```
┌────────────────────────────────────────────────────────────────────┐
│                    DEDICATED INFRASTRUCTURE                        │
│                 mulago.itsolutionsuganda.com                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Dedicated App Server                                              │
│  Dedicated Database                                                │
│  Single Tenant Only                                                │
│  Managed by You                                                    │
│                                                                    │
│  Location: AWS Africa (Cape Town) / Azure South Africa            │
│  Data Residency: Guaranteed in-region                             │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**When to Use:**
- Customer requires data residency compliance
- Large hospital with high performance needs
- Customer pays premium for isolation

### 4.4 Mode 3: On-Premise

**Configuration:**
```bash
# .env.production
DEPLOYMENT_MODE=on-premise
DATABASE_URL=postgresql://hims:password@localhost:5432/hims
MULTI_TENANT=false
```

**Architecture:**
```
┌────────────────────────────────────────────────────────────────────┐
│                 CUSTOMER'S DATA CENTER                             │
│              hims.hospital.go.ug                                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Customer's Server Hardware                                        │
│  Customer's Network                                                │
│  Customer's IT Team Manages                                        │
│                                                                    │
│  Your Role: Software updates + Support                            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**When to Use:**
- Government hospitals (data sovereignty requirements)
- Military medical facilities
- Facilities without reliable internet
- Customer insists on full control

---

## 5. Security & Tenant Isolation

### 5.1 Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: Network Security                                      │
│  ├── HTTPS/TLS encryption                                       │
│  ├── Firewall rules                                             │
│  └── Rate limiting                                              │
│                                                                 │
│  Layer 2: Authentication                                        │
│  ├── JWT tokens with tenant_id                                  │
│  ├── Password hashing (bcrypt)                                  │
│  ├── MFA support (TOTP)                                         │
│  └── Session management                                         │
│                                                                 │
│  Layer 3: Authorization                                         │
│  ├── Role-based access control (RBAC)                          │
│  ├── Permission guards                                          │
│  └── Resource ownership validation                              │
│                                                                 │
│  Layer 4: Tenant Isolation                                      │
│  ├── Row-Level Security (RLS)                                   │
│  ├── Tenant interceptor                                         │
│  ├── Cross-tenant blocking                                      │
│  └── Foreign key constraints                                    │
│                                                                 │
│  Layer 5: Data Protection                                       │
│  ├── Audit logging                                              │
│  ├── Input validation                                           │
│  └── SQL injection prevention                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Row-Level Security (RLS)

PostgreSQL RLS automatically filters data by tenant:

```sql
-- Enable RLS on table
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY tenant_isolation_patients ON patients
    USING (tenant_id::text = current_setting('app.tenant_id', true)
           OR tenant_id IS NULL)
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true)
                OR tenant_id IS NULL);
```

**How it works:**
```sql
-- Application sets tenant context on each request
SELECT set_config('app.tenant_id', 'abc-123', true);

-- All queries automatically filtered
SELECT * FROM patients;
-- PostgreSQL executes as:
-- SELECT * FROM patients WHERE tenant_id = 'abc-123';
```

### 5.3 Tenant Interceptor

```typescript
// Every HTTP request passes through this
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;
    
    if (tenantId) {
      // Set PostgreSQL session variable for RLS
      await queryRunner.query(
        `SELECT set_config('app.tenant_id', $1, true)`, 
        [tenantId]
      );
    }
    
    return next.handle();
  }
}
```

### 5.4 Current Security Status

| Feature | Status | Tables/Entities |
|---------|--------|-----------------|
| RLS Enabled | ✅ | 196 tables |
| Tenant FK Constraints | ✅ | 194 tables |
| Username Unique/Tenant | ✅ | users |
| Email Unique/Tenant | ✅ | users |
| Audit Logging | ✅ | All changes |

---

## 6. Authentication System

### 6.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOGIN FLOW                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User visits /login/amani-clinic                            │
│                    │                                            │
│                    ▼                                            │
│  2. Frontend extracts slug, fetches tenant_id                  │
│                    │                                            │
│                    ▼                                            │
│  3. User enters credentials                                     │
│                    │                                            │
│                    ▼                                            │
│  4. POST /api/v1/auth/login                                    │
│     { username, password, tenantId }                           │
│                    │                                            │
│                    ▼                                            │
│  5. Backend validates:                                          │
│     • User exists in tenant                                     │
│     • Password matches                                          │
│     • Account not locked                                        │
│     • MFA (if enabled)                                          │
│                    │                                            │
│                    ▼                                            │
│  6. JWT issued with tenant_id embedded                         │
│                    │                                            │
│                    ▼                                            │
│  7. All subsequent requests include JWT                        │
│     Tenant isolation enforced automatically                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 User Types

| Type | Description | Scope |
|------|-------------|-------|
| Tenant User | Regular hospital staff | Single tenant |
| Tenant Admin | Hospital administrator | Single tenant |
| System Admin | Platform administrator | All tenants |

### 6.3 Rate Limiting

```
IP-Based Rate Limiting:
• Attempts 1-3: Normal login
• Attempts 4-5: Warning + 2-second delay
• Attempts 6+: Block IP for 15 minutes

Account Lockout (Database-backed):
• 10 failed attempts: Lock account for 30 minutes
• Auto-unlock after lockout period
• Admin can manually unlock
```

### 6.4 Same Username Across Tenants

The system allows the same username in different tenants:

```
Hospital A: elvis (user_id: abc, tenant_id: A)
Hospital B: elvis (user_id: xyz, tenant_id: B)

These are COMPLETELY SEPARATE users with:
• Different passwords
• Different profiles
• Different permissions
• No knowledge of each other
```

---

## 7. Licensing & Code Protection

### 7.1 Protection Strategies

For on-premise deployments, code protection is essential:

| Strategy | Protection Level | Effort |
|----------|-----------------|--------|
| Obfuscation | Low | Easy |
| Docker Images | Medium | Medium |
| License Keys | High | Medium |
| Phone-Home | Highest | Complex |

### 7.2 License Key System

```
┌─────────────────────────────────────────────────────────────────┐
│                   LICENSE VALIDATION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  License Key Contains:                                          │
│  • Customer ID                                                  │
│  • Hardware ID (server fingerprint)                            │
│  • Expiry date                                                  │
│  • Enabled modules                                              │
│  • Max users                                                    │
│  • Digital signature (only you can create)                     │
│                                                                 │
│  Validation:                                                    │
│  1. App starts → reads license file                            │
│  2. Verifies signature with public key                         │
│  3. Checks expiry date                                          │
│  4. Validates hardware ID matches server                       │
│  5. If invalid → app refuses to start                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Docker Deployment

```dockerfile
# Ship compiled code only - no source
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
# Only compiled JavaScript, no TypeScript source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

---

## 8. Updates & Maintenance

### 8.1 Update Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              FIX ONCE → DEPLOY EVERYWHERE                       │
│                                                                 │
│  • Single codebase for all customers                           │
│  • Bug fix applies to all deployments                          │
│  • No customer-specific code branches                          │
│  • Feature differences via configuration, not code             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Update Channels

| Channel | Audience | Update Frequency |
|---------|----------|------------------|
| Beta | Test clinics, early adopters | Weekly |
| Stable | Most customers | Monthly |
| LTS | Government, large hospitals | Quarterly |

### 8.3 SaaS Updates (Automatic)

```bash
# You control the server
git pull origin main
npm run build
pm2 restart glide-hims-backend

# All tenants updated instantly
```

### 8.4 On-Premise Updates

**Option A: Automatic (Internet Connected)**
```
App checks for updates daily
Admin sees notification in dashboard
Admin clicks "Update Now"
System auto-updates
```

**Option B: Offline Package**
```bash
# You create package
./scripts/create-update-package.sh v1.0.1

# Customer receives USB/download
# Customer runs installer
./install-update.sh --install
```

### 8.5 Update Package Contents

```
glide-hims-update-v1.0.1.tar.gz
├── docker-image.tar      # Compiled application
├── migrations/           # Database changes
├── install-update.sh     # Installer script
├── CHANGELOG.md          # What changed
├── checksum.sha256       # Integrity verification
└── signature.sig         # Proves authenticity
```

### 8.6 Rollback Procedure

```bash
# If update fails
./install-update.sh --rollback

# System restores:
# • Previous Docker image
# • Previous database state (from backup)
```

---

## 9. Feature Flags & Customization

### 9.1 Feature Flags

Same code runs everywhere, features toggled per tenant:

```typescript
// Check if feature enabled for tenant
if (await featureFlags.isEnabled('labModule', tenantId)) {
  // Show lab module
}

// Tenant settings in database
{
  "settings": {
    "enabledModules": ["patients", "billing", "lab"],
    "features": {
      "customReports": true,
      "apiAccess": false,
      "smsNotifications": true
    }
  }
}
```

### 9.2 Module Access by Plan

| Module | Basic | Pro | Enterprise |
|--------|-------|-----|------------|
| Patients | ✅ | ✅ | ✅ |
| Billing | ✅ | ✅ | ✅ |
| Lab | ❌ | ✅ | ✅ |
| Pharmacy | ❌ | ✅ | ✅ |
| Radiology | ❌ | ❌ | ✅ |
| API Access | ❌ | ❌ | ✅ |
| Custom Reports | ❌ | ❌ | ✅ |
| White Label | ❌ | ❌ | ✅ |

### 9.3 Branding Customization

```json
{
  "settings": {
    "branding": {
      "logo": "/uploads/hospital-logo.png",
      "primaryColor": "#1e40af",
      "hospitalName": "Mulago National Referral Hospital"
    }
  }
}
```

---

## 10. Operational Procedures

### 10.1 Adding New Tenant (SaaS)

```bash
# Via System Admin UI
1. Login to /system/login
2. Go to Organizations
3. Click "Add Organization"
4. Fill details (name, slug, admin email)
5. System creates tenant + admin user
6. Admin receives email with login link
```

### 10.2 Database Backup

```bash
# Manual backup
pg_dump -U glide_hims glide_hims_prod > backup_$(date +%Y%m%d).sql

# Automated (cron)
0 2 * * * /scripts/backup.sh
```

### 10.3 Monitoring

```bash
# PM2 process status
pm2 status

# Backend logs
pm2 logs glide-hims-backend

# Database connections
psql -c "SELECT * FROM pg_stat_activity;"
```

### 10.4 Health Checks

```bash
# API health
curl https://hmisdemo.itsolutionsuganda.com/api/v1/health

# Database health
psql -c "SELECT 1;"
```

---

## 11. Troubleshooting

### 11.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid credentials" | Wrong tenant context | Check login URL slug |
| "Account locked" | Too many failed attempts | Wait 30 min or admin unlock |
| "Tenant context required" | Missing tenant_id in JWT | Re-login |
| Data not showing | RLS filtering | Verify user's tenant_id |

### 11.2 Unlock User Account

```sql
-- Via database
UPDATE users 
SET failed_login_attempts = 0, locked_until = NULL 
WHERE username = 'elvis' AND tenant_id = 'xxx';

-- Via API (admin)
POST /api/v1/auth/admin/unlock/:userId
```

### 11.3 Reset Rate Limit

```bash
# Restart backend clears in-memory rate limits
pm2 restart glide-hims-backend

# Or via API
POST /api/v1/auth/admin/unblock-ip
{ "ip": "102.209.111.68" }
```

### 11.4 Emergency Support Access

```
1. Customer grants temporary access via dashboard
2. Support engineer gets time-limited credentials
3. All actions logged in audit trail
4. Access auto-expires after 4 hours
```

---

## Appendix A: Environment Variables

```bash
# Core
NODE_ENV=production
PORT=3000
APP_URL=https://hmisdemo.itsolutionsuganda.com

# Deployment
DEPLOYMENT_MODE=multi-tenant  # multi-tenant, on-premise, dedicated

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRATION=1h

# Optional
LICENSE_KEY=xxx
UPDATE_CHANNEL=stable  # beta, stable, lts
```

---

## Appendix B: API Endpoints

### Authentication
```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
```

### Admin
```
POST   /api/v1/auth/admin/unlock/:userId
GET    /api/v1/auth/admin/lockout-status/:userId
POST   /api/v1/auth/admin/unblock-ip
```

---

## Appendix C: Database Tables

Key tables: 199 total

| Category | Tables |
|----------|--------|
| Core | tenants, users, roles, permissions |
| Clinical | patients, encounters, diagnoses, prescriptions |
| Billing | invoices, payments, insurance_claims |
| Inventory | items, stock_balances, stock_transfers |
| HR | employees, attendance, payroll |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | April 2026 | Initial release |

---

**© 2026 IT Solutions Uganda. All rights reserved.**
