# COMPREHENSIVE AUTHENTICATION & AUTHORIZATION AUDIT

## 1. AUTH DECORATORS ANALYSIS

### Overview
The system uses a modular decorator architecture built on NestJS decorators for flexible auth control.

### 1.1 @Public() Decorator
**File**: `/root/glide-Hims/packages/backend/src/modules/auth/decorators/public.decorator.ts` (Lines 1-10)

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

**Purpose**: Marks endpoints as publicly accessible without authentication
**Usage**: Applied to endpoints like login, health checks, etc.
**Metadata Key**: `IS_PUBLIC_KEY = 'isPublic'`

---

### 1.2 @Roles() Decorator
**File**: `/root/glide-Hims/packages/backend/src/modules/auth/decorators/roles.decorator.ts` (Lines 1-5)

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

**Purpose**: Requires user to have one of the specified roles
**Usage**: `@Roles('Admin', 'Doctor')`
**Metadata Key**: `ROLES_KEY = 'roles'`
**Validation**: Checked by `RolesGuard`

---

### 1.3 @RequirePermissions() Decorator
**File**: `/root/glide-Hims/packages/backend/src/modules/auth/decorators/permissions.decorator.ts` (Lines 1-9)

```typescript
import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../guards/permissions.guard';

export const RequirePermissions = (...permissions: string[]) => 
  SetMetadata(PERMISSIONS_KEY, permissions);
```

**Purpose**: Requires user to have ALL specified permission codes
**Usage**: `@RequirePermissions('patients.read', 'patients.create')`
**Metadata Key**: `PERMISSIONS_KEY = 'permissions'`
**Validation**: Checked by `PermissionsGuard` with DB lookup

---

### 1.4 @Auth() & @AuthWithPermissions() - Composite Decorators
**File**: `/root/glide-Hims/packages/backend/src/modules/auth/decorators/auth.decorator.ts` (Lines 1-45)

```typescript
import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { RolesGuard } from '../guards/roles.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Roles } from './roles.decorator';
import { RequirePermissions } from './permissions.decorator';

/**
 * Auth decorator for protecting endpoints with roles
 * @param roles - Role names (e.g., 'Admin', 'Doctor')
 */
export function Auth(...roles: string[]) {
  const decorators = [
    UseGuards(AuthGuard('jwt'), RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  ];

  if (roles.length > 0) {
    decorators.unshift(Roles(...roles));
  }

  return applyDecorators(...decorators);
}

/**
 * AuthWithPermissions decorator for protecting endpoints with permissions
 * @param permissions - Permission codes (e.g., 'patients.read', 'patients.create')
 */
export function AuthWithPermissions(...permissions: string[]) {
  const decorators = [
    UseGuards(AuthGuard('jwt'), PermissionsGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
    ApiForbiddenResponse({ description: 'Insufficient permissions' }),
  ];

  if (permissions.length > 0) {
    decorators.unshift(RequirePermissions(...permissions));
  }

  return applyDecorators(...decorators);
}
```

**Auth() Behavior**:
- Applies JWT authentication guard
- Applies RolesGuard for role-based access
- With roles: `@Auth('Admin', 'Doctor')` - user must have one of these roles
- Without roles: `@Auth()` - just requires authentication

**AuthWithPermissions() Behavior**:
- Applies JWT authentication guard
- Applies PermissionsGuard for permission-based access
- With permissions: `@AuthWithPermissions('users.read')` - user must have ALL permissions
- Without permissions: `@AuthWithPermissions()` - just requires authentication
- Performs database lookup on each request to check permissions

**Real Examples**:
```typescript
// With permissions
@AuthWithPermissions('discharge.create')
async create(@Body() dto: CreateDischargeSummaryDto) { }

// Without permissions (just auth required)
@AuthWithPermissions()
async getNotifications() { }
```

---

### 1.5 Other Decorators

**@RequireFacilityAccess()**
**File**: `/root/glide-Hims/packages/backend/src/modules/auth/decorators/facility-access.decorator.ts`
- Sets metadata for facility validation
- Checked by `FacilityGuard`
- Verifies user has active role for target facility

