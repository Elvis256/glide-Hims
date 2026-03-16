# Authentication & Authorization Flow Diagrams

## 1. Complete Request Flow with @AuthWithPermissions('users.read')

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HTTP Request                                                             │
│ POST /api/v1/users                                                      │
│ Headers: { Authorization: "Bearer eyJhbGc..." }                         │
│ X-Facility-Id: "facility-456"                                           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. GLOBAL JWT AUTH GUARD (main.ts:68)                                   │
│ ─────────────────────────────────────────────────────────────────────── │
│ GlobalJwtAuthGuard extends AuthGuard('jwt')                             │
│                                                                          │
│ ┌─ Check @Public() metadata ──────────────────────────┐                 │
│ │ Found? → Return true (skip auth)                    │                 │
│ │ Not found? → Continue                               │                 │
│ └──────────────────────────────────────────────────────┘                 │
│                                                                          │
│ ┌─ Extract JWT from Authorization header ─────────────┐                 │
│ │ Verify signature with JWT_SECRET                    │                 │
│ │ Check expiration (ignoreExpiration: false)          │                 │
│ │ If invalid/expired → throw UnauthorizedException   │                 │
│ └──────────────────────────────────────────────────────┘                 │
│                                                                          │
│ ┌─ JwtStrategy.validate() ────────────────────────────┐                 │
│ │ Payload: {                                          │                 │
│ │   sub: "doctor-uuid",                              │                 │
│ │   username: "dr.smith",                            │                 │
│ │   email: "dr.smith@hospital.com",                  │                 │
│ │   roles: ["Doctor"],                               │                 │
│ │   facilityId: "facility-456",                       │                 │
│ │   tenantId: "tenant-uuid"                          │                 │
│ │ }                                                   │                 │
│ │ Return as request.user                              │                 │
│ └──────────────────────────────────────────────────────┘                 │
│                                                                          │
│ ✅ PASSED: request.user = {id, sub, username, email, roles, ...}      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. PERMISSIONS GUARD (permissions.guard.ts:21-112)                      │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                          │
│ ┌─ Get @RequirePermissions metadata ──────────────────┐                 │
│ │ Set by @AuthWithPermissions('users.read')           │                 │
│ │ requiredPermissions = ['users.read']                │                 │
│ └──────────────────────────────────────────────────────┘                 │
│                                                                          │
│ ┌─ Check if no permissions required ──────────────────┐                 │
│ │ if (!requiredPermissions || length === 0)           │                 │
│ │ → return true (allow access)                        │                 │
│ │ else → continue                                     │                 │
│ └──────────────────────────────────────────────────────┘                 │
│                                                                          │
│ ┌─ Check if Super Admin ──────────────────────────────┐                 │
│ │ if (isSuperAdmin(user.roles))                       │                 │
│ │ → Log to 'SuperAdminAudit' logger                   │                 │
│ │ → return true (bypass)                              │                 │
│ └──────────────────────────────────────────────────────┘                 │
│                                                                          │
│ ┌─ Extract facilityId from request ───────────────────┐                 │
│ │ Priority:                                           │                 │
│ │ 1. x-facility-id header → "facility-456"           │                 │
│ │ 2. facilityId query param                           │                 │
│ │ 3. facilityId in body                               │                 │
│ │ 4. facilityId in route params                       │                 │
│ └──────────────────────────────────────────────────────┘                 │
│                                                                          │
│ ┌─ DATABASE QUERY 1: Get User Roles ──────────────────┐                 │
│ │ SELECT ur.* FROM user_roles ur                     │                 │
│ │ WHERE ur.user_id = 'doctor-uuid'                   │                 │
│ │ AND (ur.facility_id = 'facility-456'               │                 │
│ │      OR ur.facility_id IS NULL)                    │                 │
│ │                                                     │                 │
│ │ Result: [UserRole {                                │                 │
│ │   roleId: 'doctor-role-uuid',                      │                 │
│ │   facilityId: 'facility-456'                       │                 │
│ │ }]                                                  │                 │
│ └──────────────────────────────────────────────────────┘                 │
│                                                                          │
│ ┌─ DATABASE QUERY 2: Get Role Permissions ────────────┐                 │
│ │ SELECT rp.*, p.* FROM role_permissions rp          │                 │
│ │ LEFT JOIN permissions p ON rp.permission_id = p.id │                 │
│ │ WHERE rp.role_id IN ('doctor-role-uuid')           │                 │
│ │                                                     │                 │
│ │ Result: [RolePermission {                          │                 │
│ │   permission: {code: 'users.read', ...},           │                 │
│ │   permission: {code: 'patients.read', ...},        │                 │
│ │   permission: {code: 'vitals.create', ...},        │                 │
│ │   ...                                               │                 │
│ │ }]                                                  │                 │
│ │                                                     │                 │
│ │ Collected codes: ['users.read', 'patients.read',   │                 │
│ │                   'vitals.create', ...]            │                 │
│ └──────────────────────────────────────────────────────┘                 │
│                                                                          │
│ ┌─ DATABASE QUERY 3: Get Direct User Permissions ────┐                 │
│ │ SELECT up.*, p.* FROM user_permissions up          │                 │
│ │ LEFT JOIN permissions p ON up.permission_id = p.id │                 │
│ │ WHERE up.user_id = 'doctor-uuid'                   │                 │
│ │                                                     │                 │
│ │ Result: [] (no direct permissions in this case)    │                 │
│ └──────────────────────────────────────────────────────┘                 │
│                                                                          │
│ ┌─ Check required permissions (AND logic) ────────────┐                 │
│ │ requiredPermissions.every(perm =>                  │                 │
│ │   userPermissionCodes.includes(perm)               │                 │
│ │ )                                                   │                 │
│ │                                                     │                 │
│ │ Required: ['users.read']                           │                 │
│ │ User has: ['users.read', 'patients.read', ...]     │                 │
│ │ Check: 'users.read' in user.has? → YES              │                 │
│ │ Result: TRUE                                        │                 │
│ └──────────────────────────────────────────────────────┘                 │
│                                                                          │
│ ✅ PASSED: User has required permissions                               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. CONTROLLER EXECUTES                                                   │
│                                                                          │
│ @Post('users')                                                           │
│ @AuthWithPermissions('users.read')                                      │
│ async getUsers(                                                          │
│   @Request() req,          // req.user available!                       │
│   @CurrentUser() user      // or inject specific fields                 │
│ ) {                                                                      │
│   const facilityId = req.headers['x-facility-id'];                      │
│   return this.userService.list(facilityId);                            │
│ }                                                                        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. RESPONSE                                                              │
│ HTTP 200 OK                                                              │
│ [{ id: '...', username: '...', email: '...', ... }]                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Permission Check Logic Detailed

