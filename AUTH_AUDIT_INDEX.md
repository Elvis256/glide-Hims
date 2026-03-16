# Authentication & Authorization System - Complete Audit Index

## 📋 Overview

This audit provides a complete analysis of the Glide-HIMS authentication and authorization system. Three comprehensive documents have been generated:

---

## 📄 Generated Documents

### 1. **AUTH_AUDIT_COMPREHENSIVE.md** (1205 lines)
Complete technical documentation with full code implementations.

**Contents**:
- Section 1: Auth Decorators Analysis (8 decorators)
- Section 2: Guards Analysis (6 guards)
- Section 3: @AuthWithPermissions Complete Flow
- Section 4: Permission Resolution System
- Section 5: JWT Payload Analysis
- Section 6: Guard Execution Order
- Section 7: Super Admin Behavior
- Section 8: Security Features & Audit Logging
- Section 9: Summary Table
- Section 10: Permission Code Examples
- Section 11: Complete Request Flow Example
- Section 12: Environment Variables

**Use this for**: Deep technical understanding, debugging, code reviews

---

### 2. **AUTH_QUICK_REFERENCE.md** (200+ lines)
Quick lookup guide with file locations and examples.

**Contents**:
- File Locations (all files with paths)
- Quick Decision Matrix (which decorator to use)
- Permission Resolution Summary
- JWT Token Contents
- 5 Complete Usage Examples
- Key Configuration
- Super Admin Behavior
- Permission Code Naming
- Database Query Summary
- Testing Checklist
- Troubleshooting Guide

**Use this for**: Day-to-day development, quick lookups, integration

---

### 3. **AUTH_FLOW_DIAGRAMS.md** (400+ lines)
Visual flowcharts and ASCII diagrams.

**Contents**:
- Diagram 1: Complete Request Flow (with @AuthWithPermissions)
- Diagram 2: Permission Check Logic
- Diagram 3: Decorator Decision Tree
- Diagram 4: Guard Execution Order
- Diagram 5: Multi-Facility Permission Checking
- Diagram 6: Super Admin Bypass Flow
- Diagram 7: JWT Token Lifecycle
- Diagram 8: Error Responses
- Diagram 9: Database Schema Relationships
- Diagram 10: Configuration Priority for Facility ID

**Use this for**: Understanding architecture, presentations, onboarding

---

## 🔍 Key Findings Summary

### 1. Decorators Found (8 total)

| Decorator | Purpose | Location |
|-----------|---------|----------|
| `@Public()` | Skip authentication | public.decorator.ts:10 |
| `@Roles()` | Require specific roles | roles.decorator.ts:4 |
| `@RequirePermissions()` | Require specific permissions | permissions.decorator.ts:8 |
| `@Auth()` | Composite: JWT + Roles | auth.decorator.ts:13-26 |
| `@AuthWithPermissions()` | **MAIN**: JWT + Permissions | auth.decorator.ts:32-45 |
| `@RequireFacilityAccess()` | Facility access validation | facility-access.decorator.ts:10 |
| `@SkipEmployeeCheck()` | Skip employee requirement | skip-employee-check.decorator.ts:9 |
| `@CurrentUser()` | Inject user into parameters | current-user.decorator.ts:3 |

---

### 2. Guards Found (6 total)

| Guard | Purpose | Location | Type |
|-------|---------|----------|------|
| GlobalJwtAuthGuard | Global JWT validation | global-jwt.guard.ts:17 | Global |
| RolesGuard | Role-based access | roles.guard.ts:7 | Per-route |
| **PermissionsGuard** | **Permission checking (MAIN)** | **permissions.guard.ts:13** | **Per-route** |
| EmployeeRequiredGuard | Employee profile validation | employee-required.guard.ts:19 | Per-route |
| FacilityGuard | Facility access validation | facility.guard.ts:15 | Per-route |
| RateLimitGuard | Brute force protection | rate-limit.guard.ts:26 | Per-route |

---

### 3. Core Authentication Flow

```
HTTP Request
    ↓
GlobalJwtAuthGuard (validates JWT)
    ├─ Checks @Public() decorator
    ├─ Validates JWT signature & expiry
    └─ Extracts user object
    ↓
PermissionsGuard (checks permissions from DB)
    ├─ Gets required permissions from metadata
    ├─ Loads user roles from database
    ├─ Loads role permissions from database
    ├─ Loads direct user permissions from database
    └─ Checks: user has ALL required permissions (AND logic)
    ↓
Controller executes
    └─ request.user available
```