**@SkipEmployeeCheck()**
**File**: `/root/glide-Hims/packages/backend/src/modules/auth/decorators/skip-employee-check.decorator.ts`
- Bypasses employee record requirement
- Used on routes accessible without employee profile (login, profile setup)

**@CurrentUser()**
**File**: `/root/glide-Hims/packages/backend/src/modules/auth/decorators/current-user.decorator.ts`
- Parameter decorator to inject authenticated user into controller methods
- Can access specific user properties: `@CurrentUser('email')`

---

## 2. GUARDS ANALYSIS

### Global Architecture
**File**: `/root/glide-Hims/packages/backend/src/main.ts` (Line 68)

```typescript
const reflector = app.get(Reflector);
app.useGlobalGuards(new GlobalJwtAuthGuard(reflector));
```

All endpoints require authentication by default (whitelist approach with @Public())

---

### 2.1 GlobalJwtAuthGuard
**File**: `/root/glide-Hims/packages/backend/src/modules/auth/guards/global-jwt.guard.ts` (Lines 1-43)

```typescript
@Injectable()
export class GlobalJwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;  // Skip JWT check
    }

    // Otherwise, use JWT authentication
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
```

**Behavior**:
1. Checks for @Public() decorator
2. If public, allows access without JWT validation
3. Otherwise, validates JWT token
4. Throws UnauthorizedException if invalid or missing
5. Extracts user from JWT payload (from JwtStrategy)

---