```
┌─────────────────────────────────────────────────────────────┐
│ SCENARIO: @AuthWithPermissions('users.read', 'users.create')│
└─────────────────────────────────────────────────────────────┘

User has permissions from roles: ['users.read', 'patients.read']
Direct permissions: ['users.create']
Combined: ['users.read', 'patients.read', 'users.create']

Required: ['users.read', 'users.create']

Check using: requiredPermissions.EVERY(perm => userHas.includes(perm))

  'users.read' in ['users.read', 'patients.read', 'users.create']?   ✅ YES
  'users.create' in ['users.read', 'patients.read', 'users.create']? ✅ YES

Result: ✅ ALLOWED (user has ALL required permissions)


┌─────────────────────────────────────────────────────────────┐
│ SCENARIO: User missing one permission                       │
└─────────────────────────────────────────────────────────────┘

User has permissions from roles: ['users.read']
Direct permissions: []
Combined: ['users.read']

Required: ['users.read', 'users.delete']

Check:
  'users.read' in ['users.read']?    ✅ YES
  'users.delete' in ['users.read']?  ❌ NO

Result: ❌ FORBIDDEN (403) - User missing: ['users.delete']
        Access logged to 'SuperAdminAudit' logger
```

---

## 3. Decorator Decision Tree

```
┌─ Is endpoint public?
│
├─ YES → Use @Public()
│       └─ No authentication required
│          (login, health checks, docs)
│
└─ NO → Authentication required
        
        ├─ Need role-based access control?
        │
        │ ├─ YES → Use @Auth('Admin', 'Doctor')
        │ │       └─ User needs ONE of these roles (OR logic)
        │ │          Checked in-memory from JWT
        │ │
        │ └─ NO → Continue
        │
        └─ Need permission-based access control?
         
         ├─ YES → Use @AuthWithPermissions('users.read')
         │       ├─ User needs ALL these permissions (AND logic)
         │       ├─ Checked from database on every request
         │       └─ Can have multiple:
         │           @AuthWithPermissions('users.read', 'users.create')
         │
         └─ NO → Use @AuthWithPermissions() [just auth]
                └─ Just requires valid JWT, no specific role/permission
```

---

## 4. Guard Execution Order

```
Request →┐
         │
         ├─→ GlobalJwtAuthGuard ◄─── Registered globally (main.ts:68)
         │   ├─ Check @Public()
         │   └─ Validate JWT → request.user
         │
         ├─→ PermissionsGuard ◄──── Applied via @AuthWithPermissions()
         │   ├─ Get @RequirePermissions metadata
         │   ├─ Load permissions from database
         │   └─ Check: user has ALL required permissions
         │
         ├─→ [Optional] RolesGuard ◄── Applied via @Auth()
         │   ├─ Get @Roles metadata
         │   └─ Check: user has ANY required role
         │
         ├─→ [Optional] FacilityGuard ◄── Applied via @RequireFacilityAccess()
         │   ├─ Get @RequireFacilityAccess metadata
         │   └─ Check: user has access to facility
         │
         └─→ Controller Method Executes
            └─ request.user available for use
```