---

### 4. Critical Design Decisions

#### ✅ Permissions from Database, Not JWT
- **NOT stored in JWT token**: Only role names are in JWT
- **Loaded on every request**: From three sources:
  1. `role_permissions` (via user's roles)
  2. `user_permissions` (direct permissions)
  3. Combined and deduplicated
- **Benefit**: Permission changes take effect immediately
- **Trade-off**: Extra database queries on every request

#### ✅ Facility-Scoped Roles
- Users can have different roles in different facilities
- `UserRole` table has optional `facilityId` column
- Query filters by facility automatically
- Global roles (facilityId IS NULL) apply to all facilities

#### ✅ Super Admin Automatic Bypass
- Users with "Super Admin" role bypass all checks
- **Logged to 'SuperAdminAudit' logger** for security
- All Super Admin access is traceable
- Permissions auto-assigned on module init

#### ✅ AND Logic for Multiple Permissions
- `@AuthWithPermissions('users.read', 'users.delete')`
- User must have BOTH permissions
- Uses `every()` not `some()`

#### ✅ OR Logic for Roles
- `@Auth('Admin', 'Doctor')`
- User must have ONE role
- Uses `some()` not `every()`

---

### 5. Security Features

| Feature | Implementation | Details |
|---------|-----------------|---------|
| **Account Lockout** | 5 failed attempts → 15 min lock | auth.service.ts:94-96 |
| **Rate Limiting** | 5 login attempts / 15 min per IP | rate-limit.guard.ts:28-30 |
| **JWT Expiry** | 15 minutes default | auth.module.ts:35 |
| **Refresh Tokens** | 7 days expiry | auth.service.ts:215-217 |
| **Super Admin Logging** | All bypasses logged | permissions.guard.ts:138-153 |
| **Access Denied Logging** | Denied attempts logged | permissions.guard.ts:159-173 |
| **Helmet Security** | HTTP security headers | main.ts:54-57 |
| **MFA Support** | TOTP validation if enabled | auth.service.ts:125-141 |

---

## 🚀 How to Use These Documents

### For Implementation
1. Read **AUTH_QUICK_REFERENCE.md** - "Which decorator should I use?"
2. Find usage examples in same document
3. Copy-paste the example to your controller

### For Code Review
1. Read **AUTH_AUDIT_COMPREHENSIVE.md** - Section on specific guard/decorator
2. Check line numbers and implementation details
3. Review against security best practices

### For Debugging Permission Issues
1. Check **AUTH_QUICK_REFERENCE.md** - "Troubleshooting" section
2. Review **AUTH_FLOW_DIAGRAMS.md** - "Complete Request Flow"
3. Trace through PermissionsGuard logic (main.ts:21-112)
4. Check database queries and user roles

### For Architecture Discussion
1. Use **AUTH_FLOW_DIAGRAMS.md** - visual flowcharts
2. Reference **AUTH_AUDIT_COMPREHENSIVE.md** - Section 3 & 4
3. Discuss design decisions in Section 4 of this index

### For Onboarding New Developers
1. Start with **AUTH_QUICK_REFERENCE.md** - "File Locations"
2. Then **AUTH_FLOW_DIAGRAMS.md** - visual understanding
3. Then **AUTH_AUDIT_COMPREHENSIVE.md** - deep dive
4. Assign testing checklist tasks

---

## 📊 File Statistics

| Document | Size | Lines | Focus |
|----------|------|-------|-------|
| AUTH_AUDIT_COMPREHENSIVE.md | 70 KB | 1205 | Complete technical reference |
| AUTH_QUICK_REFERENCE.md | 25 KB | 250+ | Developer quick guide |
| AUTH_FLOW_DIAGRAMS.md | 70 KB | 400+ | Visual architecture |
| AUTH_AUDIT_INDEX.md | This file | ~300 | Navigation & summary |

**Total**: ~165 KB of comprehensive documentation

---

## 🔗 Key File Locations Quick Map

```
packages/backend/src/
├── modules/auth/
│   ├── decorators/
│   │   ├── public.decorator.ts
│   │   ├── roles.decorator.ts
│   │   ├── permissions.decorator.ts
│   │   ├── auth.decorator.ts ← @Auth() & @AuthWithPermissions()
│   │   ├── facility-access.decorator.ts
│   │   ├── skip-employee-check.decorator.ts
│   │   └── current-user.decorator.ts
│   ├── guards/
│   │   ├── global-jwt.guard.ts ← Applied globally
│   │   ├── roles.guard.ts
│   │   ├── permissions.guard.ts ← MAIN permission logic
│   │   ├── employee-required.guard.ts
│   │   ├── facility.guard.ts
│   │   └── rate-limit.guard.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts ← JWT validation
│   ├── auth.service.ts ← Token creation & login logic
│   └── auth.module.ts ← Module setup & auto-permissions
├── database/entities/
│   ├── user.entity.ts
│   ├── role.entity.ts
│   ├── permission.entity.ts
│   ├── user-role.entity.ts ← Links users to roles
│   ├── role-permission.entity.ts ← Links roles to permissions
│   └── user-permission.entity.ts ← Direct user permissions
└── main.ts ← Line 68: GlobalJwtAuthGuard registration
```

---

## ✅ Audit Checklist

- [x] Found all 8 auth decorators
  - [x] @Public()
  - [x] @Roles()
  - [x] @RequirePermissions()
  - [x] @Auth()
  - [x] @AuthWithPermissions() ← **PRIMARY DECORATOR**
  - [x] @RequireFacilityAccess()
  - [x] @SkipEmployeeCheck()
  - [x] @CurrentUser()

- [x] Found all 6 guards
  - [x] GlobalJwtAuthGuard
  - [x] RolesGuard
  - [x] PermissionsGuard ← **MAIN PERMISSION LOGIC**
  - [x] EmployeeRequiredGuard
  - [x] FacilityGuard
  - [x] RateLimitGuard

- [x] Analyzed @AuthWithPermissions():
  - [x] No arguments behavior
  - [x] With permissions behavior
  - [x] Database lookup logic
  - [x] Complete request flow

- [x] Analyzed permission resolution:
  - [x] User role loading
  - [x] Permission loading
  - [x] Direct user permissions
  - [x] Facility scoping
  - [x] Super Admin bypass

- [x] Analyzed JWT:
  - [x] Payload structure
  - [x] Token creation
  - [x] Token validation
  - [x] Expiry handling
  - [x] Refresh token logic

---

## 🎯 Next Steps

1. **Review**: Read AUTH_QUICK_REFERENCE.md (5 min)
2. **Understand**: Review AUTH_FLOW_DIAGRAMS.md (10 min)
3. **Deep Dive**: Reference AUTH_AUDIT_COMPREHENSIVE.md as needed
4. **Implement**: Use examples to add auth to your endpoints
5. **Test**: Run through the testing checklist
6. **Ask Questions**: Refer back to these documents with specific questions

---

## 📞 Common Questions Answered

**Q: Where should I apply @AuthWithPermissions()?**
A: On every endpoint that needs authentication. See AUTH_QUICK_REFERENCE.md for examples.

**Q: Are permissions cached in JWT?**
A: NO - they're loaded from database on every request. See AUTH_AUDIT_COMPREHENSIVE.md Section 4.

**Q: What about Super Admin?**
A: All checks are bypassed but logged. See AUTH_QUICK_REFERENCE.md "Super Admin Behavior" section.

**Q: How do I add a new permission?**
A: Insert into `permissions` table, assign to roles in `role_permissions`, then use in `@AuthWithPermissions('new.permission')`.

**Q: Do permissions take effect immediately?**
A: YES - loaded from DB on each request. JWT needs refresh for role changes.

---

## 📋 Related Files to Review

- `/root/glide-Hims/packages/backend/src/common/constants/roles.constants.ts` - Role and permission definitions
- `/root/glide-Hims/packages/backend/src/modules/auth/auth.controller.ts` - Login endpoint examples
- `/root/glide-Hims/packages/backend/src/modules/in-app-notifications/in-app-notifications.controller.ts` - @AuthWithPermissions() usage example
- `/root/glide-Hims/packages/backend/src/modules/discharge/discharge.controller.ts` - Multi-permission example

---

**Generated**: January 2024
**Scope**: Complete authentication and authorization system audit
**Coverage**: All decorators, guards, JWT strategy, and permission resolution