### 2.2 RolesGuard
**File**: `/root/glide-Hims/packages/backend/src/modules/auth/guards/roles.guard.ts` (Lines 1-56)

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger('SuperAdminAudit');

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles required - allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    if (!user || !user.roles) {
      return false;
    }

    // Super Admin bypasses role checks (with audit logging)
    if (isSuperAdmin(user.roles)) {
      this.logSuperAdminAccess(request, requiredRoles);
      return true;
    }

    // Check if user has ANY required role
    return requiredRoles.some((role) => user.roles.includes(role));
  }

  private logSuperAdminAccess(request: any, requiredRoles: string[]): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'SUPER_ADMIN_ROLE_BYPASS',
      userId: request.user?.id,
      username: request.user?.username || request.user?.email,
      ip: request.ip || request.connection?.remoteAddress,
      method: request.method,
      path: request.url,
      bypassedRoles: requiredRoles,
      userAgent: request.headers?.['user-agent']?.substring(0, 100),
    };
    this.logger.warn(JSON.stringify(logEntry));
  }
}
```

**Key Features**:
- Gets required roles from metadata (set by @Roles decorator)
- Returns true if no roles required
- Super Admin bypasses role checks (with logging)
- Uses `some()` - user needs ANY required role (OR logic)
- Logs Super Admin access to 'SuperAdminAudit' logger

**Check**: `requiredRoles.some(role => user.roles.includes(role))`

---

### 2.3 PermissionsGuard (MAIN PERMISSION CHECK)
**File**: `/root/glide-Hims/packages/backend/src/modules/auth/guards/permissions.guard.ts` (Lines 1-175)

```typescript
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger('SuperAdminAudit');

  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No permissions required - allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    if (!user || !user.id) {
      return false;
    }

    // Super Admin bypass (with audit logging)
    if (isSuperAdmin(user.roles)) {
      this.logSuperAdminAccess(request, requiredPermissions);
      return true;
    }

    // Extract target facility from request
    const targetFacilityId = this.extractFacilityId(request);

    // GET USER'S ROLES (facility-filtered if applicable)
    const userRoleRepository = this.dataSource.getRepository(UserRole);
    let userRolesQuery = userRoleRepository
      .createQueryBuilder('ur')
      .where('ur.userId = :userId', { userId: user.id });
    
    if (targetFacilityId) {
      userRolesQuery = userRolesQuery.andWhere(
        '(ur.facilityId = :facilityId OR ur.facilityId IS NULL)',
        { facilityId: targetFacilityId }
      );
    }
    
    const userRoles = await userRolesQuery.getMany();

    // COLLECT PERMISSIONS FROM ROLES
    const userPermissionCodes: string[] = [];

    if (userRoles.length > 0) {
      const roleIds = userRoles.map(ur => ur.roleId);
      const rolePermissions = await this.dataSource
        .getRepository(RolePermission)
        .createQueryBuilder('rp')
        .leftJoinAndSelect('rp.permission', 'permission')
        .where('rp.roleId IN (:...roleIds)', { roleIds })
        .getMany();

      rolePermissions
        .filter(rp => rp.permission)
        .forEach(rp => userPermissionCodes.push(rp.permission.code));
    }

    // GET DIRECT USER PERMISSIONS
    const directPermissions = await this.dataSource
      .getRepository(UserPermission)
      .createQueryBuilder('up')
      .leftJoinAndSelect('up.permission', 'permission')
      .where('up.userId = :userId', { userId: user.id })
      .getMany();

    directPermissions
      .filter(up => up.permission)
      .forEach(up => {
        if (!userPermissionCodes.includes(up.permission.code)) {
          userPermissionCodes.push(up.permission.code);
        }
      });

    // Check if user has ALL required permissions
    const hasAllPermissions = requiredPermissions.every(perm => 
      userPermissionCodes.includes(perm)
    );
    
    if (!hasAllPermissions) {
      this.logAccessDenied(request, requiredPermissions, 'MISSING_PERMISSIONS');
    }
    
    return hasAllPermissions;
  }

  private extractFacilityId(request: any): string | null {
    // Priority: header > query > body > route params
    if (request.headers?.['x-facility-id']) return request.headers['x-facility-id'];
    if (request.query?.facilityId) return request.query.facilityId;
    if (request.body?.facilityId) return request.body.facilityId;
    if (request.params?.facilityId) return request.params.facilityId;
    return null;
  }
}
```

**Permission Resolution Flow**:
1. Checks @RequirePermissions decorator for required permission codes
2. Returns true if no permissions required
3. Bypasses check if user is Super Admin (logs the bypass)
4. Extracts facilityId from request (header takes priority)
5. Loads user roles from DB (filtered by facility if applicable)
6. Loads role permissions from role_permissions table
7. Loads direct user permissions from user_permissions table
8. Combines all permissions (role + direct), removing duplicates
9. Checks if user has ALL required permissions (AND logic)
10. Logs access denials for security monitoring

**Check**: `requiredPermissions.every(perm => userPermissionCodes.includes(perm))`

---

### 2.4 EmployeeRequiredGuard
**File**: `/root/glide-Hims/packages/backend/src/modules/auth/guards/employee-required.guard.ts` (Lines 1-60)

```typescript
@Injectable()
export class EmployeeRequiredGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if this route should skip employee check
    const skipCheck = this.reflector.getAllAndOverride<boolean>(SKIP_EMPLOYEE_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      return true; // Let auth guard handle unauthenticated users
    }

    // Check if user has an employee record
    const employee = await this.employeeRepository.findOne({
      where: { userId: user.sub },
    });

    if (!employee) {
      throw new ForbiddenException(
        'Your account is not linked to an employee profile. Please contact HR...'
      );
    }

    // Attach employee to request
    request.employee = employee;

    return true;
  }
}
```

**Purpose**: Ensures authenticated users have an associated employee record
**Usage**: Applied via @SkipEmployeeCheck() decorator on public/initial routes
**Note**: Not globally applied; used selectively on controllers

---

### 2.5 FacilityGuard
**File**: `/root/glide-Hims/packages/backend/src/modules/auth/guards/facility.guard.ts` (Lines 1-106)

```typescript
@Injectable()
export class FacilityGuard implements CanActivate {
  private readonly logger = new Logger(FacilityGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireFacility = this.reflector.getAllAndOverride<boolean>(FACILITY_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requireFacility) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user || !user.id) {
      return false;
    }

    const facilityId = this.extractFacilityId(request);

    if (!facilityId) {
      throw new ForbiddenException('Facility context required');
    }

    // Super Admin bypasses facility checks
    if (isSuperAdmin(user.roles)) {
      this.logger.warn(JSON.stringify({
        type: 'SUPER_ADMIN_FACILITY_BYPASS',
        userId: user.id,
        username: user.username,
        facilityId,
        method: request.method,
        path: request.url,
      }));
      return true;
    }

