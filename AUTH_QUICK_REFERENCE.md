# Authentication & Authorization Quick Reference

## File Locations

### Decorators
- **@Public()** → `/root/glide-Hims/packages/backend/src/modules/auth/decorators/public.decorator.ts`
- **@Roles()** → `/root/glide-Hims/packages/backend/src/modules/auth/decorators/roles.decorator.ts`
- **@RequirePermissions()** → `/root/glide-Hims/packages/backend/src/modules/auth/decorators/permissions.decorator.ts`
- **@Auth()** → `/root/glide-Hims/packages/backend/src/modules/auth/decorators/auth.decorator.ts` (line 13)
- **@AuthWithPermissions()** → `/root/glide-Hims/packages/backend/src/modules/auth/decorators/auth.decorator.ts` (line 32)
- **@RequireFacilityAccess()** → `/root/glide-Hims/packages/backend/src/modules/auth/decorators/facility-access.decorator.ts`
- **@SkipEmployeeCheck()** → `/root/glide-Hims/packages/backend/src/modules/auth/decorators/skip-employee-check.decorator.ts`
- **@CurrentUser()** → `/root/glide-Hims/packages/backend/src/modules/auth/decorators/current-user.decorator.ts`

### Guards
- **GlobalJwtAuthGuard** → `/root/glide-Hims/packages/backend/src/modules/auth/guards/global-jwt.guard.ts`
- **RolesGuard** → `/root/glide-Hims/packages/backend/src/modules/auth/guards/roles.guard.ts`
- **PermissionsGuard** → `/root/glide-Hims/packages/backend/src/modules/auth/guards/permissions.guard.ts` (MAIN - lines 21-112)
- **EmployeeRequiredGuard** → `/root/glide-Hims/packages/backend/src/modules/auth/guards/employee-required.guard.ts`
- **FacilityGuard** → `/root/glide-Hims/packages/backend/src/modules/auth/guards/facility.guard.ts`
- **RateLimitGuard** → `/root/glide-Hims/packages/backend/src/modules/auth/guards/rate-limit.guard.ts`

### Core Files
- **JWT Strategy** → `/root/glide-Hims/packages/backend/src/modules/auth/strategies/jwt.strategy.ts`
- **Auth Service** → `/root/glide-Hims/packages/backend/src/modules/auth/auth.service.ts` (609 lines)
- **Auth Module** → `/root/glide-Hims/packages/backend/src/modules/auth/auth.module.ts`
- **Main Bootstrap** → `/root/glide-Hims/packages/backend/src/main.ts` (line 68)

### Database Entities
- **User** → `/root/glide-Hims/packages/backend/src/database/entities/user.entity.ts`
- **Role** → `/root/glide-Hims/packages/backend/src/database/entities/role.entity.ts`
- **Permission** → `/root/glide-Hims/packages/backend/src/database/entities/permission.entity.ts`
- **UserRole** → `/root/glide-Hims/packages/backend/src/database/entities/user-role.entity.ts`
- **RolePermission** → `/root/glide-Hims/packages/backend/src/database/entities/role-permission.entity.ts`
- **UserPermission** → `/root/glide-Hims/packages/backend/src/database/entities/user-permission.entity.ts`

---

## Quick Decision Matrix

### Which decorator should I use?

| Scenario | Decorator | Notes |
|----------|-----------|-------|
| Public endpoint (login, health) | `@Public()` | No JWT needed |
| Require specific roles | `@Auth('Doctor', 'Admin')` | User needs ONE role (OR logic) |
| Require specific permissions | `@AuthWithPermissions('users.read')` | User needs ALL perms (AND logic) |
| Just auth required | `@AuthWithPermissions()` | No specific permissions checked |
| Access current user | `@CurrentUser()` | Parameter decorator |
| Access specific user field | `@CurrentUser('email')` | Gets `req.user.email` |
| Skip employee check | `@SkipEmployeeCheck()` | For initial account setup |
| Require facility access | `@RequireFacilityAccess()` | With facilityId in request |

---

## Permission Resolution Summary

```
Request → GlobalJwtAuthGuard (validate JWT)
    ↓
    → PermissionsGuard (check permissions)
    ↓
    [Load from Database - NOT from JWT]
    ├─ UserRole (user's roles for facility)
    ├─ RolePermission (permissions for those roles)
    └─ UserPermission (direct user permissions)
    ↓
    [Check: requiredPermissions.every(p => userPerms.includes(p))]
    ↓
    → Controller Executes (request.user available)
```

**KEY**: Permissions are resolved from DB on **every request**. NOT cached in JWT.

---

## JWT Token Contents

```javascript
{
  "sub": "user-uuid",                    // User ID
  "username": "dr.smith",
  "email": "dr.smith@hospital.com",
  "tenantId": "tenant-uuid",             // Multi-tenant support
  "roles": ["Doctor", "Admin"],          // Role NAMES (not IDs)
  "facilityId": "facility-uuid",         // Optional facility
  "iat": 1705324245,
  "exp": 1705325145                      // 15min default expiry
}
```

**NOT in JWT**: Permission codes, role IDs, facility mappings

---

## Usage Examples

### Example 1: Public Endpoint
```typescript
@Post('login')
@Public()
async login(@Body() loginDto: LoginDto) {
  return this.authService.login(loginDto);
}
```

