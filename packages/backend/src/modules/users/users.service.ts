import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike, DataSource, IsNull, In, EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';
import {
  Employee,
  StaffCategory,
  EmploymentType,
  Gender,
} from '../../database/entities/employee.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';
import { Department } from '../../database/entities/department.entity';
import { Permission } from '../../database/entities/permission.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { PasswordPolicy } from '../../database/entities/password-policy.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  AssignRoleDto,
  UserListQueryDto,
  AssignPermissionDto,
} from './dto/user.dto';
import { BulkImportResult, BulkImportRowError } from './dto/bulk-import.dto';
import { SubscriptionLimitsService } from '../licensing/subscription-limits.service';
import * as XLSX from 'xlsx';
import { requireTenantId } from '../../common/utils/tenant.util';

// Improvement #6: Role → StaffCategory mapping utility
const ROLE_CATEGORY_MAP: Record<string, StaffCategory> = {
  Doctor: StaffCategory.DOCTOR,
  Nurse: StaffCategory.NURSE,
  Clinician: StaffCategory.CONSULTANT,
  Pharmacist: StaffCategory.PHARMACIST,
  'Lab Technician': StaffCategory.LAB_TECHNICIAN,
  Radiologist: StaffCategory.RADIOLOGIST,
  Receptionist: StaffCategory.RECEPTIONIST,
  Cashier: StaffCategory.CASHIER,
  'Store Keeper': StaffCategory.STORE_KEEPER,
  'HR Manager': StaffCategory.ADMINISTRATOR,
  Administrator: StaffCategory.ADMINISTRATOR,
  Staff: StaffCategory.OTHER,
};