    // Verify user has an active role for this facility
    const hasAccess = await this.dataSource
      .getRepository(UserRole)
      .createQueryBuilder('ur')
      .where('ur.userId = :userId', { userId: user.id })
      .andWhere('(ur.facilityId = :facilityId OR ur.facilityId IS NULL)', { facilityId })
      .getCount();

    if (hasAccess === 0) {
      this.logger.warn(JSON.stringify({
        type: 'FACILITY_ACCESS_DENIED',
        userId: user.id,
        username: user.username,
        facilityId,
        method: request.method,
        path: request.url,
      }));
      throw new ForbiddenException('Access denied to this facility');
    }

    return true;
  }

  private extractFacilityId(request: any): string | null {
    // Priority: header > query > body > route params > JWT
    if (request.headers?.['x-facility-id']) return request.headers['x-facility-id'];
    if (request.query?.facilityId) return request.query.facilityId;
    if (request.body?.facilityId) return request.body.facilityId;
    if (request.params?.facilityId) return request.params.facilityId;
    if (request.user?.facilityId) return request.user.facilityId;
    return null;
  }
}
```

**Purpose**: Validates user has access to target facility
**Applied via**: @RequireFacilityAccess() decorator

---

### 2.6 RateLimitGuard
**File**: `/root/glide-Hims/packages/backend/src/modules/auth/guards/rate-limit.guard.ts` (Lines 1-128)

```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  private static attempts: Map<string, RateLimitEntry> = new Map();
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes block

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);
    const now = Date.now();

    // Check if IP is blocked
    if (entry?.blockedUntil && now < entry.blockedUntil) {
      throw new HttpException({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Too many login attempts. Please try again in ${remainingSeconds} seconds.`,
        retryAfter: remainingSeconds,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Increment attempt count
    currentEntry.count++;

    // Block after MAX_ATTEMPTS
    if (currentEntry.count > this.MAX_ATTEMPTS) {
      currentEntry.blockedUntil = now + this.BLOCK_DURATION_MS;
      RateLimitGuard.attempts.set(ip, currentEntry);
      throw new HttpException(...);
    }

    RateLimitGuard.attempts.set(ip, currentEntry);
    return true;
  }
}
```

**Rules**:
- Max 5 login attempts per 15-minute window
- After 5 attempts, block IP for 15 minutes
- Successful login resets counter
- Tracks by client IP

---

## 3. @AuthWithPermissions COMPLETE FLOW ANALYSIS

### 3.1 When Called with No Arguments: `@AuthWithPermissions()`

**Applied Decorators** (auth.decorator.ts lines 32-44):
```typescript
@AuthWithPermissions()
  → UseGuards(AuthGuard('jwt'), PermissionsGuard)
  → ApiBearerAuth()
  → ApiUnauthorizedResponse()
  → ApiForbiddenResponse()
  → RequirePermissions() [NOT called - no permissions specified]
```

**Flow**:
1. GlobalJwtAuthGuard checks for JWT token
2. JWT validated by JwtStrategy
3. PermissionsGuard checks for metadata (no permissions required)
4. Returns true - allows access
5. User object available in request

**Example Usage** (in-app-notifications.controller.ts):
```typescript
@AuthWithPermissions()
async getNotifications(@Req() req: any) {
  const userId = req.user?.id || req.user?.sub;
  return this.service.getForUser(userId, ...);
}
```

---

### 3.2 When Called with Permissions: `@AuthWithPermissions('users.read')`

**Applied Decorators** (auth.decorator.ts lines 32-44):
```typescript
@AuthWithPermissions('users.read')
  → RequirePermissions('users.read')  [Sets metadata]
  → UseGuards(AuthGuard('jwt'), PermissionsGuard)
  → ApiBearerAuth()
  → ApiUnauthorizedResponse()
  → ApiForbiddenResponse()
```

**Complete Request Flow**:

```
HTTP Request
  ↓
GlobalJwtAuthGuard (main.ts line 68)
  ├─ Checks @Public() decorator
  ├─ If not public: validates JWT token via JwtStrategy
  └─ Returns user object
  ↓
PermissionsGuard.canActivate() (permissions.guard.ts line 21)
  ├─ Gets requiredPermissions from @RequirePermissions metadata
  ├─ Returns true if no permissions required
  ├─ Checks if Super Admin → bypasses + logs
  ├─ Extracts facilityId from:
  │  ├─ x-facility-id header (priority)
  │  ├─ facilityId query param
  │  ├─ facilityId in body
  │  └─ facilityId in route params
  ├─ Loads UserRole records for user (facility-filtered)
  ├─ Gets RolePermission records for those roles
  ├─ Gets direct UserPermission records
  ├─ Combines all permission codes
  └─ Returns: requiredPermissions.every(perm => userPermissionCodes.includes(perm))
  ↓
[If passed] → Controller Method Executes
[If failed] → ForbiddenException thrown (403)
```

**Example with Permissions** (discharge.controller.ts):
```typescript
@AuthWithPermissions('discharge.create')
async create(@Body() dto: CreateDischargeSummaryDto, @Request() req: any) {
  const facilityId = req.user.facilityId || req.headers['x-facility-id'];
  return this.dischargeService.create(dto, req.user.sub, facilityId);
}
```

---

## 4. PERMISSION RESOLUTION SYSTEM

### 4.1 How System Determines User Permissions

**Database Entities** (packages/backend/src/database/entities):

```
User (user.entity.ts)
  ↓
UserRole (user-role.entity.ts) ← links users to roles
  ├─ userId: UUID
  ├─ roleId: UUID
  ├─ facilityId: UUID (optional - null = global role)
  └─ departmentId: UUID (optional)
  ↓
Role (role.entity.ts)
  ├─ id: UUID
  ├─ name: string (unique)
  ├─ description: string
  ├─ isSystemRole: boolean
  └─ status: string
  ↓
RolePermission (role-permission.entity.ts)
  ├─ roleId: UUID
  └─ permissionId: UUID
  ↓
Permission (permission.entity.ts)
  ├─ id: UUID
  ├─ code: string (unique) [e.g., 'patients.read']
  ├─ name: string
  ├─ description: string
  └─ module: string [e.g., 'patients']

User (user.entity.ts)
  ↓
UserPermission (user-permission.entity.ts) ← direct permissions
  ├─ userId: UUID
  ├─ permissionId: UUID
  ├─ grantedBy: UUID (admin who granted)
  ├─ grantedAt: Date
  └─ notes: string
  ↓
Permission (permission.entity.ts)
```

### 4.2 Database Lookup on Every Request (NOT JWT)

**CRITICAL**: Permissions are **NOT** stored in JWT token. They are **looked up from the database** on each request.

**JWT Payload** (jwt.strategy.ts lines 6-13):
```typescript
export interface JwtPayload {
  sub: string;           // user id
  username: string;
  email: string;
  tenantId?: string;
  roles: string[];       // Role NAMES (e.g., ['Doctor', 'Admin'])
  facilityId?: string;   // Optional facility context
}
```

**JWT does NOT include**:
- Permission codes
- Role IDs
- Role-permission mappings

### 4.3 PermissionsGuard Permission Resolution (lines 49-96)

**Step 1: Load User Roles**
```typescript
const userRoleRepository = this.dataSource.getRepository(UserRole);
let userRolesQuery = userRoleRepository
  .createQueryBuilder('ur')
  .where('ur.userId = :userId', { userId: user.id });

// Filter by facility if provided
if (targetFacilityId) {
  userRolesQuery = userRolesQuery.andWhere(
    '(ur.facilityId = :facilityId OR ur.facilityId IS NULL)',
    { facilityId: targetFacilityId }
  );
}

const userRoles = await userRolesQuery.getMany();
```

**SQL Generated**:
```sql
SELECT ur.* FROM user_roles ur
WHERE ur.user_id = $1
AND (ur.facility_id = $2 OR ur.facility_id IS NULL)
```

**Step 2: Load Permissions for Those Roles**
```typescript
const roleIds = userRoles.map(ur => ur.roleId);
const rolePermissions = await rolePermissionRepository
  .createQueryBuilder('rp')
  .leftJoinAndSelect('rp.permission', 'permission')
  .where('rp.roleId IN (:...roleIds)', { roleIds })
  .getMany();

rolePermissions
  .filter(rp => rp.permission)
  .forEach(rp => userPermissionCodes.push(rp.permission.code));
```

**SQL Generated**:
```sql
SELECT rp.*, p.* FROM role_permissions rp
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE rp.role_id IN ($1, $2, ...)
```

**Step 3: Load Direct User Permissions**
```typescript
const directPermissions = await userPermissionRepository
  .createQueryBuilder('up')
  .leftJoinAndSelect('up.permission', 'permission')
  .where('up.userId = :userId', { userId: user.id })
  .getMany();

directPermissions
  .filter(up => up.permission)
  .forEach(up => {
    if (!userPermissionCodes.includes(up.permission.code)) {
      userPermissionCodes.push(up.permission.code);
    }
  });
```

**SQL Generated**:
```sql
SELECT up.*, p.* FROM user_permissions up
LEFT JOIN permissions p ON up.permission_id = p.id
WHERE up.user_id = $1
```

**Step 4: Check Required Permissions**
```typescript
const hasAllPermissions = requiredPermissions.every(perm => 
  userPermissionCodes.includes(perm)
);
```

### 4.4 Permission Hierarchy

1. **Role Permissions** (from role_permissions table)
   - Permissions assigned to roles
   - User gets all permissions of all their roles
   - Can be facility-scoped or global

2. **Direct User Permissions** (from user_permissions table)
   - Permissions granted directly to user
   - Override role permissions
   - Includes metadata: who granted it, when, and notes

3. **Super Admin**
   - Automatically gets ALL permissions
   - Bypasses all permission checks
   - Access logged to 'SuperAdminAudit' logger

---

## 5. JWT PAYLOAD ANALYSIS

### 5.1 JWT Token Creation (auth.service.ts lines 204-218)

```typescript
const payload: JwtPayload = {
  sub: user.id,                    // User UUID
  username: user.username,          // Username string
  email: user.email,               // Email string
  tenantId: effectiveTenantId,     // Tenant UUID (multi-tenant support)
  roles,                           // Array of role names ['Doctor', 'Admin']
  facilityId,                      // Optional facility UUID
};

const accessToken = this.jwtService.sign(payload);
const refreshToken = this.jwtService.sign(payload, {
  secret: configService.get<string>('JWT_REFRESH_SECRET'),
  expiresIn: configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
});
```

### 5.2 JWT Configuration (auth.module.ts lines 30-39)

```typescript
JwtModule.registerAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    secret: configService.get<string>('JWT_SECRET'),
    signOptions: {
      expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m'),  // Default 15 minutes
    },
  }),
  inject: [ConfigService],
})
```

**Env Variables Required**:
- `JWT_SECRET`: Secret key for signing (must be 32+ chars in production)
- `JWT_EXPIRES_IN`: Access token expiry (e.g., '15m', '8h')
- `JWT_REFRESH_SECRET`: Secret for refresh token
- `JWT_REFRESH_EXPIRES_IN`: Refresh token expiry (e.g., '7d')

### 5.3 JWT Validation (jwt.strategy.ts lines 15-38)

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }
    return {
      sub: payload.sub,     // Keep for backward compat
      id: payload.sub,      // Also set as 'id'
      username: payload.username,
      email: payload.email,
      tenantId: payload.tenantId,
      roles: payload.roles,
      facilityId: payload.facilityId,
    };
  }
}
```

**Process**:
1. Extract token from "Authorization: Bearer <token>" header
2. Verify signature using JWT_SECRET
3. Check expiration (ignoreExpiration: false)
4. Validate payload has `sub` field
5. Return user object attached to request.user

### 5.4 Complete Login Response (auth.service.ts lines 224-244)

```typescript
return {
  accessToken,           // JWT token for API calls
  refreshToken,          // Token to refresh access token
  expiresIn: expiresInSeconds,  // Access token validity in seconds
  user: {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    roles,                 // Array of role names
    permissions,           // Array of permission codes (convenience, not in JWT)
    facilityId,
    facility: {
      id: facility.id,
      name: facility.name,
      type: facility.type,
      location: facility.location,
      contact: facility.contact,
    },
  },
};
```

---

## 6. GUARD EXECUTION ORDER & FLOW

### Global Registration (main.ts line 68)
```typescript
app.useGlobalGuards(new GlobalJwtAuthGuard(reflector));
```

### Guard Chain for `@AuthWithPermissions('users.read')`

```
Request arrives
  ↓