---

## 5. Multi-Facility Permission Checking

```
┌───────────────────────────────────────────────────────────────┐
│ Doctor assigned to Facility A and Facility B                  │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ Database:                                                     │
│   UserRole { userId: doc1, roleId: doctor, facilityId: A }   │
│   UserRole { userId: doc1, roleId: doctor, facilityId: B }   │
│                                                               │
│ ┌─ Request for Facility A ────────────────────────────────┐   │
│ │ GET /patients?facilityId=A                             │   │
│ │                                                          │   │
│ │ Load roles WHERE userId=doc1 AND facilityId=A → [role]│   │
│ │ Load permissions for that role → [perm1, perm2, ...]  │   │
│ │ Check: user has required permission for Facility A     │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌─ Request for Facility C ────────────────────────────────┐   │
│ │ GET /patients?facilityId=C                             │   │
│ │                                                          │   │
│ │ Load roles WHERE userId=doc1 AND facilityId=C → []     │   │
│ │ No roles for Facility C                                 │   │
│ │ No permissions found                                    │   │
│ │ Result: ❌ FORBIDDEN (403)                             │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                               │
│ NOTE: Global roles (facilityId IS NULL) apply to ALL        │
│       facility requests                                      │
└───────────────────────────────────────────────────────────────┘
```

---

## 6. Super Admin Bypass Flow

```
┌─────────────────────────────────────────────┐
│ User logged in with "Super Admin" role      │
│ JWT payload: { roles: ["Super Admin"], ... }│
└─────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│ Request: GET /users with @AuthWithPermissions()       │
└─────────────────────────────────────────────────────────┘
            │
            ├─→ GlobalJwtAuthGuard: ✅ JWT valid
            │
            ├─→ PermissionsGuard:
            │   ├─ Check: isSuperAdmin(user.roles)?
            │   ├─ Found "Super Admin" in roles: TRUE
            │   │
            │   ├─→ LOG TO 'SuperAdminAudit' logger:
            │   │   {
            │   │     "type": "SUPER_ADMIN_PERMISSION_BYPASS",
            │   │     "userId": "admin-uuid",
            │   │     "username": "superadmin@hospital.com",
            │   │     "bypassedPermissions": ["users.create"],
            │   │     "ip": "192.168.1.100",
            │   │     "method": "GET",
            │   │     "path": "/api/v1/users",
            │   │     "timestamp": "2024-01-15T10:30:45.123Z"
            │   │   }
            │   │
            │   └─→ return true (allow access)
            │
            └─→ Controller executes normally
               (permissions database check SKIPPED)
```

---

## 7. JWT Token Lifecycle

```
┌────────────────────────────────────────────────────────────┐
│ 1. LOGIN REQUEST                                            │
│ POST /auth/login { username, password }                     │
└────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│ 2. AUTH.SERVICE VALIDATES                                   │
│ - Check username/password                                   │
│ - Check if account is active                                │
│ - Check if account is locked (failed attempts)             │
│ - Validate MFA if enabled                                   │
│ - Load user roles                                           │
│ - Load user permissions                                    │
│ - Update lastLoginAt                                        │
│ - Increment failedLoginAttempts OR reset on success        │
└────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│ 3. GENERATE TOKENS                                          │
│                                                             │
│ Access Token (short-lived):                                │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ {                                                    │  │
│ │   "sub": "user-uuid",                              │  │
│ │   "username": "dr.smith",                          │  │
│ │   "email": "dr.smith@hospital.com",               │  │
│ │   "roles": ["Doctor"],                            │  │
│ │   "tenantId": "tenant-uuid",                      │  │
│ │   "facilityId": "facility-uuid",                  │  │
│ │   "iat": 1705324245,                              │  │
│ │   "exp": 1705325145  ← 15 minutes later           │  │
│ │ }                                                   │  │
│ │                                                     │  │
│ │ Signed with JWT_SECRET                            │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                             │
│ Refresh Token (long-lived):                                │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ Same payload but:                                   │  │
│ │ "exp": 1705929045  ← 7 days later                  │  │
│ │                                                     │  │
│ │ Signed with JWT_REFRESH_SECRET                    │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                             │
│ Permissions (included in response but NOT in JWT):        │
│ ['users.read', 'patients.read', 'vitals.create', ...]    │
│ (Loaded from database on each request)                    │
└────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│ 4. RETURN TO CLIENT                                         │
│ 200 OK {                                                    │
│   "accessToken": "eyJhbGc...",                             │
│   "refreshToken": "eyJhbGc...",                            │
│   "expiresIn": 900,         ← seconds (15 min)             │
│   "user": {                                                │
│     "id": "...",                                           │
│     "username": "dr.smith",                                │
│     "roles": ["Doctor"],                                   │
│     "permissions": ["users.read", ...],                   │
│     "facility": { ... }                                    │
│   }                                                         │
│ }                                                           │
└────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│ 5. CLIENT USES ACCESS TOKEN                                │
│ GET /api/v1/users                                           │
│ Headers: { Authorization: "Bearer eyJhbGc..." }            │
└────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│ 6. SERVER VALIDATES TOKEN                                   │
│ - Extract from "Bearer " header                            │
│ - Verify signature with JWT_SECRET                         │
│ - Check expiration                                         │
│ - If valid: use payload, if expired: return 401            │
└────────────────────────────────────────────────────────────┘
                        │
                        ├─→ STILL VALID: Request proceeds
                        │
                        └─→ EXPIRED: Return 401 Unauthorized
                            Client uses refreshToken to get new accessToken
```