export function mapRoleToStaffCategory(roleName: string): StaffCategory {
  return ROLE_CATEGORY_MAP[roleName] || StaffCategory.OTHER;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    @InjectRepository(UserPermission)
    private userPermissionRepository: Repository<UserPermission>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private configService: ConfigService,
    private dataSource: DataSource,
    @Optional()
    @Inject(forwardRef(() => SubscriptionLimitsService))
    private subscriptionLimitsService?: SubscriptionLimitsService,
  ) {}

  /**
   * Privilege-escalation guard shared by user-create (initial role)
   * and assignRole. Refuses to grant a role whose effective permission
   * set isn't already held by the caller, and refuses to grant system
   * roles unless caller is a platform / super admin.
   */
  private async assertCallerCanGrantRole(
    role: Role,
    caller?: { id?: string; userId?: string; isSystemAdmin?: boolean; roles?: string[] },
  ): Promise<void> {
    const callerIsSysAdmin = !!caller?.isSystemAdmin;
    const callerIsSuperAdmin = (caller?.roles || []).includes('Super Admin');

    if (role.isSystemRole && !(callerIsSysAdmin || callerIsSuperAdmin)) {
      throw new BadRequestException(
        `You may not assign the system role '${role.name}'. ` +
          `System roles can only be granted by a platform or super administrator.`,
      );
    }

    if (callerIsSysAdmin || callerIsSuperAdmin) return;

    const callerId = caller?.id || caller?.userId;
    if (!callerId) {
      throw new BadRequestException('Authenticated caller context required to assign roles');
    }
    const rolePerms: Array<{ code: string }> = await this.dataSource.query(
      `
      WITH RECURSIVE chain(id, parent_role_id) AS (
        SELECT id, parent_role_id FROM roles WHERE id = $1
        UNION ALL
        SELECT r.id, r.parent_role_id
          FROM roles r INNER JOIN chain c ON r.id = c.parent_role_id
      )
      SELECT DISTINCT p.code
        FROM permissions p
        INNER JOIN role_permissions rp ON rp.permission_id = p.id
        INNER JOIN chain c ON c.id = rp.role_id
      `,
      [role.id],
    );
    const callerPerms: Array<{ code: string }> = await this.dataSource.query(
      `
      SELECT DISTINCT p.code FROM permissions p
        INNER JOIN role_permissions rp ON rp.permission_id = p.id
        INNER JOIN user_roles ur ON ur.role_id = rp.role_id
        WHERE ur.user_id = $1 AND ur.deleted_at IS NULL
      UNION
      SELECT DISTINCT p.code FROM permissions p
        INNER JOIN user_permissions up ON up.permission_id = p.id
        WHERE up.user_id = $1
      `,
      [callerId],
    );
    const held = new Set(callerPerms.map((r) => r.code));
    const missing = rolePerms.map((r) => r.code).filter((c) => !held.has(c));
    if (missing.length) {
      throw new BadRequestException(
        `Cannot assign role '${role.name}': it carries permissions you do not hold ` +
          `(${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}).`,
      );
    }
  }

  async create(
    createUserDto: CreateUserDto,
    tenantId?: string,
    caller?: { id?: string; userId?: string; isSystemAdmin?: boolean; roles?: string[] },
  ): Promise<User & { employee?: Employee }> {
    const { employeeProfile, employeeId, roleId, facilityId, ...userData } = createUserDto;

    // Subscription limit check — before any writes
    if (tenantId && this.subscriptionLimitsService) {
      await this.subscriptionLimitsService.checkUserLimit(tenantId);
    }

    // NOTE: Employee link is optional. Required for staff users, but patient users
    // (e.g., for hospital insurance biometric verification) don't need employee records.

    // Check for duplicate username or email within the same tenant
    const whereConditions: any[] = tenantId
      ? [
          { username: userData.username, tenantId },
          { email: userData.email, tenantId },
        ]
      : [{ username: userData.username }, { email: userData.email }];
    const existingUser = await this.userRepository.findOne({
      where: whereConditions,
    });

    if (existingUser) {
      throw new ConflictException('Username or email already exists');
    }

    // Validate role if provided (roles may be global with NULL tenant_id)
    if (roleId) {
      const role = await this.roleRepository.findOne({
        where: tenantId
          ? [
              { id: roleId, tenantId },
              { id: roleId, tenantId: IsNull() },
            ]
          : { id: roleId },
      });
      if (!role) {
        throw new NotFoundException('Role not found');
      }
      // Privilege-escalation guard: the initial role on a new user is
      // functionally identical to an assignRole call, so enforce the
      // same caller-authority subset check. Without this, a tenant
      // admin could create a brand-new user pre-stamped with Super
      // Admin and side-step the assignRole hardening entirely.
      if (caller) {
        await this.assertCallerCanGrantRole(role, caller);
      }
    }

    // Same idea for the isSystemAdmin flag: belt-and-suspenders on top
    // of the controller's check, so service-internal callers also can't
    // mint platform admins by accident.
    if (createUserDto.isSystemAdmin && caller && !caller.isSystemAdmin) {
      throw new BadRequestException('Only platform administrators may create system-admin users');
    }

    // If linking to existing employee, verify it exists and isn't already linked
    if (employeeId) {
      const existingEmployee = await this.employeeRepository.findOne({
        where: { id: employeeId, ...(tenantId ? { tenantId } : {}) },
      });
      if (!existingEmployee) {
        throw new NotFoundException('Employee not found');
      }
      if (existingEmployee.userId) {
        throw new ConflictException('Employee is already linked to a user account');
      }
    }

    // Use transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Hash password
      const saltRoundsConfig = this.configService.get<string>('BCRYPT_ROUNDS', '12');
      const saltRounds = parseInt(saltRoundsConfig, 10) || 12;
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);

      const user = this.userRepository.create({
        username: userData.username,
        email: userData.email,
        fullName: userData.fullName,
        phone: userData.phone,
        passwordHash,
        status: userData.status || 'active',
        tenantId: tenantId || undefined,
        isSystemAdmin: userData.isSystemAdmin || false,
        mustChangePassword: true,
      });

      const savedUser = await queryRunner.manager.save(user);
      let employee: Employee | undefined;

      // Resolve role name for auto-mapping
      let roleName: string | undefined;
      if (roleId) {
        const role = await queryRunner.manager.findOne(Role, { where: { id: roleId } });
        roleName = role?.name;
      }

      // Link to existing employee
      if (employeeId) {
        await queryRunner.manager.update(Employee, employeeId, { userId: savedUser.id });
        employee =
          (await queryRunner.manager.findOne(Employee, { where: { id: employeeId } })) ?? undefined;
      }
      // Create new employee profile (explicit or auto-generated)
      // Skip employee creation for system admin users (they don't need facility/employee records)
      else if (!userData.isSystemAdmin) {
        const isSuperAdmin = roleName === 'Super Admin';
        const shouldCreateEmployee = employeeProfile || !isSuperAdmin;

        if (shouldCreateEmployee) {
          // facilityId may come from the DTO root, from the employeeProfile,
          // or (later) from the role being assigned. Auto-create requires a
          // facility because employees.facility_id is NOT NULL.
          const effectiveFacilityId = employeeProfile?.facilityId || facilityId;
          if (!effectiveFacilityId) {
            throw new BadRequestException(
              'facilityId is required to create an employee profile for a non-system-admin user',
            );
          }

          const nameParts = userData.fullName.split(' ');
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ') || firstName;

          const autoStaffCategory = roleName
            ? mapRoleToStaffCategory(roleName)
            : StaffCategory.OTHER;

          // Resolve department FK from the free-text department on the
          // employeeProfile so the row is FK-linked from day one.
          const { departmentId: resolvedDeptId, department: resolvedDeptText } =
            await this.resolveDepartmentForTenant(
              employeeProfile?.department,
              tenantId,
              queryRunner.manager,
            );

          // Per-facility numbering + retry on 23505 (matches backfill /
          // createEmployee paths so concurrent inserts don't collide).
          let lastErr: any;
          for (let attempt = 0; attempt < 5 && !employee; attempt++) {
            try {
              const employeeNumber = await this.nextEmployeeNumberForFacility(
                effectiveFacilityId,
                queryRunner.manager,
              );
              const draft = this.employeeRepository.create({
                employeeNumber,
                userId: savedUser.id,
                firstName,
                lastName,
                email: userData.email,
                phone: userData.phone,
                dateOfBirth: employeeProfile?.dateOfBirth
                  ? new Date(employeeProfile.dateOfBirth)
                  : new Date('1990-01-01'),
                gender: employeeProfile?.gender || Gender.OTHER,
                jobTitle: employeeProfile?.jobTitle || roleName || 'Staff',
                department: resolvedDeptText,
                departmentId: resolvedDeptId,
                staffCategory: employeeProfile?.staffCategory || autoStaffCategory,
                licenseNumber: employeeProfile?.licenseNumber,
                specialization: employeeProfile?.specialization,
                employmentType: employeeProfile?.employmentType || EmploymentType.PERMANENT,
                hireDate: employeeProfile?.hireDate
                  ? new Date(employeeProfile.hireDate)
                  : new Date(),
                basicSalary: employeeProfile?.basicSalary || 0,
                facilityId: effectiveFacilityId,
                tenantId: tenantId || undefined,
              });
              employee = await queryRunner.manager.save(draft);
            } catch (e: any) {
              lastErr = e;
              if (e?.code !== '23505') throw e;
              await new Promise((r) => setTimeout(r, 10 + Math.random() * 30));
            }
          }
          if (!employee) {
            throw lastErr ?? new Error('Failed to allocate employee_number after 5 attempts');
          }

          // Audit the auto-create so it's traceable alongside backfills.
          try {
            await queryRunner.manager.save(
              this.auditLogRepository.create({
                userId: caller?.id || caller?.userId || savedUser.id,
                action: 'EMPLOYEE_AUTO_CREATED',
                entityType: 'Employee',
                entityId: employee.id,
                newValue: {
                  employeeId: employee.id,
                  employeeNumber: employee.employeeNumber,
                  userId: savedUser.id,
                  roleName: roleName ?? null,
                  facilityId: effectiveFacilityId,
                },
                tenantId: tenantId || undefined,
              }),
            );
          } catch (auditErr) {
            this.logger.warn(
              `Failed to audit employee auto-create for user ${savedUser.id}: ${(auditErr as Error).message}`,
            );
          }
        }
      }

      // Assign role if provided
      if (roleId) {
        const userRole = this.userRoleRepository.create({
          userId: savedUser.id,
          roleId: roleId,
          facilityId: facilityId || undefined,
        });
        await queryRunner.manager.save(userRole);
      }

      await queryRunner.commitTransaction();

      return { ...savedUser, employee };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query: UserListQueryDto, tenantId?: string) {
    const { page = 1, limit = 20, search, status, role } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Tenant filter MUST come first and use andWhere to never be overwritten
    // When tenantId is undefined, use a non-existent UUID to return empty results (failsafe)
    queryBuilder.where('user.tenant_id = :tenantId', {
      tenantId: tenantId || '00000000-0000-0000-0000-000000000000',
    });

    if (search) {
      queryBuilder.andWhere(
        '(user.username ILIKE :search OR user.full_name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    if (role) {
      queryBuilder.andWhere('role.name = :roleName', { roleName: role });
    }

    const [users, total] = await queryBuilder
      .leftJoinAndSelect('user.userRoles', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .leftJoinAndSelect('user.department', 'department')
      .skip(skip)
      .take(limit)
      .orderBy('user.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: users.map((u) => this.sanitizeUser(u)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findSystemAdmins(query: UserListQueryDto) {
    const { page = 1, limit = 20, search, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository.createQueryBuilder('user');
    queryBuilder.where('user.isSystemAdmin = :isAdmin', { isAdmin: true });

    if (search) {
      queryBuilder.andWhere(
        '(user.username ILIKE :search OR user.full_name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    const [users, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('user.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: users.map((u) => this.sanitizeUser(u)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Find all tenant admins (users with Super Admin role) across all tenants.
   * Used by system administrators to manage tenant admin passwords.
   */
  async findTenantAdmins() {
    const rows = await this.dataSource.query(`
      SELECT 
        u.id, u.username, u.full_name AS "fullName", u.email, u.phone, u.status,
        u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt",
        t.id AS "tenantId", t.name AS "tenantName", t.slug AS "tenantSlug",
        r.name AS "roleName"
      FROM users u
      JOIN tenants t ON t.id = u.tenant_id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.deleted_at IS NULL
        AND t.deleted_at IS NULL
        AND r.name IN ('Super Admin', 'Tenant Admin', 'Admin')
      ORDER BY t.name ASC, r.name ASC, u.username ASC
    `);

    // Deduplicate users who have multiple roles — prefer Super Admin > Tenant Admin > Admin
    const rolePriority: Record<string, number> = { 'Super Admin': 3, 'Tenant Admin': 2, Admin: 1 };
    const userMap = new Map<string, any>();
    for (const row of rows) {
      const existing = userMap.get(row.id);
      const existingPriority = existing ? rolePriority[existing.roleName] || 0 : -1;
      const rowPriority = rolePriority[row.roleName] || 0;
      if (!existing || rowPriority > existingPriority) {
        userMap.set(row.id, row);
      }
    }
    return Array.from(userMap.values());
  }

  async findOne(id: string, tenantId?: string): Promise<User> {
    const tid = requireTenantId(tenantId);
    const user = await this.userRepository.findOne({
      where: { id, tenantId: tid },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findOneWithRoles(id: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const user = await this.findOne(id, tenantId);

    const userRoles = await this.userRoleRepository.find({
      where: { userId: id, tenantId: tid },
      relations: ['role', 'facility', 'department'],
    });

    // Get employee profile if linked
    const employee = await this.employeeRepository.findOne({
      where: { userId: id, tenantId: tid },
      relations: ['facility'],
    });

    return {
      ...this.sanitizeUser(user),
      roles: userRoles.map((ur) => ({
        id: ur.id,
        role: { id: ur.role.id, name: ur.role.name },
        facility: ur.facility ? { id: ur.facility.id, name: ur.facility.name } : null,
        department: ur.department ? { id: ur.department.id, name: ur.department.name } : null,
      })),
      employee: employee
        ? {
            id: employee.id,
            employeeNumber: employee.employeeNumber,
            jobTitle: employee.jobTitle,
            department: employee.department,
            staffCategory: employee.staffCategory,
            licenseNumber: employee.licenseNumber,
            specialization: employee.specialization,
            employmentType: employee.employmentType,
            status: employee.status,
            facility: employee.facility
              ? { id: employee.facility.id, name: employee.facility.name }
              : null,
          }
        : null,
    };
  }

  async linkUserToEmployee(
    userId: string,
    employeeId: string,
    tenantId?: string,
    caller?: any,
  ): Promise<Employee> {
    const tid = requireTenantId(tenantId);
    const user = await this.findOne(userId, tenantId);

    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId, tenantId: tid },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Belt-and-braces: when caller is a system admin (no tenantId filter
    // applied above) make sure we are not linking across tenants.
    if (user.tenantId && employee.tenantId && user.tenantId !== employee.tenantId) {
      throw new ConflictException('User and employee belong to different tenants');
    }

    if (employee.userId && employee.userId !== userId) {
      throw new ConflictException('Employee is already linked to another user account');
    }

    const existingLink = await this.employeeRepository.findOne({
      where: { userId, tenantId: tid },
    });

    if (existingLink && existingLink.id !== employeeId) {
      throw new ConflictException('User is already linked to another employee profile');
    }

    employee.userId = userId;
    const saved = await this.employeeRepository.save(employee);

    try {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          userId,
          action: 'USER_LINKED_TO_EMPLOYEE',
          entityType: 'Employee',
          entityId: saved.id,
          newValue: {
            employeeId: saved.id,
            employeeNumber: saved.employeeNumber,
            linkedBy: caller?.id || caller?.userId || 'system',
          },
          tenantId: tenantId || saved.tenantId,
        }),
      );
    } catch (e) {
      this.logger.warn(`Failed to audit user→employee link: ${(e as Error).message}`);
    }

    return saved;
  }

  async unlinkUserFromEmployee(userId: string, tenantId?: string, caller?: any): Promise<void> {
    const tid = requireTenantId(tenantId);
    // Make sure the target user is in the caller's tenant (404s on mismatch).
    await this.findOne(userId, tenantId);

    const employee = await this.employeeRepository.findOne({
      where: { userId, tenantId: tid },
    });

    if (!employee) {
      throw new NotFoundException('No employee profile linked to this user');
    }

    const previousEmployeeId = employee.id;
    const previousEmployeeNumber = employee.employeeNumber;
    // Set user_id to NULL via QueryBuilder. Using .save() with userId=undefined
    // is a no-op in TypeORM (undefined fields are ignored), and assigning null
    // to a typed property triggers TS errors against the non-null entity type.
    await this.employeeRepository
      .createQueryBuilder()
      .update(Employee)
      .set({ userId: null as any })
      .where('id = :id', { id: employee.id })
      .execute();

    try {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          userId,
          action: 'USER_UNLINKED_FROM_EMPLOYEE',
          entityType: 'Employee',
          entityId: previousEmployeeId,
          oldValue: {
            employeeId: previousEmployeeId,
            employeeNumber: previousEmployeeNumber,
            unlinkedBy: caller?.id || caller?.userId || 'system',
          },
          tenantId: tenantId || employee.tenantId,
        }),
      );
    } catch (e) {
      this.logger.warn(`Failed to audit user→employee unlink: ${(e as Error).message}`);
    }
  }

  /**
   * List users in the tenant that are NOT linked to any employee profile.
   * Used by the admin UI to populate a "user → employee" picker.
   */
  async listUsersWithoutEmployee(
    tenantId: string | undefined,
    options: { search?: string; limit?: number; offset?: number } = {},
  ): Promise<{ data: any[]; total: number }> {
    const tid = requireTenantId(tenantId);
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
    const offset = Math.max(options.offset ?? 0, 0);

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoin(Employee, 'emp', 'emp.user_id = user.id')
      .where('emp.id IS NULL');

    qb.andWhere('user.tenant_id = :tenantId', { tenantId: tid });
    if (options.search) {
      qb.andWhere('(user.username ILIKE :q OR user.full_name ILIKE :q OR user.email ILIKE :q)', {
        q: `%${options.search}%`,
      });
    }

    const total = await qb.getCount();
    const rows = await qb.orderBy('user.full_name', 'ASC').limit(limit).offset(offset).getMany();

    return {
      data: rows.map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        email: u.email,
        status: u.status,
        facilityId: u.facilityId,
      })),
      total,
    };
  }

  /**
   * List employees in the tenant that are NOT linked to any user account.
   * Used by the admin UI to populate the "Link to Employee" dropdown.
   */
  async listEmployeesWithoutUser(
    tenantId: string | undefined,
    options: { facilityId?: string; search?: string; limit?: number; offset?: number } = {},
  ): Promise<{ data: any[]; total: number }> {
    const tid = requireTenantId(tenantId);
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
    const offset = Math.max(options.offset ?? 0, 0);

    const qb = this.employeeRepository.createQueryBuilder('emp').where('emp.user_id IS NULL');

    qb.andWhere('emp.tenant_id = :tenantId', { tenantId: tid });
    if (options.facilityId) {
      qb.andWhere('emp.facility_id = :facilityId', { facilityId: options.facilityId });
    }
    if (options.search) {
      qb.andWhere(
        '(emp.employee_number ILIKE :q OR emp.first_name ILIKE :q OR emp.last_name ILIKE :q OR emp.email ILIKE :q)',
        { q: `%${options.search}%` },
      );
    }

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('emp.last_name', 'ASC')
      .addOrderBy('emp.first_name', 'ASC')
      .limit(limit)
      .offset(offset)
      .getMany();

    return {
      data: rows.map((e) => ({
        id: e.id,
        employeeNumber: e.employeeNumber,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        jobTitle: e.jobTitle,
        facilityId: e.facilityId,
        status: e.status,
      })),
      total,
    };
  }

  /**
   * Compute the next per-facility employee number using MAX(numeric suffix)+1
   * so deletes don't collapse the sequence into existing rows. Callers must
   * still retry on Postgres unique-violation (code 23505) under concurrency.
   */
  private async nextEmployeeNumberForFacility(
    facilityId: string,
    manager?: EntityManager,
  ): Promise<string> {
    const repo = manager ? manager.getRepository(Employee) : this.employeeRepository;
    const row = await repo
      .createQueryBuilder('e')
      .select(
        "COALESCE(MAX(NULLIF(regexp_replace(e.employee_number, '\\D', '', 'g'), '')::int), 0)",
        'max',
      )
      .where('e.facility_id = :facilityId', { facilityId })
      .getRawOne();
    const next = Number(row?.max ?? 0) + 1;
    return `EMP${String(next).padStart(5, '0')}`;
  }

  // Resolve a free-text department name into both the canonical text and
  // the matching departments.id FK, scoped to the caller's tenant.
  // Falls back to (text, null) when there's no name match — same contract
  // as HrService.resolveDepartmentFields so the two paths stay in sync.
  private async resolveDepartmentForTenant(
    departmentText: string | undefined,
    tenantId: string | undefined,
    manager?: EntityManager,
  ): Promise<{ departmentId?: string; department?: string }> {
    if (!departmentText || !departmentText.trim()) {
      return { departmentId: undefined, department: undefined };
    }
    const trimmed = departmentText.trim();
    const repo = manager ? manager.getRepository(Department) : this.departmentRepository;
    const qb = repo
      .createQueryBuilder('d')
      .where('LOWER(TRIM(d.name)) = LOWER(:name)', { name: trimmed });
    if (tenantId) qb.andWhere('d.tenant_id = :tenantId', { tenantId });
    const match = await qb.getOne();
    return { departmentId: match?.id, department: trimmed };
  }

  async getEmployeeByUserId(userId: string, tenantId?: string): Promise<Employee | null> {
    const tid = requireTenantId(tenantId);
    return this.employeeRepository.findOne({
      where: { userId, tenantId: tid },
      relations: ['facility'],
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto, tenantId?: string): Promise<User> {
    const user = await this.findOne(id, tenantId);

    // Check for duplicate username or email within the same tenant
    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const whereCondition: any = { username: updateUserDto.username };
      if (user.tenantId) whereCondition.tenantId = user.tenantId;
      const existing = await this.userRepository.findOne({
        where: whereCondition,
      });
      if (existing) {
        throw new ConflictException('Username already exists');
      }
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const whereCondition: any = { email: updateUserDto.email };
      if (user.tenantId) whereCondition.tenantId = user.tenantId;
      const existing = await this.userRepository.findOne({
        where: whereCondition,
      });
      if (existing) {
        throw new ConflictException('Email already exists');
      }
    }

    // Fix 5: validate password against tenant's PasswordPolicy before hashing
    if (updateUserDto.password) {
      await this.validatePasswordAgainstPolicy(
        updateUserDto.password,
        user.tenantId,
        user.facilityId,
      );
      const saltRoundsConfig = this.configService.get<string>('BCRYPT_ROUNDS', '12');
      const saltRounds = parseInt(saltRoundsConfig, 10) || 12;
      user.passwordHash = await bcrypt.hash(updateUserDto.password, saltRounds);
    }

    // Update other fields
    if (updateUserDto.username) user.username = updateUserDto.username;
    if (updateUserDto.fullName) user.fullName = updateUserDto.fullName;
    if (updateUserDto.email) user.email = updateUserDto.email;
    if (updateUserDto.phone !== undefined) user.phone = updateUserDto.phone;
    if (updateUserDto.status) user.status = updateUserDto.status;
    if (updateUserDto.facilityId !== undefined)
      user.facilityId = updateUserDto.facilityId || undefined;
    if (updateUserDto.departmentId !== undefined)
      user.departmentId = updateUserDto.departmentId || undefined;

    const savedUser = await this.userRepository.save(user);

    // Improvement #5: Sync HR fields to linked employee record
    try {
      const employee = await this.employeeRepository.findOne({
        where: { userId: id, tenantId: requireTenantId(tenantId) },
      });
      if (employee) {
        let employeeUpdated = false;
        if (updateUserDto.email && updateUserDto.email !== employee.email) {
          employee.email = updateUserDto.email;
          employeeUpdated = true;
        }
        if (updateUserDto.phone !== undefined && updateUserDto.phone !== employee.phone) {
          employee.phone = updateUserDto.phone || employee.phone;
          employeeUpdated = true;
        }
        if (updateUserDto.fullName) {
          const nameParts = updateUserDto.fullName.split(' ');
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ') || firstName;
          if (firstName !== employee.firstName || lastName !== employee.lastName) {
            employee.firstName = firstName;
            employee.lastName = lastName;
            employeeUpdated = true;
          }
        }
        if (employeeUpdated) {
          await this.employeeRepository.save(employee);
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to sync user update to employee: ${(e as Error).message}`);
    }

    return savedUser;
  }

  async remove(
    id: string,
    tenantId?: string,
    caller?: { id?: string; userId?: string; isSystemAdmin?: boolean },
  ): Promise<void> {
    const tid = requireTenantId(tenantId);
    const user = await this.findOne(id, tid);

    // Fix 14: self-deletion guard
    const callerId = caller?.id || caller?.userId;
    if (callerId && callerId === id) {
      throw new BadRequestException('Cannot delete your own account');
    }

    // Fix 14: prevent deletion of system admin accounts by non-system-admins
    if (user.isSystemAdmin && !caller?.isSystemAdmin) {
      throw new BadRequestException('Cannot delete system administrator accounts');
    }

    // Fix 14: last-admin guard — count remaining admins for tenant before deleting
    const adminRoles = await this.roleRepository.find({
      where: [
        { name: 'Administrator', isSystemRole: true },
        { name: 'Super Admin', isSystemRole: true },
      ],
    });
    if (adminRoles.length > 0) {
      const adminRoleIds = adminRoles.map((r) => r.id);
      const adminCount = await this.userRoleRepository
        .createQueryBuilder('ur')
        .innerJoin('ur.user', 'u')
        .where('ur.roleId IN (:...roleIds)', { roleIds: adminRoleIds })
        .andWhere('u.tenantId = :tenantId', { tenantId: tid })
        .andWhere('u.id != :userId', { userId: id })
        .andWhere('u.deletedAt IS NULL')
        .getCount();
      if (adminCount === 0) {
        throw new BadRequestException(
          'Cannot delete the last administrator for this organization',
        );
      }
    }

    await this.userRepository.softRemove(user);
    // Revoke all active sessions and refresh tokens for deleted user
    await this.revokeUserSessions(id);
  }

  async assignRole(
    userId: string,
    dto: AssignRoleDto,
    tenantId?: string,
    caller?: { id?: string; userId?: string; isSystemAdmin?: boolean; roles?: string[] },
  ): Promise<UserRole> {
    const user = await this.findOne(userId, tenantId);
    let role: Role | null;
    if (tenantId) {
      role = await this.roleRepository
        .createQueryBuilder('role')
        .where('role.id = :id', { id: dto.roleId })
        .andWhere('(role.tenant_id = :tenantId OR role.is_system_role = true)', { tenantId })
        .getOne();
    } else {
      role = await this.roleRepository.findOne({ where: [{ id: dto.roleId, isSystemRole: true }] });
    }

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // SECURITY: privilege escalation guard (shared with create()).
    await this.assertCallerCanGrantRole(role, caller);

    // Check if role is already assigned with same scope
    const tid = requireTenantId(tenantId);
    const existing = await this.userRoleRepository.findOne({
      where: {
        userId,
        roleId: dto.roleId,
        facilityId: dto.facilityId || undefined,
        tenantId: tid,
      },
    });

    if (existing) {
      throw new ConflictException('Role already assigned');
    }

    const userRole = this.userRoleRepository.create({
      userId,
      roleId: dto.roleId,
      facilityId: dto.facilityId,
      departmentId: dto.departmentId,
    });

    const savedUserRole = await this.userRoleRepository.save(userRole);

    // Audit log for role assignment
    try {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          userId,
          action: 'ROLE_ASSIGNED',
          entityType: 'UserRole',
          entityId: savedUserRole.id,
          newValue: {
            roleId: dto.roleId,
            roleName: role.name,
            facilityId: dto.facilityId,
            grantedBy: caller?.id || caller?.userId || 'system',
          },
          tenantId,
        }),
      );
    } catch (e) {
      this.logger.warn(`Failed to create audit log for role assignment: ${(e as Error).message}`);
    }

    return savedUserRole;
  }

  async removeRole(userId: string, roleId: string, tenantId?: string): Promise<void> {
    // Scope by tenantId when available; also match NULL tenant_id for legacy records
    const where = tenantId
      ? [
          { userId, roleId, tenantId },
          { userId, roleId, tenantId: IsNull() },
        ]
      : { userId, roleId };
    const userRole = await this.userRoleRepository.findOne({ where, relations: ['role'] });

    if (!userRole) {
      throw new NotFoundException('User role not found');
    }

    const roleName = userRole.role?.name || roleId;
    await this.userRoleRepository.remove(userRole);

    // Audit log for role removal
    try {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          userId,
          action: 'ROLE_REMOVED',
          entityType: 'UserRole',
          oldValue: { roleId, roleName },
          tenantId,
        }),
      );
    } catch (e) {
      this.logger.warn(`Failed to create audit log for role removal: ${(e as Error).message}`);
    }
  }

  async getUserRoles(userId: string, tenantId?: string): Promise<any[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { userId, tenantId: tid };
    const userRoles = await this.userRoleRepository.find({
      where,
      relations: ['role', 'facility'],
    });
    return userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
      facilityId: ur.facilityId,
      facilityName: ur.facility?.name,
    }));
  }

  async activateUser(id: string, tenantId?: string): Promise<User> {
    const user = await this.findOne(id, tenantId);
    user.status = 'active';
    user.lockedUntil = undefined;
    user.failedLoginAttempts = 0;
    return this.userRepository.save(user);
  }

  async deactivateUser(id: string, tenantId?: string): Promise<User> {
    const user = await this.findOne(id, tenantId);
    user.status = 'inactive';
    const saved = await this.userRepository.save(user);
    // Revoke all active sessions and refresh tokens for deactivated user
    await this.revokeUserSessions(id);
    return saved;
  }

  /** Revoke all active sessions and refresh tokens for a user (used on deactivation/deletion). */
  private async revokeUserSessions(userId: string): Promise<void> {
    try {
      await this.dataSource.query(
        `UPDATE sessions SET revoked_at = NOW(), is_active = false WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      );
      await this.dataSource.query(
        `UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND is_revoked = false`,
        [userId],
      );
    } catch (err) {
      // Sessions/refresh_tokens tables may not exist — don't block user operations
      this.logger.warn(`Failed to revoke sessions for user ${userId}: ${(err as Error).message}`);
    }
  }

  // Direct user permission management
  async getUserPermissions(userId: string, tenantId?: string): Promise<UserPermission[]> {
    const tid = requireTenantId(tenantId);
    await this.findOne(userId, tenantId);
    return this.userPermissionRepository.find({
      where: { userId, tenantId: tid },
      relations: ['permission'],
    });
  }

  async assignPermission(
    userId: string,
    dto: AssignPermissionDto,
    grantedBy: string,
    tenantId?: string,
  ): Promise<UserPermission> {
    const tid = requireTenantId(tenantId);
    await this.findOne(userId, tenantId);

    const permission = await this.permissionRepository.findOne({
      where: { id: dto.permissionId, tenantId: tid },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // Check if already assigned
    const existing = await this.userPermissionRepository.findOne({
      where: { userId, permissionId: dto.permissionId, tenantId: tid },
    });
    if (existing) {
      throw new ConflictException('Permission already assigned to this user');
    }

    const userPermission = this.userPermissionRepository.create({
      userId,
      permissionId: dto.permissionId,
      grantedBy,
      notes: dto.notes,
    });

    const savedPermission = await this.userPermissionRepository.save(userPermission);

    // Audit log for permission assignment
    try {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          userId,
          action: 'PERMISSION_ASSIGNED',
          entityType: 'UserPermission',
          entityId: savedPermission.id,
          newValue: { permissionId: dto.permissionId, permissionCode: permission.code, grantedBy },
          tenantId,
        }),
      );
    } catch (e) {
      this.logger.warn(
        `Failed to create audit log for permission assignment: ${(e as Error).message}`,
      );
    }

    return savedPermission;
  }

  async removePermission(userId: string, permissionId: string, tenantId?: string): Promise<void> {
    const tid = requireTenantId(tenantId);
    const userPermission = await this.userPermissionRepository.findOne({
      where: { userId, permissionId, tenantId: tid },
      relations: ['permission'],
    });
    if (!userPermission) {
      throw new NotFoundException('Permission not assigned to this user');
    }

    const permissionCode = userPermission.permission?.code || permissionId;
    await this.userPermissionRepository.remove(userPermission);

    // Audit log for permission removal
    try {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          userId,
          action: 'PERMISSION_REMOVED',
          entityType: 'UserPermission',
          oldValue: { permissionId, permissionCode },
          tenantId,
        }),
      );
    } catch (e) {
      this.logger.warn(
        `Failed to create audit log for permission removal: ${(e as Error).message}`,
      );
    }
  }

  async assignMultiplePermissions(
    userId: string,
    permissionIds: string[],
    grantedBy: string,
    tenantId?: string,
  ): Promise<UserPermission[]> {
    await this.findOne(userId, tenantId);

    const results: UserPermission[] = [];
    for (const permissionId of permissionIds) {
      try {
        const permission = await this.assignPermission(userId, { permissionId }, grantedBy);
        results.push(permission);
      } catch (error) {
        // Skip if already assigned
        if (!(error instanceof ConflictException)) {
          throw error;
        }
      }
    }
    return results;
  }

  async removeAllUserPermissions(userId: string, tenantId?: string): Promise<void> {
    const tid = requireTenantId(tenantId);
    await this.findOne(userId, tenantId);
    await this.userPermissionRepository.delete({ userId, tenantId: tid });
  }

  /**
   * Check if user has an associated employee record
   */
  async hasEmployeeRecord(userId: string, tenantId?: string): Promise<boolean> {
    const tid = requireTenantId(tenantId);
    const employee = await this.employeeRepository.findOne({
      where: { userId, tenantId: tid },
    });
    return !!employee;
  }

  /**
   * Get employee record for a user
   */
  async getEmployeeForUser(userId: string, tenantId?: string): Promise<Employee | null> {
    const tid = requireTenantId(tenantId);
    return this.employeeRepository.findOne({
      where: { userId, tenantId: tid },
      relations: ['facility'],
    });
  }

  /**
   * Validate user has employee profile - throws if not linked
   */
  async validateUserHasEmployee(userId: string, tenantId?: string): Promise<Employee> {
    const tid = requireTenantId(tenantId);
    const employee = await this.employeeRepository.findOne({
      where: { userId, tenantId: tid },
      relations: ['facility'],
    });
    if (!employee) {
      throw new BadRequestException(
        'Your account is not linked to an employee profile. Please contact HR to complete your profile setup.',
      );
    }
    return employee;
  }

  /**
   * Improvement #3: Backfill employees for users that don't have one
   */
  async backfillEmployees(tenantId?: string): Promise<{ created: number; skipped: number }> {
    const tid = requireTenantId(tenantId);
    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoin(Employee, 'emp', 'emp.user_id = user.id')
      .where('emp.id IS NULL');
    qb.andWhere('user.tenant_id = :tenantId', { tenantId: tid });
    const usersWithoutEmployee = await qb.getMany();

    let created = 0;
    let skipped = 0;

    for (const user of usersWithoutEmployee) {
      try {
        // Look up user's role
        const userRole = await this.userRoleRepository.findOne({
          where: { userId: user.id },
          relations: ['role'],
        });
        const roleName = userRole?.role?.name;

        // Skip Super Admin users
        if (roleName === 'Super Admin') {
          skipped++;
          continue;
        }

        const nameParts = user.fullName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || firstName;

        const staffCategory = roleName ? mapRoleToStaffCategory(roleName) : StaffCategory.OTHER;

        // Determine facility from user's role assignment or user's facilityId
        const facilityId = userRole?.facilityId || user.facilityId;
        if (!facilityId) {
          this.logger.warn(
            `Skipping backfill for user ${user.id} (${user.username}) — no facility`,
          );
          skipped++;
          continue;
        }

        // Retry on unique-violation: MAX+1 + concurrent backfill calls or a
        // racing createEmployee can both compute the same employee_number.
        let saved: Employee | null = null;
        let lastErr: any;
        for (let attempt = 0; attempt < 5 && !saved; attempt++) {
          try {
            const employeeNumber = await this.nextEmployeeNumberForFacility(facilityId);
            const employee = this.employeeRepository.create({
              employeeNumber,
              userId: user.id,
              firstName,
              lastName,
              email: user.email,
              phone: user.phone,
              dateOfBirth: new Date('1990-01-01'),
              gender: Gender.OTHER,
              jobTitle: roleName || 'Staff',
              staffCategory,
              employmentType: EmploymentType.PERMANENT,
              hireDate: user.createdAt || new Date(),
              basicSalary: 0,
              facilityId,
              tenantId: user.tenantId || tenantId,
            });
            saved = await this.employeeRepository.save(employee);
          } catch (e: any) {
            lastErr = e;
            if (e?.code !== '23505') throw e;
            await new Promise((r) => setTimeout(r, 10 + Math.random() * 30));
          }
        }
        if (!saved) {
          throw lastErr ?? new Error('Failed to allocate employee_number after 5 attempts');
        }
        created++;

        try {
          await this.auditLogRepository.save(
            this.auditLogRepository.create({
              userId: user.id,
              action: 'EMPLOYEE_BACKFILLED',
              entityType: 'Employee',
              entityId: saved.id,
              newValue: {
                employeeId: saved.id,
                employeeNumber: saved.employeeNumber,
                roleName: roleName ?? null,
                facilityId,
              },
              tenantId: user.tenantId || tenantId,
            }),
          );
        } catch (auditErr) {
          this.logger.warn(
            `Failed to audit employee backfill for user ${user.id}: ${(auditErr as Error).message}`,
          );
        }
      } catch (e) {
        this.logger.warn(
          `Failed to backfill employee for user ${user.id}: ${(e as Error).message}`,
        );
        skipped++;
      }
    }

    return { created, skipped };
  }

  private sanitizeUser(user: User) {
    const { passwordHash, mfaSecret, userRoles, ...sanitized } = user;
    return {
      ...sanitized,
      roles:
        userRoles?.map((ur: UserRole) => ({
          id: ur.role?.id,
          name: ur.role?.name,
        })) || [],
    };
  }

  async bulkImport(
    file: Express.Multer.File,
    tenantId?: string,
    facilityId?: string,
  ): Promise<BulkImportResult> {
    // Guard: file size limit (5 MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`,
      );
    }

    const rows = this.parseImportFile(file);

    // Guard: row count limit
    const MAX_ROWS = 1000;
    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(`Too many rows (${rows.length}). Maximum is ${MAX_ROWS}.`);
    }
    if (rows.length === 0) {
      throw new BadRequestException('File contains no data rows.');
    }

    // Validate required headers exist
    const headers = Object.keys(rows[0]);
    const requiredHeaders = ['username', 'full_name'];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new BadRequestException(`Missing required column(s): ${missingHeaders.join(', ')}`);
    }

    const errors: BulkImportRowError[] = [];
    let successful = 0;

    // Pre-fetch all roles for this tenant for name matching
    const roles = await this.roleRepository.find({
      where: tenantId ? [{ tenantId }, { tenantId: IsNull() }] : undefined,
    });
    const rolesByName = new Map(roles.map((r) => [r.name.toLowerCase(), r]));

    // Pre-fetch existing usernames scoped to tenant
    if (!tenantId) {
      this.logger.warn('bulkImport called without tenantId — username dedup will be global');
    }
    const existingUsers = await this.userRepository.find({
      where: tenantId ? { tenantId } : undefined,
      select: ['username'],
    });
    const existingUsernames = new Set(existingUsers.map((u) => u.username.toLowerCase()));

    // Validate all rows first
    const validatedRows: { index: number; data: Record<string, string>; role?: Role }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 for 1-based index + header row
      let hasError = false;

      const username = this.sanitizeCsvValue((row['username'] || '').trim());
      const email = this.sanitizeCsvValue((row['email'] || '').trim());
      const fullName = this.sanitizeCsvValue((row['full_name'] || '').trim());
      const roleName = this.sanitizeCsvValue((row['role'] || '').trim());
      const phone = this.sanitizeCsvValue((row['phone'] || '').trim());

      if (!username) {
        errors.push({ row: rowNum, field: 'username', message: 'Username is required' });
        hasError = true;
      } else if (/\s/.test(username)) {
        errors.push({
          row: rowNum,
          field: 'username',
          message: 'Username must not contain spaces',
        });
        hasError = true;
      } else if (username.length < 3 || username.length > 50) {
        errors.push({
          row: rowNum,
          field: 'username',
          message: 'Username must be 3-50 characters',
        });
        hasError = true;
      } else if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
        errors.push({
          row: rowNum,
          field: 'username',
          message: 'Username may only contain letters, digits, dots, hyphens, and underscores',
        });
        hasError = true;
      } else if (existingUsernames.has(username.toLowerCase())) {
        errors.push({
          row: rowNum,
          field: 'username',
          message: `Username "${username}" already exists`,
        });
        hasError = true;
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ row: rowNum, field: 'email', message: 'Invalid email format' });
        hasError = true;
      }

      if (!fullName) {
        errors.push({ row: rowNum, field: 'full_name', message: 'Full name is required' });
        hasError = true;
      } else if (fullName.length > 150) {
        errors.push({
          row: rowNum,
          field: 'full_name',
          message: 'Full name is too long (max 150 chars)',
        });
        hasError = true;
      }

      if (phone && !/^\+?[0-9\s()-]{7,20}$/.test(phone)) {
        errors.push({ row: rowNum, field: 'phone', message: 'Invalid phone format' });
        hasError = true;
      }

      let matchedRole: Role | undefined;
      if (roleName) {
        matchedRole = rolesByName.get(roleName.toLowerCase());
        if (!matchedRole) {
          errors.push({ row: rowNum, field: 'role', message: `Role "${roleName}" not found` });
          hasError = true;
        }
      }

      if (!hasError) {
        existingUsernames.add(username.toLowerCase());
        validatedRows.push({ index: rowNum, data: row, role: matchedRole });
      }
    }

    // Fix 4: track generated credentials outside the transaction scope
    const generatedPasswords: { username: string; password: string }[] = [];

    // Process valid rows in a transaction
    if (validatedRows.length > 0) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const saltRoundsConfig = this.configService.get<string>('BCRYPT_ROUNDS', '12');
        const saltRounds = parseInt(saltRoundsConfig, 10) || 12;
        // Fix 4: generate unique random password per user instead of hardcoded 'TempPass123!'
        const cryptoMod = await import('crypto');

        for (const { index: rowNum, data: row, role } of validatedRows) {
          try {
            const username = row['username'].trim();
            const email = (row['email'] || '').trim();
            const fullName = row['full_name'].trim();
            const phone = (row['phone'] || '').trim() || undefined;
            const department = (row['department'] || '').trim() || undefined;
            const jobTitle = (row['job_title'] || '').trim() || undefined;

            const tempPassword = cryptoMod.randomBytes(16).toString('base64url');
            const passwordHash = await bcrypt.hash(tempPassword, saltRounds);
            generatedPasswords.push({ username, password: tempPassword });

            const user = this.userRepository.create({
              username,
              email: email || `${username}@import.local`,
              fullName,
              phone,
              passwordHash,
              status: 'active',
              tenantId: tenantId || undefined,
              facilityId: facilityId || undefined,
              jobTitle,
              mustChangePassword: true,
            });

            const savedUser = await queryRunner.manager.save(user);

            // Create employee record (same pattern as create method)
            const nameParts = fullName.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || firstName;
            const employeeCount = await queryRunner.manager.count(Employee);
            const employeeNumber = `EMP${String(employeeCount + 1).padStart(5, '0')}`;
            const autoStaffCategory = role
              ? mapRoleToStaffCategory(role.name)
              : StaffCategory.OTHER;

            const employee = this.employeeRepository.create({
              employeeNumber,
              userId: savedUser.id,
              firstName,
              lastName,
              email: savedUser.email,
              phone,
              dateOfBirth: new Date('1990-01-01'),
              gender: Gender.OTHER,
              jobTitle: jobTitle || role?.name || 'Staff',
              department,
              staffCategory: autoStaffCategory,
              employmentType: EmploymentType.PERMANENT,
              hireDate: new Date(),
              basicSalary: 0,
              facilityId: facilityId || undefined,
              tenantId: tenantId || undefined,
            });

            await queryRunner.manager.save(employee);

            // Assign role if matched
            if (role) {
              const userRole = this.userRoleRepository.create({
                userId: savedUser.id,
                roleId: role.id,
                facilityId: facilityId || undefined,
              });
              await queryRunner.manager.save(userRole);
            }

            successful++;
          } catch (err) {
            errors.push({
              row: rowNum,
              field: 'general',
              message: err instanceof Error ? err.message : 'Unknown error creating user',
            });
          }
        }

        if (successful > 0) {
          await queryRunner.commitTransaction();
        } else {
          await queryRunner.rollbackTransaction();
        }
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    }

    return {
      total: rows.length,
      successful,
      failed: rows.length - successful,
      errors,
      // Fix 4: return generated passwords so admin can distribute them securely
      generatedCredentials: generatedPasswords,
    };
  }

  /**
   * Fix 5: Validate password against the tenant's PasswordPolicy entity.
   */
  private async validatePasswordAgainstPolicy(
    password: string,
    tenantId?: string,
    facilityId?: string,
  ): Promise<void> {
    const policyRepo = this.dataSource.getRepository(PasswordPolicy);
    let policy: PasswordPolicy | null = null;

    // Try facility-specific policy first
    if (facilityId) {
      policy = await policyRepo.findOne({ where: { facilityId, isActive: true } });
    }
    // Fall back to tenant default
    if (!policy && tenantId) {
      policy = await policyRepo.findOne({ where: { tenantId, isDefault: true, isActive: true } });
    }
    // Fall back to global default
    if (!policy) {
      policy = await policyRepo.findOne({ where: { isDefault: true, isActive: true } });
    }

    if (!policy) return; // No policy to enforce

    const errors: string[] = [];
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters`);
    }
    if (policy.maxLength && password.length > policy.maxLength) {
      errors.push(`Password must be at most ${policy.maxLength} characters`);
    }
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (policy.requireSpecialChars) {
      const specialChars = policy.allowedSpecialChars || '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const escaped = specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      if (!new RegExp(`[${escaped}]`).test(password)) {
        errors.push('Password must contain at least one special character');
      }
    }
    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '));
    }
  }

  /** Strip CSV injection prefixes (=, +, -, @, tab, CR) that could trigger formula execution in spreadsheet apps. */
  private sanitizeCsvValue(value: string): string {
    return value.replace(/^[=+\-@\t\r]+/, '');
  }

  private parseImportFile(file: Express.Multer.File): Record<string, string>[] {
    const isExcel =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname?.endsWith('.xlsx') ||
      file.originalname?.endsWith('.xls');

    if (isExcel) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new BadRequestException('Excel file has no sheets');
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[sheetName], {
        defval: '',
        raw: false,
      });
      return rows;
    }

    // CSV parsing
    const content = file.buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      throw new BadRequestException('CSV file must have a header row and at least one data row');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      rows.push(row);
    }

    return rows;
  }

  async bulkForcePasswordReset(userIds: string[], tenantId?: string) {
    if (!userIds?.length) throw new BadRequestException('No user IDs provided');
    const tid = requireTenantId(tenantId);
    const where: any = { id: In(userIds), tenantId: tid };
    const result = await this.userRepository.update(where, {
      mustChangePassword: true,
    } as any);
    // Best-effort revoke of active sessions
    try {
      await this.userRepository.manager
        .getRepository('UserSession')
        .createQueryBuilder()
        .update()
        .set({ revokedAt: () => 'NOW()', isActive: false })
        .where('user_id IN (:...ids)', { ids: userIds })
        .andWhere('is_active = true')
        .execute();
    } catch {
      /* sessions table optional; ignore */
    }
    return { affected: result.affected || 0, userIds };
  }
}