1. GlobalJwtAuthGuard.canActivate()
   ├─ Check @Public() metadata
   └─ If not public: validate JWT via JwtStrategy
   └─ Return user object or throw UnauthorizedException
  ↓
2. PermissionsGuard.canActivate()
   ├─ Get @RequirePermissions metadata
   ├─ Check Super Admin
   ├─ Load user roles from DB
   ├─ Load role permissions from DB
   ├─ Load direct permissions from DB
   └─ Check if user has all required permissions
   └─ Return true/false or throw ForbiddenException
  ↓
3. Controller Method
   └─ request.user available
```

---

## 7. SUPER ADMIN BEHAVIOR

### Automatic Bypasses (with Audit Logging)

**RolesGuard** (roles.guard.ts lines 30-35):
- Bypasses role checks
- Logs to 'SuperAdminAudit' logger

**PermissionsGuard** (permissions.guard.ts lines 39-42):
- Bypasses permission checks
- Logs to 'SuperAdminAudit' logger

**FacilityGuard** (facility.guard.ts lines 46-58):
- Bypasses facility access checks
- Logs to FacilityGuard logger

### Auto-Permission Assignment (auth.module.ts lines 54-103)

On module initialization:
1. All permissions auto-assigned to 'Super Admin' role
2. Pre-defined role permissions assigned to system roles:
   - Doctor: vitals, diagnoses, encounters, prescriptions, etc.
   - Nurse: vitals, nursing, queue, triage, radiology, etc.
   - Lab Technician: lab, orders, reports
   - Pharmacist: pharmacy, prescriptions, inventory, etc.
   - Radiologist: radiology, reports
   - Receptionist: vitals, patients, queue, appointments
   - Cashier: billing, patients
   - Store Keeper: stores, inventory, procurement

---

## 8. SECURITY FEATURES & AUDIT LOGGING

### 8.1 Account Lockout (auth.service.ts lines 70-107)

```typescript
// Lock account after 5 failed attempts for 15 minutes
if (user.failedLoginAttempts >= 5) {
  user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
}