### Example 2: Role-Based Access
```typescript
@Post('users')
@Auth('Admin')
async createUser(@Body() dto: CreateUserDto) {
  return this.userService.create(dto);
}
```

### Example 3: Permission-Based Access
```typescript
@Get('discharge/:id')
@AuthWithPermissions('discharge.read')
async getDischarge(@Param('id') id: string, @CurrentUser('id') userId: string) {
  return this.dischargeService.findOne(id, userId);
}
```

### Example 4: Multiple Permissions
```typescript
@Post('billing')
@AuthWithPermissions('billing.create', 'billing.read')
async createBilling(@Body() dto: CreateBillingDto) {
  return this.billingService.create(dto);
}
```

### Example 5: Facility-Scoped
```typescript
@Get('patients')
@AuthWithPermissions('patients.read')
@RequireFacilityAccess()
async getPatients(
  @Request() req,
  @Query() filters: PatientFilterDto
) {
  const facilityId = req.headers['x-facility-id'];
  return this.patientService.list(filters, facilityId);
}
```

---

## Key Configuration

### Environment Variables
```bash
JWT_SECRET=min-32-chars-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=refresh-secret
JWT_REFRESH_EXPIRES_IN=7d
```

### Default Values
- Access Token Expiry: **15 minutes**
- Refresh Token Expiry: **7 days**
- Rate Limit: **5 attempts per 15 minutes**
- Account Lockout: **15 minutes after 5 failed attempts**
- Super Admin Role: **Bypasses all checks (logged)**

---

## Super Admin Behavior

✅ **Has all permissions automatically**
✅ **Bypasses role checks**
✅ **Bypasses permission checks**
✅ **Bypasses facility checks**
✅ **All bypasses are logged** to 'SuperAdminAudit' logger

```json
{
  "type": "SUPER_ADMIN_PERMISSION_BYPASS",
  "userId": "admin-uuid",
  "bypassedPermissions": ["users.create"],
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

---

## Permission Code Naming

Pattern: `{module}.{action}`

```
patients.read       → Can view patients
patients.create     → Can create patients
users.read          → Can view users
billing.collect_payment → Can collect payments
pharmacy.dispense   → Can dispense medicines
radiology.orders    → Can create radiology orders
```

---

## Database Query Summary

### Find User Permissions (what PermissionsGuard does)

```sql
-- Get user's roles for a facility
SELECT ur.* FROM user_roles ur
WHERE ur.user_id = $1
AND (ur.facility_id = $2 OR ur.facility_id IS NULL);

-- Get permissions for those roles
SELECT rp.*, p.* FROM role_permissions rp
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE rp.role_id = ANY($1);

-- Get direct user permissions
SELECT up.*, p.* FROM user_permissions up
LEFT JOIN permissions p ON up.permission_id = p.id
WHERE up.user_id = $1;

-- Combine all and check: user has ALL required permissions
SELECT COUNT(*) FROM (
  SELECT permission_code FROM [combined_permissions]
  WHERE permission_code = ANY($1)
) AS result
WHERE COUNT = ARRAY_LENGTH($1, 1);  -- Has all required
```

---

## Testing Checklist

- [ ] Public endpoints work without JWT
- [ ] Private endpoints return 401 without JWT
- [ ] JWT with invalid signature rejected
- [ ] Expired JWT returns 401
- [ ] Role checks return 403 with wrong role
- [ ] Permission checks return 403 with missing permission
- [ ] Super Admin bypasses role/permission checks
- [ ] Multiple permissions require ALL (AND logic)
- [ ] Facility scoping works correctly
- [ ] Rate limiting blocks after 5 attempts
- [ ] Account lockout works after 5 failed attempts
- [ ] Employee check skipped with @SkipEmployeeCheck()
- [ ] Permissions updated in DB are reflected immediately
- [ ] Super Admin bypasses logged correctly

---

## Troubleshooting

### 401 Unauthorized
- JWT missing or invalid
- JWT expired (default 15 min)
- JWT signature verification failed
- Check: Bearer token format in Authorization header

### 403 Forbidden
- User missing required permission
- User not in required role
- User doesn't have access to facility
- User lacks employee profile
- Check: `@AuthWithPermissions()` metadata and DB permissions

### Permission not working after role/permission change
- Permissions loaded from DB on each request (not cached)
- But JWT roles cached - user needs to login again
- Wait for next request and check database

### Super Admin has no access
- Check if role is named exactly "Super Admin"
- Check `isSuperAdmin()` function in roles.constants.ts
- Check permission assignment in auth.module.ts OnModuleInit()

---

## File Size Reference

| File | Size | Lines |
|------|------|-------|
| auth.service.ts | 20.2 KB | 609 |
| permissions.guard.ts | 5.5 KB | 175 |
| auth.decorator.ts | 1.2 KB | 46 |
| jwt.strategy.ts | 1.2 KB | 40 |
| global-jwt.guard.ts | 1.2 KB | 44 |
| roles.guard.ts | 1.8 KB | 57 |
| facility.guard.ts | 3.5 KB | 106 |

---

## Complete Documentation

Full audit report with detailed flows:
👉 **`/root/glide-Hims/AUTH_AUDIT_COMPREHENSIVE.md`** (1205 lines)

This quick reference:
👉 **`/root/glide-Hims/AUTH_QUICK_REFERENCE.md`**