---

## 8. Error Responses

```
┌─────────────────────────────────┐  Error
│ Missing JWT                      │  401 Unauthorized
│ Invalid JWT signature            │  (UnauthorizedException)
│ Expired JWT                      │
└─────────────────────────────────┘

┌─────────────────────────────────┐  Error
│ Wrong role for endpoint          │  403 Forbidden
│ Missing required permission      │  (ForbiddenException)
│ No access to facility            │
│ No employee profile              │
└─────────────────────────────────┘

┌─────────────────────────────────┐  Error
│ Too many login attempts (5)      │  429 Too Many Requests
│ IP blocked for 15 minutes        │  (HttpException)
└─────────────────────────────────┘
```

---

## 9. Database Schema Relationships

```
┌──────────┐
│ USER     │
│          │
│ id (PK)  │
│ username │
│ email    │
└──┬───────┘
   │
   │ 1:Many
   │
   ▼
┌─────────────────┐
│ USER_ROLE       │
│                 │
│ userId  (FK)    │ ◄──┐
│ roleId  (FK)    │    │ Many:1
│ facilityId (FK) │    │
│ departmentId    │    │
└─────────────────┘    │
                       │
                       ▼
                  ┌──────────┐
                  │ ROLE     │
                  │          │
                  │ id (PK)  │
                  │ name     │
                  └──┬───────┘
                     │
                     │ 1:Many
                     │
                     ▼
              ┌──────────────────┐
              │ ROLE_PERMISSION  │
              │                  │
              │ roleId   (FK)    │ ◄──┐
              │ permissionId (FK)│    │ Many:1
              └──────────────────┘    │
                                      │
                                      ▼
                                 ┌─────────────┐
                                 │ PERMISSION  │
                                 │             │
                                 │ id (PK)     │
                                 │ code        │ ← e.g. 'users.read'
                                 │ name        │
                                 │ module      │
                                 └─────────────┘

┌──────────┐
│ USER (2) │
│ id (PK)  │
└──┬───────┘
   │
   │ 1:Many (direct permissions)
   │
   ▼
┌──────────────────────┐
│ USER_PERMISSION      │
│                      │
│ userId  (FK)   ◄─────┼─ User can have direct permissions
│ permissionId (FK)    │   (in addition to role permissions)
│ grantedBy (FK)       │   Useful for exceptions/overrides
│ grantedAt            │
│ notes                │
└────────┬─────────────┘
         │
         │ Many:1
         │
         ▼
    ┌─────────────┐
    │ PERMISSION  │
    │             │
    │ id (PK)     │
    │ code        │
    │ name        │
    │ module      │
    └─────────────┘
```

---

## 10. Configuration Priority for Facility ID

When a permission check happens, facility is determined in this order:

```
Priority 1: x-facility-id HEADER
   └─ GET /api/v1/patients
      Headers: { "x-facility-id": "facility-123" }

Priority 2: facilityId QUERY PARAMETER
   └─ GET /api/v1/patients?facilityId=facility-123

Priority 3: facilityId IN BODY
   └─ POST /api/v1/vitals
      { "patientId": "...", "facilityId": "facility-123", ... }

Priority 4: facilityId IN ROUTE PARAMS
   └─ GET /api/v1/facilities/facility-123/patients

Priority 5: facilityId FROM JWT (last resort)
   └─ Only if none of above specified

No facility ID found?
   └─ For PermissionsGuard: Continue (no facility filtering)
   └─ For FacilityGuard: throw ForbiddenException("Facility context required")
```