// Reset on successful login
if (user.failedLoginAttempts > 0) {
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
}
```

### 8.2 Rate Limiting (rate-limit.guard.ts)
- 5 attempts per 15 minutes per IP
- 15-minute block after exceeding limit

### 8.3 Audit Logging

**Super Admin Access Bypass** (all guards):
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "type": "SUPER_ADMIN_PERMISSION_BYPASS",
  "userId": "user-id",
  "username": "admin@example.com",
  "ip": "192.168.1.100",
  "method": "POST",
  "path": "/api/v1/users",
  "bypassedPermissions": ["users.create"],
  "facilityId": "facility-id",
  "userAgent": "Mozilla/5.0..."
}
```

**Access Denied** (permissions.guard.ts):
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "type": "ACCESS_DENIED",
  "reason": "MISSING_PERMISSIONS",
  "userId": "user-id",
  "username": "doctor@example.com",
  "ip": "192.168.1.100",
  "method": "POST",
  "path": "/api/v1/users",
  "requiredPermissions": ["users.create"],
  "facilityId": "facility-id"
}
```

**Logger Name**: 'SuperAdminAudit' (for role/permission bypasses)

---

## 9. SUMMARY TABLE

| Component | File | Purpose | Metadata Key |
|-----------|------|---------|--------------|
| @Public() | public.decorator.ts | Skip auth | IS_PUBLIC_KEY |
| @Roles() | roles.decorator.ts | Require role | ROLES_KEY |
| @RequirePermissions() | permissions.decorator.ts | Require permission | PERMISSIONS_KEY |
| @Auth() | auth.decorator.ts | Composite: JWT + Roles | - |
| @AuthWithPermissions() | auth.decorator.ts | Composite: JWT + Permissions | - |
| @RequireFacilityAccess() | facility-access.decorator.ts | Facility check | FACILITY_ACCESS_KEY |
| @SkipEmployeeCheck() | skip-employee-check.decorator.ts | Skip employee requirement | SKIP_EMPLOYEE_CHECK |
| @CurrentUser() | current-user.decorator.ts | Inject user param | - |
| GlobalJwtAuthGuard | global-jwt.guard.ts | Global JWT validation | Global |
| RolesGuard | roles.guard.ts | Role validation | ROLES_KEY |
| PermissionsGuard | permissions.guard.ts | Permission validation | PERMISSIONS_KEY |
| EmployeeRequiredGuard | employee-required.guard.ts | Employee profile check | SKIP_EMPLOYEE_CHECK |
| FacilityGuard | facility.guard.ts | Facility access check | FACILITY_ACCESS_KEY |
| RateLimitGuard | rate-limit.guard.ts | Brute force protection | - |

---

## 10. PERMISSION CODE EXAMPLES

Built using pattern: `{module}.{action}`

```
patients.read, patients.create, patients.update, patients.delete
users.read, users.create, users.update, users.delete
vitals.read, vitals.create, vitals.update
encounters.read, encounters.create, encounters.update
prescriptions.read, prescriptions.create
pharmacy.read, pharmacy.create, pharmacy.dispense, pharmacy.inventory
lab.read, lab.create, lab.update
radiology.read, radiology.create, radiology.update, radiology.orders
billing.read, billing.create, billing.collect_payment
reports.read
admin.audit
```

---

## 11. COMPLETE REQUEST FLOW EXAMPLE

**Example**: Doctor accessing patient vitals with permission check

```
1. FRONTEND
   POST /api/v1/vitals/patient-123
   Headers: {
     "Authorization": "Bearer eyJhbGc...",
     "X-Facility-Id": "facility-456"
   }

2. GLOBAL JWT GUARD (main.ts)
   → Not @Public()
   → Extract JWT from header
   → Validate signature + expiry
   → Call JwtStrategy.validate()
   → Return user: {
       id: 'doctor-uuid',
       sub: 'doctor-uuid',
       username: 'dr.smith',
       email: 'dr.smith@hospital.com',
       roles: ['Doctor'],
       facilityId: 'facility-456',
       tenantId: 'tenant-uuid'
     }

3. PERMISSIONS GUARD
   → Get @AuthWithPermissions('vitals.create') metadata
   → Has required permissions? YES
   → Extract facilityId: 'facility-456' from header
   → Load UserRole where userId=doctor-uuid, facilityId=facility-456
   → Get role 'Doctor' 
   → Load RolePermission where roleId=doctor-role-uuid
   → Get permissions: ['vitals.create', 'vitals.read', ...]
   → Check: 'vitals.create' in ['vitals.create', ...] → TRUE
   → Return true

4. CONTROLLER EXECUTES
   async createVital(
     @Body() dto,
     @CurrentUser('id') userId,
     @Request() req
   ) {
     const facilityId = req.headers['x-facility-id'];
     return this.vitalsService.create(dto, userId, facilityId);
   }

5. RESPONSE
   200 OK: {
     id: 'vital-uuid',
     value: 98.6,
     createdAt: '2024-01-15T10:30:45.123Z'
   }
```

---

## 12. ENVIRONMENT VARIABLES REQUIRED

```bash
# JWT Configuration
JWT_SECRET=your-secret-key-min-32-chars-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# Database
DB_HOST=localhost
DB_USERNAME=user
DB_PASSWORD=password
DB_NAME=glide_hims

# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
CORS_ORIGINS=http://localhost:5173

# Tenant/Multi-tenancy support
```

---

## CRITICAL SECURITY NOTES

1. **Permissions from DB, not JWT**: Permission codes are resolved from database on EVERY request, not cached in JWT
2. **Facility Scoping**: Roles can be facility-scoped (multi-facility support)
3. **Super Admin Auditing**: All Super Admin bypasses are logged
4. **Rate Limiting**: Login endpoint protected against brute force (5 attempts/15 min)
5. **Account Lockout**: Accounts locked for 15 minutes after 5 failed attempts
6. **Multi-tenant**: System supports multi-tenancy via tenantId
7. **Helmet Security**: HTTP security headers applied globally
8. **MFA Support**: MFA validation during login if enabled

