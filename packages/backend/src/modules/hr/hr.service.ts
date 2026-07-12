import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  In,
  IsNull,
  Not,
  DataSource,
  DeepPartial,
} from 'typeorm';
import { ApprovalsService } from '../approvals/approvals.service';
import { Employee, EmploymentStatus } from '../../database/entities/employee.entity';
import { AttendanceRecord } from '../../database/entities/attendance.entity';
import { LeaveRequest, LeaveStatus, LeaveType } from '../../database/entities/leave-request.entity';
import { PayrollRun, PayrollStatus } from '../../database/entities/payroll-run.entity';
import { Payslip } from '../../database/entities/payslip.entity';
import { ShiftDefinition, ShiftType } from '../../database/entities/shift-definition.entity';
import { StaffRoster, RosterStatus } from '../../database/entities/staff-roster.entity';
import {
  ShiftSwapRequest,
  SwapRequestStatus,
} from '../../database/entities/shift-swap-request.entity';
import { JobPosting, JobStatus, EmploymentType as JobEmploymentType } from '../../database/entities/job-posting.entity';
import { JobApplication, ApplicationStatus } from '../../database/entities/job-application.entity';
import {
  PerformanceAppraisal,
  AppraisalStatus,
  AppraisalPeriod,
} from '../../database/entities/performance-appraisal.entity';
import { TrainingProgram, TrainingStatus, TrainingType } from '../../database/entities/training-program.entity';
import {
  TrainingEnrollment,
  EnrollmentStatus,
} from '../../database/entities/training-enrollment.entity';
import { User, StaffCategory, EmploymentType as UserEmploymentType } from '../../database/entities/user.entity';
import { Department } from '../../database/entities/department.entity';
import {
  StaffDocument,
  DocumentType,
  DocumentStatus,
} from '../../database/entities/staff-document.entity';
import {
  DisciplinaryAction,
  DisciplinaryType,
  DisciplinaryStatus,
} from '../../database/entities/disciplinary-action.entity';
import { SalaryHistory, SalaryChangeType } from '../../database/entities/salary-history.entity';
import {
  OnboardingTask,
  OnboardingCategory,
  OnboardingTaskStatus,
} from '../../database/entities/onboarding-task.entity';
import { Role } from '../../database/entities/role.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { FinanceService } from '../finance/finance.service';
import { requireTenantId } from '../../common/utils/tenant.util';
import * as bcrypt from 'bcrypt';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  RecordAttendanceDto,
  ClockInOutDto,
  RequestLeaveDto,
  ApproveLeaveDto,
  CreatePayrollRunDto,
  ProcessPayrollDto,
  CreateShiftDefinitionDto,
  CreateRosterDto,
  RequestShiftSwapDto,
  ApproveSwapDto,
  CreateJobPostingDto,
  UpdateJobPostingDto,
  CreateJobApplicationDto,
  UpdateApplicationStatusDto,
  CreateAppraisalDto,
  UpdateAppraisalDto,
  CreateTrainingProgramDto,
  UpdateTrainingProgramDto,
  EnrollEmployeeDto,
  UpdateEnrollmentDto,
} from './dto/hr.dto';

@Injectable()
export class HrService {
  private readonly logger = new Logger(HrService.name);

  constructor(
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
    @InjectRepository(AttendanceRecord)
    private attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(LeaveRequest)
    private leaveRepo: Repository<LeaveRequest>,
    @InjectRepository(PayrollRun)
    private payrollRunRepo: Repository<PayrollRun>,
    @InjectRepository(Payslip)
    private payslipRepo: Repository<Payslip>,
    @InjectRepository(ShiftDefinition)
    private shiftDefRepo: Repository<ShiftDefinition>,
    @InjectRepository(StaffRoster)
    private rosterRepo: Repository<StaffRoster>,
    @InjectRepository(ShiftSwapRequest)
    private swapRepo: Repository<ShiftSwapRequest>,
    @InjectRepository(JobPosting)
    private jobPostingRepo: Repository<JobPosting>,
    @InjectRepository(JobApplication)
    private jobApplicationRepo: Repository<JobApplication>,
    @InjectRepository(PerformanceAppraisal)
    private appraisalRepo: Repository<PerformanceAppraisal>,
    @InjectRepository(TrainingProgram)
    private trainingProgramRepo: Repository<TrainingProgram>,
    @InjectRepository(TrainingEnrollment)
    private trainingEnrollmentRepo: Repository<TrainingEnrollment>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Department)
    private departmentRepo: Repository<Department>,
    @InjectRepository(StaffDocument)
    private documentRepo: Repository<StaffDocument>,
    @InjectRepository(DisciplinaryAction)
    private disciplinaryRepo: Repository<DisciplinaryAction>,
    @InjectRepository(SalaryHistory)
    private salaryHistoryRepo: Repository<SalaryHistory>,
    @InjectRepository(OnboardingTask)
    private onboardingTaskRepo: Repository<OnboardingTask>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
    @Inject(forwardRef(() => FinanceService))
    private financeService: FinanceService,
    private dataSource: DataSource,
    @Optional()
    @Inject(forwardRef(() => ApprovalsService))
    private approvalsService?: ApprovalsService,
  ) {}

  /**
   * Persist a row into audit_logs. Failures are swallowed so that an
   * audit-insert error never blocks the HR action itself (the action's
   * own tx commits or rolls back independently).
   */
  private async writeAudit(params: {
    action: string;
    entityType: string;
    entityId: string;
    actorUserId?: string;
    tenantId?: string;
    newValue?: any;
    oldValue?: any;
  }): Promise<void> {
    try {
      await this.auditLogRepo.save(
        this.auditLogRepo.create({
          userId: params.actorUserId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          tenantId: params.tenantId,
          newValue: params.newValue,
          oldValue: params.oldValue,
        }),
      );
    } catch (err: any) {
      this.logger.warn(
        `audit log insert failed for ${params.action} ${params.entityType}:${params.entityId}: ${err?.message}`,
      );
    }
  }

  // ============ STAFF MANAGEMENT (Users as Staff) ============

  async getStaff(
    facilityId?: string,
    options: { status?: string; departmentId?: string; limit?: number; offset?: number } = {},
    tenantId?: string,
  ) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.department', 'department')
      .leftJoinAndSelect('u.facility', 'facility')
      .leftJoinAndSelect('u.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .where('u.deletedAt IS NULL');

    qb.andWhere('u.tenantId = :tenantId', { tenantId: requireTenantId(tenantId) });
    if (options.status) qb.andWhere('u.status = :status', { status: options.status });
    if (options.departmentId)
      qb.andWhere('u.departmentId = :deptId', { deptId: options.departmentId });
    if (facilityId) {
      // Match by user.facilityId OR by any user_role at that facility
      // (legacy users have NULL users.facility_id and rely on role-scoped facility)
      qb.andWhere(
        '(u.facilityId = :facilityId OR u.facilityId IS NULL OR EXISTS (SELECT 1 FROM user_roles ur2 WHERE ur2.user_id = u.id AND ur2.facility_id = :facilityId))',
        { facilityId },
      );
    }

    qb.orderBy('u.fullName', 'ASC')
      .take(options.limit || 50)
      .skip(options.offset || 0);

    const [data, total] = await qb.getManyAndCount();

    // Transform to staff format
    const staff = data.map((user) => ({
      id: user.id,
      employeeNumber: user.employeeNumber || `EMP${user.id.slice(0, 5).toUpperCase()}`,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      username: user.username,
      roles: (user.userRoles || [])
        .map((ur: any) => ({ id: ur.role?.id, name: ur.role?.name }))
        .filter((r: any) => r.id),
      jobTitle: user.jobTitle || 'Not Assigned',
      department: user.department?.name || 'Unassigned',
      departmentId: user.departmentId,
      staffCategory: user.staffCategory,
      employmentType: user.employmentType || 'permanent',
      status: user.status,
      hireDate: user.hireDate,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      basicSalary: user.basicSalary,
      annualLeaveBalance: user.annualLeaveBalance || 21,
      sickLeaveBalance: user.sickLeaveBalance || 10,
      facilityId: user.facilityId,
      facility: user.facility,
      lastLoginAt: user.lastLoginAt,
    }));

    return {
      data: staff,
      meta: { total, limit: options.limit || 50, offset: options.offset || 0 },
    };
  }

  async getStaffById(id: string, tenantId?: string) {
    const user = await this.userRepo.findOne({
      where: { id, deletedAt: IsNull(), tenantId: requireTenantId(tenantId) },
      relations: ['department', 'facility', 'userRoles', 'userRoles.role'],
    });
    if (!user) throw new NotFoundException('Staff member not found');
    return user;
  }

  async updateStaff(
    id: string,
    dto: {
      jobTitle?: string;
      staffCategory?: string;
      employmentType?: string;
      departmentId?: string;
      facilityId?: string;
      dateOfBirth?: string;
      gender?: string;
      hireDate?: string;
      basicSalary?: number;
      allowances?: { name: string; amount: number; taxable: boolean }[];
      deductions?: { name: string; amount: number; type: 'fixed' | 'percentage' }[];
      phone?: string;
      address?: string;
      nationalId?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      bankName?: string;
      bankAccountNumber?: string;
    },
    tenantId?: string,
  ) {
    const user = await this.getStaffById(id, tenantId);

    if (dto.jobTitle !== undefined) user.jobTitle = dto.jobTitle;
    if (dto.staffCategory !== undefined) user.staffCategory = dto.staffCategory as StaffCategory;
    if (dto.employmentType !== undefined) user.employmentType = dto.employmentType as UserEmploymentType;
    if (dto.departmentId !== undefined) user.departmentId = dto.departmentId;
    if (dto.facilityId !== undefined) user.facilityId = dto.facilityId;
    if (dto.dateOfBirth !== undefined) user.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.gender !== undefined) user.gender = dto.gender;
    if (dto.hireDate !== undefined) user.hireDate = new Date(dto.hireDate);
    if (dto.basicSalary !== undefined) user.basicSalary = dto.basicSalary;
    if (dto.allowances !== undefined) user.allowances = dto.allowances;
    if (dto.deductions !== undefined) user.deductions = dto.deductions;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.address !== undefined) user.address = dto.address;
    if (dto.nationalId !== undefined) user.nationalId = dto.nationalId;
    if (dto.emergencyContactName !== undefined)
      user.emergencyContactName = dto.emergencyContactName;
    if (dto.emergencyContactPhone !== undefined)
      user.emergencyContactPhone = dto.emergencyContactPhone;
    if (dto.bankName !== undefined) user.bankName = dto.bankName;
    if (dto.bankAccountNumber !== undefined) user.bankAccountNumber = dto.bankAccountNumber;

    return this.userRepo.save(user);
  }

  async getStaffDashboard(facilityId?: string, tenantId?: string) {
    const baseQb = () => {
      const qb = this.userRepo.createQueryBuilder('u').where('u.deletedAt IS NULL');
      qb.andWhere('u.tenantId = :tenantId', { tenantId: requireTenantId(tenantId) });
      if (facilityId) {
        qb.andWhere(
          '(u.facilityId = :facilityId OR u.facilityId IS NULL OR EXISTS (SELECT 1 FROM user_roles ur2 WHERE ur2.user_id = u.id AND ur2.facility_id = :facilityId))',
          { facilityId },
        );
      }
      return qb;
    };

    const totalStaff = await baseQb().getCount();
    const activeStaff = await baseQb().andWhere('u.status = :s', { s: 'active' }).getCount();
    const onLeaveStaff = await baseQb().andWhere('u.status = :s', { s: 'on_leave' }).getCount();
    const resignedStaff = await baseQb()
      .andWhere('u.status IN (:...statuses)', { statuses: ['resigned', 'terminated', 'inactive'] })
      .getCount();

    // Get pending leave requests count
    const pendingLeave = await this.leaveRepo.count({
      where: { status: LeaveStatus.PENDING, tenantId: requireTenantId(tenantId) },
    });

    return {
      totalEmployees: totalStaff,
      activeEmployees: activeStaff,
      onLeave: onLeaveStaff,
      resigned: resignedStaff,
      pendingLeaveRequests: pendingLeave,
      presentToday: activeStaff, // Simplified - would need attendance tracking
      absentToday: 0,
    };
  }

  // Get designation/job title statistics
  async getDesignationStats(tenantId?: string) {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .select('user.jobTitle', 'jobTitle')
      .addSelect('user.staffCategory', 'staffCategory')
      .addSelect('COUNT(user.id)', 'count')
      .where('user.deletedAt IS NULL');
    qb.andWhere('user.tenant_id = :tenantId', { tenantId: requireTenantId(tenantId) });
    const stats = await qb.groupBy('user.jobTitle').addGroupBy('user.staffCategory').getRawMany();

    return stats.map((s) => ({
      jobTitle: s.jobTitle || 'Not Assigned',
      staffCategory: s.staffCategory || 'Other',
      count: parseInt(s.count),
    }));
  }

  // Get staff by category (consultants, specialists, etc.)
  async getStaffByCategory(category: string, tenantId?: string) {
    return this.userRepo.find({
      where: {
        staffCategory: category as StaffCategory,
        deletedAt: IsNull(),
        tenantId: requireTenantId(tenantId),
      },
      select: [
        'id',
        'fullName',
        'email',
        'phone',
        'employeeNumber',
        'jobTitle',
        'departmentId',
        'status',
      ],
      order: { fullName: 'ASC' },
    });
  }

  // Generate employee number for new staff
  private async generateStaffEmployeeNumber(): Promise<string> {
    const maxResult = await this.userRepo
      .createQueryBuilder('user')
      .select('MAX(user.employeeNumber)', 'maxNum')
      .where('user.employeeNumber LIKE :pattern', { pattern: 'EMP%' })
      .getRawOne();

    let nextNum = 1;
    if (maxResult?.maxNum) {
      const currentNum = parseInt(maxResult.maxNum.replace('EMP', ''), 10);
      nextNum = isNaN(currentNum) ? 1 : currentNum + 1;
    }
    return `EMP${String(nextNum).padStart(5, '0')}`;
  }

  // Create new staff member (unified - creates user with HR fields and assigns role)
  async createStaff(
    dto: {
      // Basic info
      fullName: string;
      email: string;
      phone?: string;
      username?: string;
      password?: string;
      // HR info
      facilityId: string;
      departmentId?: string;
      jobTitle?: string;
      staffCategory?: string;
      employmentType?: string;
      dateOfBirth?: string;
      gender?: string;
      hireDate?: string;
      basicSalary?: number;
      nationalId?: string;
      address?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      bankName?: string;
      bankAccountNumber?: string;
      // Role assignment
      roleId?: string;
    },
    tenantId?: string,
  ) {
    // Check for existing email
    const existingEmail = await this.userRepo.findOne({
      where: { email: dto.email, tenantId: requireTenantId(tenantId) },
    });
    if (existingEmail) {
      throw new ConflictException('A user with this email already exists');
    }

    // Generate username if not provided
    const username =
      dto.username ||
      dto.email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    // Check for existing username
    const existingUsername = await this.userRepo.findOne({
      where: { username, tenantId: requireTenantId(tenantId) },
    });
    if (existingUsername) {
      throw new ConflictException('A user with this username already exists');
    }

    // Generate employee number
    const employeeNumber = await this.generateStaffEmployeeNumber();

    // Hash password (default to employee number if not provided)
    const password = dto.password || employeeNumber;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with HR fields
    const user = this.userRepo.create({
      username,
      passwordHash: hashedPassword,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      status: 'active',
      employeeNumber,
      facilityId: dto.facilityId,
      departmentId: dto.departmentId,
      jobTitle: dto.jobTitle,
      staffCategory: dto.staffCategory as StaffCategory,
      employmentType: dto.employmentType as UserEmploymentType,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      gender: dto.gender,
      hireDate: dto.hireDate ? new Date(dto.hireDate) : new Date(),
      basicSalary: dto.basicSalary,
      nationalId: dto.nationalId,
      address: dto.address,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: dto.emergencyContactPhone,
      bankName: dto.bankName,
      bankAccountNumber: dto.bankAccountNumber,
      annualLeaveBalance: 21,
      sickLeaveBalance: 10,
      tenantId: requireTenantId(tenantId),
    });

    const savedUser = await this.userRepo.save(user);

    // Assign role if provided
    if (dto.roleId) {
      const role = await this.roleRepo.findOne({
        where: { id: dto.roleId, tenantId: requireTenantId(tenantId) },
      });
      if (role) {
        const userRole = this.userRoleRepo.create({
          userId: savedUser.id,
          roleId: dto.roleId,
          facilityId: dto.facilityId,
        });
        await this.userRoleRepo.save(userRole);
      }
    }

    return {
      id: savedUser.id,
      employeeNumber: savedUser.employeeNumber,
      fullName: savedUser.fullName,
      email: savedUser.email,
      phone: savedUser.phone,
      username: savedUser.username,
      jobTitle: savedUser.jobTitle,
      department: savedUser.departmentId,
      staffCategory: savedUser.staffCategory,
      employmentType: savedUser.employmentType,
      status: savedUser.status,
      hireDate: savedUser.hireDate,
      facilityId: savedUser.facilityId,
      temporaryPassword: password !== dto.password ? password : undefined,
    };
  }

  // Deactivate staff member (unified - updates user status)
  async deactivateStaff(id: string, reason?: string, tenantId?: string) {
    const user = await this.userRepo.findOne({ where: { id, tenantId: requireTenantId(tenantId) } });
    if (!user) throw new NotFoundException('Staff member not found');

    user.status = 'inactive';
    await this.userRepo.save(user);

    return { success: true, message: 'Staff member deactivated' };
  }

  // Reactivate staff member
  async reactivateStaff(id: string, tenantId?: string) {
    const user = await this.userRepo.findOne({ where: { id, tenantId: requireTenantId(tenantId) } });
    if (!user) throw new NotFoundException('Staff member not found');

    user.status = 'active';
    await this.userRepo.save(user);

    return { success: true, message: 'Staff member reactivated' };
  }

  // Offboard employee (comprehensive deactivation workflow)
  async offboardEmployee(
    userId: string,
    dto: {
      reason: string;
      terminationDate?: string;
      revokeAccess?: boolean;
      deactivateAccount?: boolean;
    },
    performedById: string,
    tenantId?: string,
  ) {
    const user = await this.userRepo.findOne({
      where: { id: userId, tenantId: requireTenantId(tenantId) },
    });
    if (!user) throw new NotFoundException('Staff member not found');

    const revokeAccess = dto.revokeAccess !== false; // default true
    const deactivateAccount = dto.deactivateAccount !== false; // default true
    const checklist: Record<string, boolean> = {};

    // 1. Deactivate user account
    if (deactivateAccount) {
      user.status = 'inactive';
      checklist['accountDeactivated'] = true;
    }

    // 2. Increment tokenVersion to revoke all active sessions
    if (revokeAccess) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      checklist['sessionsRevoked'] = true;
    }

    await this.userRepo.save(user);

    // 3. Record termination in employee if linked
    const employee = await this.employeeRepo.findOne({
      where: { userId, tenantId: requireTenantId(tenantId) },
    });
    if (employee) {
      employee.status = EmploymentStatus.TERMINATED;
      if (dto.terminationDate) {
        employee.terminationDate = new Date(dto.terminationDate);
      }
      await this.employeeRepo.save(employee);
      checklist['employeeRecordUpdated'] = true;
    }

    checklist['terminationRecorded'] = true;

    this.logger.log(`Employee ${userId} offboarded by ${performedById}. Reason: ${dto.reason}`);

    return {
      success: true,
      message: 'Employee offboarded successfully',
      checklist,
      terminationDate: dto.terminationDate || new Date().toISOString().split('T')[0],
      reason: dto.reason,
    };
  }

  // ============ EMPLOYEE MANAGEMENT (Legacy) ============

  private async generateEmployeeNumber(facilityId: string): Promise<string> {
    // Use MAX(numeric suffix)+1 instead of COUNT()+1 so that deletes don't
    // collapse the sequence and clash with existing rows. Caller still needs
    // retry-on-unique-violation to be safe under concurrent inserts.
    const row = await this.employeeRepo
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

  /**
   * Resolve the user-supplied department fields to a coherent
   * (departmentId, departmentName) pair. Either field may be provided
   * (or both, or neither):
   *
   *   - If departmentId is given, the row is looked up in the same
   *     tenant; the canonical name from `departments` overrides any
   *     free-text the caller sent (single source of truth).
   *   - If only free-text is given, we try a case-insensitive match
   *     against `departments.name` in the same tenant. On a hit we
   *     populate departmentId; the text is preserved verbatim either
   *     way.
   *   - Cross-tenant departmentIds throw BadRequestException.
   */
  private async resolveDepartmentFields(
    departmentId: string | undefined,
    departmentText: string | undefined,
    tenantId: string | undefined,
  ): Promise<{ departmentId?: string; department?: string }> {
    if (departmentId) {
      const dept = await this.departmentRepo.findOne({
        where: { id: departmentId, tenantId: requireTenantId(tenantId) },
      });
      if (!dept) {
        throw new BadRequestException('Department not found in this tenant');
      }
      return { departmentId: dept.id, department: dept.name };
    }
    if (departmentText && departmentText.trim()) {
      const trimmed = departmentText.trim();
      const match = await this.departmentRepo
        .createQueryBuilder('d')
        .where('LOWER(TRIM(d.name)) = LOWER(:name)', { name: trimmed })
        .andWhere('d.tenant_id = :tenantId', { tenantId: requireTenantId(tenantId) })
        .getOne();
      return { departmentId: match?.id, department: trimmed };
    }
    return { departmentId: undefined, department: departmentText };
  }

  async createEmployee(dto: CreateEmployeeDto, tenantId?: string): Promise<Employee> {
    // employees.employee_number has a UNIQUE constraint. Two concurrent
    // creates can both compute the same number and collide. Retry up to 5x
    // on unique-violation (Postgres error code 23505) before giving up.
    const resolvedDept = await this.resolveDepartmentFields(
      dto.departmentId,
      dto.department,
      tenantId,
    );
    let lastErr: any;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const employeeNumber = await this.generateEmployeeNumber(dto.facilityId);
        const employee = this.employeeRepo.create({
          employeeNumber,
          facilityId: dto.facilityId,
          userId: dto.userId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          otherNames: dto.otherNames,
          dateOfBirth: new Date(dto.dateOfBirth),
          gender: dto.gender,
          maritalStatus: dto.maritalStatus,
          nationalId: dto.nationalId,
          nssfNumber: dto.nssfNumber,
          tinNumber: dto.tinNumber,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          jobTitle: dto.jobTitle,
          department: resolvedDept.department,
          departmentId: resolvedDept.departmentId,
          employmentType: dto.employmentType,
          hireDate: new Date(dto.hireDate),
          salaryGrade: dto.salaryGrade,
          basicSalary: dto.basicSalary,
          allowances: dto.allowances,
          bankName: dto.bankName,
          bankAccountNumber: dto.bankAccountNumber,
          status: EmploymentStatus.ACTIVE,
          tenantId: requireTenantId(tenantId),
        });
        return await this.employeeRepo.save(employee);
      } catch (err: any) {
        lastErr = err;
        if (err?.code !== '23505') throw err;
        // brief jitter to break ties on the next attempt
        await new Promise((r) => setTimeout(r, 10 + Math.random() * 30));
      }
    }
    throw lastErr;
  }

  async getEmployees(
    facilityId: string | undefined,
    options: {
      status?: EmploymentStatus;
      department?: string;
      departmentId?: string;
      limit?: number;
      offset?: number;
    },
    tenantId?: string,
  ) {
    const where: any = {};
    if (facilityId) where.facilityId = facilityId;
    where.tenantId = requireTenantId(tenantId);
    if (options.status) where.status = options.status;
    // departmentId (FK) is preferred when both are supplied
    if (options.departmentId) where.departmentId = options.departmentId;
    else if (options.department) where.department = options.department;

    const [data, total] = await this.employeeRepo.findAndCount({
      where,
      relations: ['departmentRef'],
      order: { lastName: 'ASC', firstName: 'ASC' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    return { data, meta: { total, limit: options.limit || 50, offset: options.offset || 0 } };
  }

  async getEmployeeById(id: string, tenantId?: string): Promise<Employee> {
    const employee = await this.employeeRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
      relations: ['facility', 'user', 'departmentRef'],
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto, tenantId?: string): Promise<Employee> {
    const employee = await this.getEmployeeById(id, tenantId);
    const incomingDeptId = dto.departmentId;
    const incomingDeptText = dto.department;
    // Only re-resolve when the caller actually touched a department field.
    // departmentId, when present, is canonical; otherwise text is the source
    // of truth and we must NOT fall back to the existing FK (that would
    // silently ignore a text-only update).
    if (incomingDeptId !== undefined || incomingDeptText !== undefined) {
      const resolved = await this.resolveDepartmentFields(
        incomingDeptId,
        incomingDeptText,
        tenantId,
      );
      employee.departmentId = resolved.departmentId ?? undefined;
      employee.department = (resolved.department ?? null) as string;
      // Important: clear the loaded relation object so TypeORM doesn't
      // overwrite our direct departmentId write with the stale FK from
      // the previously-loaded Department.
      employee.departmentRef = resolved.departmentId
        ? ({ id: resolved.departmentId } as unknown as Department)
        : undefined;
    }
    // Remove department fields from dto so Object.assign below doesn't
    // re-overwrite the resolved values with raw input.
    const { department: _d, departmentId: _di, ...rest } = dto;
    Object.assign(employee, rest);
    return this.employeeRepo.save(employee);
  }

  async terminateEmployee(id: string, reason: string, tenantId?: string): Promise<Employee> {
    const employee = await this.getEmployeeById(id, tenantId);
    employee.status = EmploymentStatus.TERMINATED;
    employee.terminationDate = new Date();
    employee.terminationReason = reason;
    return this.employeeRepo.save(employee);
  }

  // ============ ATTENDANCE ============

  async recordAttendance(
    dto: RecordAttendanceDto,
    facilityId: string,
    tenantId?: string,
  ): Promise<AttendanceRecord> {
    // Check if record exists for this date
    const existing = await this.attendanceRepo.findOne({
      where: {
        employeeId: dto.employeeId,
        date: new Date(dto.date),
        tenantId: requireTenantId(tenantId),
      },
    });

    if (existing) {
      // Update existing record
      if (dto.clockIn) existing.clockIn = dto.clockIn;
      if (dto.clockOut) existing.clockOut = dto.clockOut;
      if (dto.status) existing.status = dto.status;
      if (dto.notes) existing.notes = dto.notes;

      // Calculate hours worked
      if (existing.clockIn && existing.clockOut) {
        existing.hoursWorked = this.calculateHoursWorked(existing.clockIn, existing.clockOut);
      }

      return this.attendanceRepo.save(existing);
    }

    const record = this.attendanceRepo.create({
      employeeId: dto.employeeId,
      date: new Date(dto.date),
      clockIn: dto.clockIn,
      clockOut: dto.clockOut,
      status: dto.status || 'present',
      notes: dto.notes,
      facilityId,
      tenantId: requireTenantId(tenantId),
    });

    return this.attendanceRepo.save(record);
  }

  async clockIn(
    employeeId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<AttendanceRecord> {
    const today = new Date();
    const time = today.toTimeString().slice(0, 5);

    return this.recordAttendance(
      {
        employeeId,
        date: today.toISOString().slice(0, 10),
        clockIn: time,
        status: 'present',
      },
      facilityId,
      tenantId,
    );
  }

  /**
   * Resolve the target employee for a clock-in / clock-out request.
   *
   * Default behaviour: the caller clocks themselves in/out (target is derived
   * from req.user.id, not from the request body). This blocks attendance
   * impersonation, where a user could previously POST any employeeId and
   * fabricate attendance for them.
   *
   * A manager-tier caller (HR Manager, Facility Manager, Department Head,
   * Super Admin) MAY pass an explicit employeeId in the body to record
   * attendance on someone else's behalf — that's the legitimate "manager
   * clocks team in" path. The target must be in the same tenant.
   */
  async resolveAttendanceTarget(
    bodyEmployeeId: string | undefined,
    user: { id?: string; userId?: string; tenantId?: string; roles?: string[] } | undefined,
    op: 'clock-in' | 'clock-out',
  ): Promise<string> {
    const callerUserId = user?.id || user?.userId;
    if (!callerUserId) {
      throw new BadRequestException('Authenticated user context required');
    }

    const tenantWhere = { tenantId: requireTenantId(user?.tenantId) };
    const selfEmp = await this.employeeRepo.findOne({
      where: { userId: callerUserId, ...tenantWhere },
    });

    if (!bodyEmployeeId || bodyEmployeeId === selfEmp?.id) {
      if (!selfEmp) {
        throw new BadRequestException(
          `No employee record linked to your user account; cannot ${op} for self`,
        );
      }
      return selfEmp.id;
    }

    // Proxy clock-in/out for another employee → manager-tier only.
    const managerRoles = new Set([
      'Super Admin',
      'Administrator',
      'HR Manager',
      'Facility Manager',
      'Department Head',
    ]);
    const isManager = (user?.roles || []).some((r) => managerRoles.has(r));
    if (!isManager) {
      throw new BadRequestException(
        `You can only ${op} for yourself; managers may record attendance on behalf of others`,
      );
    }

    // Verify target exists in the same tenant (defence-in-depth — controller
    // RBAC already requires hr.create/hr.update).
    const target = await this.employeeRepo.findOne({
      where: { id: bodyEmployeeId, ...tenantWhere },
    });
    if (!target) {
      throw new NotFoundException('Target employee not found in your tenant');
    }
    return target.id;
  }

  async clockOut(
    employeeId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<AttendanceRecord> {
    const today = new Date();
    const time = today.toTimeString().slice(0, 5);

    return this.recordAttendance(
      {
        employeeId,
        date: today.toISOString().slice(0, 10),
        clockOut: time,
      },
      facilityId,
      tenantId,
    );
  }

  private calculateHoursWorked(clockIn: string, clockOut: string): number {
    const [inH, inM] = clockIn.split(':').map(Number);
    const [outH, outM] = clockOut.split(':').map(Number);
    const inMinutes = inH * 60 + inM;
    const outMinutes = outH * 60 + outM;
    return Math.round(((outMinutes - inMinutes) / 60) * 100) / 100;
  }

  async getAttendance(
    facilityId: string,
    options: {
      employeeId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
    tenantId?: string,
  ) {
    const where: any = { facilityId };
    where.tenantId = requireTenantId(tenantId);
    if (options.employeeId) where.employeeId = options.employeeId;
    if (options.startDate && options.endDate) {
      where.date = Between(new Date(options.startDate), new Date(options.endDate));
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(200, Math.max(1, options.limit || 50));

    const [data, total] = await this.attendanceRepo.findAndCount({
      where,
      relations: ['employee'],
      order: { date: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  // ============ LEAVE MANAGEMENT ============

  async requestLeave(dto: RequestLeaveDto, tenantId?: string): Promise<LeaveRequest> {
    const employee = await this.getEmployeeById(dto.employeeId, tenantId);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid start or end date');
    }
    if (endDate < startDate) {
      throw new BadRequestException('End date must be on or after start date');
    }
    const daysRequested =
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (daysRequested <= 0) {
      throw new BadRequestException('Leave duration must be at least one day');
    }

    // Reject overlapping pending/approved requests for same employee
    const overlap = await this.leaveRepo
      .createQueryBuilder('l')
      .where('l.employeeId = :eid', { eid: dto.employeeId })
      .andWhere('l.status IN (:...statuses)', {
        statuses: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
      })
      .andWhere('l.startDate <= :end AND l.endDate >= :start', {
        start: startDate,
        end: endDate,
      })
      .getOne();
    if (overlap) {
      throw new BadRequestException('An overlapping leave request already exists for this period');
    }

    // Check leave balance for annual/sick leave
    if (dto.leaveType === LeaveType.ANNUAL && daysRequested > employee.annualLeaveBalance) {
      throw new BadRequestException(
        `Insufficient annual leave balance. Available: ${employee.annualLeaveBalance} days`,
      );
    }
    if (dto.leaveType === LeaveType.SICK && daysRequested > employee.sickLeaveBalance) {
      throw new BadRequestException(
        `Insufficient sick leave balance. Available: ${employee.sickLeaveBalance} days`,
      );
    }

    const leave = this.leaveRepo.create({
      employeeId: dto.employeeId,
      leaveType: dto.leaveType,
      startDate,
      endDate,
      daysRequested,
      reason: dto.reason,
      status: LeaveStatus.PENDING,
      tenantId: requireTenantId(tenantId),
    });

    const saved = await this.leaveRepo.save(leave);

    // Submit through the cross-cutting Approvals engine.
    // Falls back silently to the legacy approveLeave() flow if the engine
    // can't resolve a chain (no policy + no manager).
    if (this.approvalsService && employee.userId) {
      try {
        await this.approvalsService.submit({
          module: 'hr',
          documentType: 'leave',
          documentId: saved.id,
          tenantId: tenantId || saved.tenantId || '',
          requesterId: employee.userId,
          amount: daysRequested,
          departmentId: employee.departmentId || null,
          category: dto.leaveType,
        });
      } catch (e) {
        this.logger.warn(
          `Approval submit failed for leave ${saved.id}: ${(e as Error).message}; continuing with legacy flow`,
        );
      }
    }

    return saved;
  }

  /**
   * Called by HrApprovalListener when the engine signals approval.completed
   * for module=hr / documentType=leave. Sets the LeaveRequest to APPROVED and
   * deducts balances. Idempotent: no-op if already finalized.
   */
  async finalizeLeaveFromApproval(
    leaveId: string,
    actorUserId: string | undefined,
    approved: boolean,
    note?: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const leaveRepo = manager.getRepository(LeaveRequest);
      const employeeRepo = manager.getRepository(Employee);

      const leave = await leaveRepo.findOne({
        where: { id: leaveId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!leave || leave.status !== LeaveStatus.PENDING) return;

      leave.status = approved ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;
      leave.approvedById = actorUserId || (null as unknown as string);
      leave.approvedAt = new Date();
      if (note) leave.approvalNotes = note;

      if (approved) {
        const employee = await employeeRepo.findOne({
          where: { id: leave.employeeId },
          lock: { mode: 'pessimistic_write' },
        });
        if (employee) {
          if (leave.leaveType === LeaveType.ANNUAL) {
            if (employee.annualLeaveBalance < leave.daysRequested) {
              this.logger.warn(
                `[HR] Auto-approval would overdraw annual balance for employee ${employee.id}; marking REJECTED`,
              );
              leave.status = LeaveStatus.REJECTED;
              leave.approvalNotes =
                (leave.approvalNotes ? leave.approvalNotes + '\n' : '') +
                '[Insufficient annual leave balance at approval time]';
            } else {
              employee.annualLeaveBalance -= leave.daysRequested;
              await employeeRepo.save(employee);
            }
          } else if (leave.leaveType === LeaveType.SICK) {
            if (employee.sickLeaveBalance < leave.daysRequested) {
              leave.status = LeaveStatus.REJECTED;
              leave.approvalNotes =
                (leave.approvalNotes ? leave.approvalNotes + '\n' : '') +
                '[Insufficient sick leave balance at approval time]';
            } else {
              employee.sickLeaveBalance -= leave.daysRequested;
              await employeeRepo.save(employee);
            }
          }
        }
      }
      await leaveRepo.save(leave);
      this.logger.log(
        `[HR_NOTIFY] leave.${leave.status.toLowerCase()} (via approvals) leaveId=${leave.id}`,
      );
    });
  }

  async approveLeave(
    id: string,
    dto: ApproveLeaveDto,
    userId: string,
    tenantId?: string,
  ): Promise<LeaveRequest> {
    return this.dataSource.transaction(async (manager) => {
      const leaveRepo = manager.getRepository(LeaveRequest);
      const employeeRepo = manager.getRepository(Employee);

      const leave = await leaveRepo.findOne({
        where: { id, tenantId: requireTenantId(tenantId) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!leave) throw new NotFoundException('Leave request not found');

      if (leave.status !== LeaveStatus.PENDING) {
        throw new BadRequestException('Leave request has already been processed');
      }

      leave.status = dto.approved ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;
      leave.approvedById = userId;
      leave.approvedAt = new Date();
      if (dto.notes) leave.approvalNotes = dto.notes;

      if (dto.approved) {
        const employee = await employeeRepo.findOne({
          where: { id: leave.employeeId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!employee) throw new NotFoundException('Employee not found');

        if (leave.leaveType === LeaveType.ANNUAL) {
          if (employee.annualLeaveBalance < leave.daysRequested) {
            throw new BadRequestException(
              `Cannot approve: insufficient annual leave balance (${employee.annualLeaveBalance} available, ${leave.daysRequested} requested).`,
            );
          }
          employee.annualLeaveBalance -= leave.daysRequested;
        } else if (leave.leaveType === LeaveType.SICK) {
          if (employee.sickLeaveBalance < leave.daysRequested) {
            throw new BadRequestException(
              `Cannot approve: insufficient sick leave balance (${employee.sickLeaveBalance} available, ${leave.daysRequested} requested).`,
            );
          }
          employee.sickLeaveBalance -= leave.daysRequested;
        }
        await employeeRepo.save(employee);
        this.logger.log(
          `[HR_NOTIFY] leave.approved employeeId=${employee.id} type=${leave.leaveType} days=${leave.daysRequested}`,
        );
      } else {
        this.logger.log(
          `[HR_NOTIFY] leave.rejected employeeId=${leave.employeeId} type=${leave.leaveType}`,
        );
      }

      const saved = await leaveRepo.save(leave);

      await this.writeAudit({
        action: dto.approved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
        entityType: 'LeaveRequest',
        entityId: id,
        actorUserId: userId,
        tenantId,
        newValue: {
          status: saved.status,
          leaveType: leave.leaveType,
          daysRequested: leave.daysRequested,
        },
      });

      return saved;
    });
  }

  async getLeaveRequests(
    facilityId: string,
    options: { status?: LeaveStatus; employeeId?: string; page?: number; limit?: number },
    tenantId?: string,
  ) {
    const qb = this.leaveRepo
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.employee', 'employee')
      .where('employee.facilityId = :facilityId', { facilityId });
    qb.andWhere('leave.tenantId = :tenantId', { tenantId: requireTenantId(tenantId) });

    if (options.status) {
      qb.andWhere('leave.status = :status', { status: options.status });
    }
    if (options.employeeId) {
      qb.andWhere('leave.employeeId = :employeeId', { employeeId: options.employeeId });
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(200, Math.max(1, options.limit || 50));

    const [data, total] = await qb
      .orderBy('leave.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  // ============ PAYROLL ============

  private async generatePayrollNumber(
    facilityId: string,
    month: number,
    year: number,
  ): Promise<string> {
    return `PAY${year}${String(month).padStart(2, '0')}-${facilityId.slice(0, 4).toUpperCase()}`;
  }

  async createPayrollRun(
    dto: CreatePayrollRunDto,
    userId: string,
    tenantId?: string,
  ): Promise<PayrollRun> {
    return this.dataSource.transaction(async (manager) => {
      const prRepo = manager.getRepository(PayrollRun);

      // Lock-based duplicate check prevents concurrent creates for same month
      const existing = await prRepo
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.facilityId = :facilityId AND p.month = :month AND p.year = :year', {
          facilityId: dto.facilityId,
          month: dto.month,
          year: dto.year,
        })
        .andWhere('p.tenantId = :tenantId', { tenantId: requireTenantId(tenantId) })
        .getOne();
      if (existing) {
        throw new BadRequestException(`Payroll for ${dto.month}/${dto.year} already exists`);
      }

      const payrollNumber = await this.generatePayrollNumber(dto.facilityId, dto.month, dto.year);

      const payPeriodStart = new Date(dto.year, dto.month - 1, 1);
      const payPeriodEnd = new Date(dto.year, dto.month, 0);

      const payroll = prRepo.create({
        payrollNumber,
        facilityId: dto.facilityId,
        month: dto.month,
        year: dto.year,
        payPeriodStart,
        payPeriodEnd,
        status: PayrollStatus.DRAFT,
        createdById: userId,
        tenantId: requireTenantId(tenantId),
      });

      const saved = await prRepo.save(payroll);

      await this.writeAudit({
        action: 'PAYROLL_CREATED',
        entityType: 'PayrollRun',
        entityId: saved.id,
        actorUserId: userId,
        tenantId,
        newValue: { payrollNumber: saved.payrollNumber, month: dto.month, year: dto.year },
      });

      return saved;
    });
  }

  async processPayroll(id: string, tenantId?: string): Promise<PayrollRun> {
    return this.dataSource.transaction(async (manager) => {
      // Row-lock the payroll run to prevent concurrent processing
      const payroll = await manager
        .getRepository(PayrollRun)
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id })
        .andWhere('p.tenantId = :tenantId', { tenantId: requireTenantId(tenantId) })
        .getOne();
      if (!payroll) throw new NotFoundException('Payroll run not found');

      if (payroll.status !== PayrollStatus.DRAFT) {
        throw new BadRequestException('Payroll has already been processed');
      }

      payroll.status = PayrollStatus.PROCESSING;
      await manager.save(payroll);

      const userRepoTx = manager.getRepository(User);
      const payslipRepoTx = manager.getRepository(Payslip);

      const staff = await userRepoTx.find({
        where: {
          facilityId: payroll.facilityId,
          status: 'active',
          deletedAt: IsNull(),
          tenantId: requireTenantId(tenantId),
        },
      });

      const paidStaff = staff.filter((u) => u.basicSalary && Number(u.basicSalary) > 0);

      if (paidStaff.length === 0) {
        payroll.status = PayrollStatus.DRAFT;
        await manager.save(payroll);
        throw new BadRequestException(
          'No employees have basic salary configured. Please set salaries in Staff Directory before processing payroll.',
        );
      }

      await payslipRepoTx.delete({ payrollRunId: payroll.id });

      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;
      let totalPaye = 0;
      let totalNssf = 0;

      for (const emp of paidStaff) {
        const allowancesTotal = (emp.allowances || []).reduce(
          (sum, a) => sum + Number(a.amount),
          0,
        );
        const grossSalary = Number(emp.basicSalary) + allowancesTotal;

        const nssfSalaryCap = Math.min(grossSalary, 500000);
        const nssfEmployee = nssfSalaryCap * 0.05;
        const nssfEmployer = nssfSalaryCap * 0.1;

        const paye = this.calculatePaye(grossSalary);

        const otherDeductionsTotal = (emp.deductions || []).reduce((sum, d) => {
          if (d.type === 'fixed') return sum + Number(d.amount);
          return sum + (grossSalary * Number(d.amount)) / 100;
        }, 0);

        const totalDeductionsForEmp = paye + nssfEmployee + otherDeductionsTotal;
        const netSalary = grossSalary - totalDeductionsForEmp;

        const payslip = payslipRepoTx.create({
          payrollRunId: payroll.id,
          employeeId: emp.id,
          basicSalary: emp.basicSalary,
          allowances: emp.allowances?.map((a) => ({ name: a.name, amount: Number(a.amount) })),
          grossSalary,
          paye,
          nssfEmployee,
          nssfEmployer,
          otherDeductions: emp.deductions?.map((d) => ({
            name: d.name,
            amount: d.type === 'fixed' ? Number(d.amount) : (grossSalary * Number(d.amount)) / 100,
          })),
          totalDeductions: totalDeductionsForEmp,
          netSalary,
          daysWorked: 22,
          isPaid: false,
          tenantId: requireTenantId(tenantId),
        });
        await payslipRepoTx.save(payslip);

        totalGross += grossSalary;
        totalDeductions += totalDeductionsForEmp;
        totalNet += netSalary;
        totalPaye += paye;
        totalNssf += nssfEmployee + nssfEmployer;
      }

      payroll.employeeCount = paidStaff.length;
      payroll.totalGross = totalGross;
      payroll.totalDeductions = totalDeductions;
      payroll.totalNet = totalNet;
      payroll.totalPaye = totalPaye;
      payroll.totalNssf = totalNssf;
      payroll.status = PayrollStatus.COMPLETED;

      const saved = await manager.save(payroll);

      // Auto-post GL outside of the transaction commitment is not strictly required;
      // we fire-and-forget so failures don't roll back payroll creation.
      this.financeService
        .autoPostPayrollJournal(
          {
            facilityId: payroll.facilityId,
            payrollNumber: payroll.payrollNumber,
            totalGross,
            totalNet,
            totalPaye,
            totalNssf,
            userId: 'system',
          },
          tenantId,
        )
        .catch((err) =>
          this.logger.warn(
            `GL auto-post failed for payroll ${payroll.payrollNumber}: ${err.message}`,
          ),
        );

      this.logger.log(
        `[HR_NOTIFY] payroll.processed payrollId=${saved.id} number=${saved.payrollNumber} employees=${paidStaff.length} totalNet=${totalNet}`,
      );

      await this.writeAudit({
        action: 'PAYROLL_PROCESSED',
        entityType: 'PayrollRun',
        entityId: saved.id,
        tenantId,
        newValue: {
          status: PayrollStatus.COMPLETED,
          payrollNumber: saved.payrollNumber,
          employeeCount: paidStaff.length,
          totalGross,
          totalNet,
          totalPaye,
          totalNssf,
        },
      });

      return saved;
    });
  }

  async approvePayrollRun(id: string, userId: string, tenantId?: string): Promise<PayrollRun> {
    return this.dataSource.transaction(async (manager) => {
      const prRepo = manager.getRepository(PayrollRun);
      const payroll = await prRepo.findOne({
        where: { id, tenantId: requireTenantId(tenantId) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payroll) throw new NotFoundException('Payroll run not found');
      if (payroll.status !== PayrollStatus.DRAFT) {
        throw new BadRequestException('Only draft payroll runs can be approved');
      }
      payroll.status = PayrollStatus.APPROVED;
      payroll.approvedById = userId;
      payroll.approvedAt = new Date();
      this.logger.log(`[HR_NOTIFY] payroll.approved id=${id} approver=${userId}`);
      const saved = await prRepo.save(payroll);

      await this.writeAudit({
        action: 'PAYROLL_APPROVED',
        entityType: 'PayrollRun',
        entityId: id,
        actorUserId: userId,
        tenantId,
        newValue: {
          status: PayrollStatus.APPROVED,
          payrollNumber: payroll.payrollNumber,
          totalNet: payroll.totalNet,
          totalGross: payroll.totalGross,
        },
        oldValue: { status: PayrollStatus.DRAFT },
      });
      return saved;
    });
  }

  async markPayrollPaid(id: string, tenantId?: string): Promise<PayrollRun> {
    // Wrap status flip + payslip update in one tx with a row lock on
    // the run, otherwise two concurrent "Mark Paid" clicks could each
    // see status=COMPLETED, write conflicting rows, and we could end up
    // with payslips.isPaid=true while the run is still in COMPLETED
    // (or vice versa) if the payslip update fails after the run save.
    return this.dataSource.transaction(async (manager) => {
      const payroll = await manager
        .getRepository(PayrollRun)
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id })
        .andWhere('p.tenantId = :tenantId', { tenantId: requireTenantId(tenantId) })
        .getOne();
      if (!payroll) throw new NotFoundException('Payroll run not found');
      if (payroll.status !== PayrollStatus.COMPLETED) {
        throw new BadRequestException('Only completed payroll runs can be marked paid');
      }
      await manager
        .getRepository(Payslip)
        .update({ payrollRunId: id, tenantId: requireTenantId(tenantId) }, { isPaid: true });
      payroll.status = PayrollStatus.PAID;
      const saved = await manager.save(payroll);
      this.logger.log(`[HR_NOTIFY] payroll.paid id=${id}`);
      await this.writeAudit({
        action: 'PAYROLL_MARKED_PAID',
        entityType: 'PayrollRun',
        entityId: id,
        tenantId,
        newValue: {
          status: PayrollStatus.PAID,
          payrollNumber: payroll.payrollNumber,
          totalNet: payroll.totalNet,
        },
        oldValue: { status: PayrollStatus.COMPLETED },
      });
      return saved;
    });
  }

  // ============ PAYROLL EXPORTS ============
  async exportPayrollPaye(id: string, tenantId?: string) {
    const payroll = await this.payrollRunRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!payroll) throw new NotFoundException('Payroll run not found');
    const slips = await this.payslipRepo.find({
      where: { payrollRunId: id },
      relations: ['employee'],
    });
    const rows = ['EmployeeId,EmployeeName,GrossSalary,PAYE'];
    for (const s of slips) {
      const name = s.employee?.fullName || '';
      rows.push(`${s.employeeId},"${name}",${s.grossSalary},${s.paye}`);
    }
    return rows.join('\n');
  }

  async exportPayrollNssf(id: string, tenantId?: string) {
    const payroll = await this.payrollRunRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!payroll) throw new NotFoundException('Payroll run not found');
    const slips = await this.payslipRepo.find({
      where: { payrollRunId: id },
      relations: ['employee'],
    });
    const rows = ['EmployeeId,EmployeeName,GrossSalary,NSSFEmployee,NSSFEmployer'];
    for (const s of slips) {
      const name = s.employee?.fullName || '';
      rows.push(`${s.employeeId},"${name}",${s.grossSalary},${s.nssfEmployee},${s.nssfEmployer}`);
    }
    return rows.join('\n');
  }

  async exportPayrollBank(id: string, tenantId?: string) {
    const payroll = await this.payrollRunRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!payroll) throw new NotFoundException('Payroll run not found');
    const slips = await this.payslipRepo.find({
      where: { payrollRunId: id },
      relations: ['employee'],
    });
    const rows = ['BeneficiaryName,BankName,AccountNumber,Amount,Reference'];
    for (const s of slips) {
      const e = s.employee;
      rows.push(
        `"${e.fullName || ''}","${e.bankName || ''}","${e.bankAccountNumber || ''}",${s.netSalary},${payroll.payrollNumber}`,
      );
    }
    return rows.join('\n');
  }

  async resetPayrollRun(id: string, tenantId?: string): Promise<PayrollRun> {
    const payroll = await this.payrollRunRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!payroll) throw new NotFoundException('Payroll run not found');

    // Reset is destructive — only allowed BEFORE a manager has approved the
    // run. Once a run is APPROVED, PROCESSING, COMPLETED, PAID or CANCELLED,
    // it is part of the audit trail and may have triggered downstream
    // bank/PAYE/NSSF exports. Resetting it would silently destroy the
    // payslips and let payroll be re-fabricated without re-approval.
    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot reset a payroll run in status '${payroll.status}'. ` +
          `Only DRAFT runs can be reset. Cancel and create a new run instead.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Tenant-scoped delete (defence in depth — payrollRunId is unique but
      // we never want a runaway DELETE if the join is ever loosened).
      await manager.delete(Payslip, {
        payrollRunId: payroll.id,
        tenantId: requireTenantId(tenantId),
      });

      payroll.employeeCount = 0;
      payroll.totalGross = 0;
      payroll.totalDeductions = 0;
      payroll.totalNet = 0;
      payroll.totalPaye = 0;
      payroll.totalNssf = 0;
      this.logger.log(`[HR_NOTIFY] payroll.reset id=${payroll.id}`);
      const saved = await manager.save(payroll);
      await this.writeAudit({
        action: 'PAYROLL_RESET',
        entityType: 'PayrollRun',
        entityId: payroll.id,
        tenantId,
        newValue: { status: payroll.status, payrollNumber: payroll.payrollNumber },
      });
      return saved;
    });
  }

  private calculatePaye(grossSalary: number): number {
    // Uganda PAYE brackets (simplified)
    // 0 - 235,000: 0%
    // 235,001 - 335,000: 10%
    // 335,001 - 410,000: 20%
    // 410,001 - 10,000,000: 30%
    // Above 10,000,000: 40%

    if (grossSalary <= 235000) return 0;

    let paye = 0;
    let remaining = grossSalary;

    // First bracket (0-235,000) - 0%
    remaining -= 235000;

    // Second bracket (235,001-335,000) - 10%
    if (remaining > 0) {
      const bracket = Math.min(remaining, 100000);
      paye += bracket * 0.1;
      remaining -= bracket;
    }

    // Third bracket (335,001-410,000) - 20%
    if (remaining > 0) {
      const bracket = Math.min(remaining, 75000);
      paye += bracket * 0.2;
      remaining -= bracket;
    }

    // Fourth bracket (410,001-10,000,000) - 30%
    if (remaining > 0) {
      const bracket = Math.min(remaining, 9590000);
      paye += bracket * 0.3;
      remaining -= bracket;
    }

    // Above 10,000,000 - 40%
    if (remaining > 0) {
      paye += remaining * 0.4;
    }

    return Math.round(paye);
  }

  async getPayrollRuns(
    facilityId: string,
    options: { year?: number; status?: PayrollStatus },
    tenantId?: string,
  ) {
    const where: any = { facilityId };
    where.tenantId = requireTenantId(tenantId);
    if (options.year) where.year = options.year;
    if (options.status) where.status = options.status;

    return this.payrollRunRepo.find({
      where,
      order: { year: 'DESC', month: 'DESC' },
    });
  }

  async getPayslips(payrollRunId: string, tenantId?: string): Promise<Payslip[]> {
    return this.payslipRepo.find({
      where: { payrollRunId, tenantId: requireTenantId(tenantId) },
      relations: ['employee'],
      order: { employee: { fullName: 'ASC' } },
    });
  }

  async getEmployeePayslips(employeeId: string, tenantId?: string): Promise<Payslip[]> {
    return this.payslipRepo.find({
      where: { employeeId, tenantId: requireTenantId(tenantId) },
      relations: ['payrollRun'],
      order: { createdAt: 'DESC' },
    });
  }

  async getMyPayslips(userId: string, year?: number, tenantId?: string): Promise<Payslip[]> {
    const whereClause: any = { employeeId: userId };
    whereClause.tenantId = requireTenantId(tenantId);

    if (year) {
      whereClause.payrollRun = { year };
    }

    return this.payslipRepo.find({
      where: whereClause,
      relations: ['payrollRun'],
      order: { createdAt: 'DESC' },
    });
  }

  // ============ DASHBOARD ============

  async getDashboard(facilityId: string, tenantId?: string) {
    const [totalEmployees, activeEmployees, pendingLeaves, todayAttendance] = await Promise.all([
      this.employeeRepo.count({ where: { facilityId, tenantId: requireTenantId(tenantId) } }),
      this.employeeRepo.count({
        where: { facilityId, status: EmploymentStatus.ACTIVE, tenantId: requireTenantId(tenantId) },
      }),
      this.leaveRepo.count({
        where: {
          status: LeaveStatus.PENDING,
          employee: { facilityId },
          tenantId: requireTenantId(tenantId),
        },
      }),
      this.attendanceRepo.count({
        where: {
          facilityId,
          date: new Date(),
          status: 'present',
          tenantId: requireTenantId(tenantId),
        },
      }),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      pendingLeaveRequests: pendingLeaves,
      presentToday: todayAttendance,
      absentToday: activeEmployees - todayAttendance,
    };
  }

  // ============ SHIFT DEFINITIONS ============

  async createShiftDefinition(
    dto: CreateShiftDefinitionDto,
    tenantId?: string,
  ): Promise<ShiftDefinition> {
    // Calculate duration
    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);
    let durationMinutes = endH * 60 + endM - (startH * 60 + startM);
    const crossesMidnight = durationMinutes < 0;
    if (crossesMidnight) durationMinutes += 24 * 60;
    const durationHours = durationMinutes / 60;

    const shift = this.shiftDefRepo.create({
      facilityId: dto.facilityId,
      name: dto.name,
      code: dto.code,
      shiftType: dto.shiftType,
      startTime: dto.startTime,
      endTime: dto.endTime,
      durationHours,
      crossesMidnight,
      breakMinutes: dto.breakMinutes || 0,
      departmentId: dto.departmentId,
      minStaff: dto.minStaff || 1,
      maxStaff: dto.maxStaff,
      payMultiplier: dto.payMultiplier || 1.0,
      color: dto.color,
      description: dto.description,
      isActive: true,
      tenantId: requireTenantId(tenantId),
    });

    return this.shiftDefRepo.save(shift);
  }

  async getShiftDefinitions(
    facilityId: string,
    departmentId?: string,
    tenantId?: string,
  ): Promise<ShiftDefinition[]> {
    const where: any = { facilityId, isActive: true };
    where.tenantId = requireTenantId(tenantId);
    if (departmentId) where.departmentId = departmentId;

    return this.shiftDefRepo.find({
      where,
      relations: ['department'],
      order: { startTime: 'ASC' },
    });
  }

  async updateShiftDefinition(
    id: string,
    updates: Partial<CreateShiftDefinitionDto>,
    tenantId?: string,
  ): Promise<ShiftDefinition> {
    const shift = await this.shiftDefRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!shift) throw new NotFoundException('Shift definition not found');

    Object.assign(shift, updates);
    return this.shiftDefRepo.save(shift);
  }

  async deleteShiftDefinition(id: string, tenantId?: string): Promise<void> {
    const shift = await this.shiftDefRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!shift) throw new NotFoundException('Shift definition not found');
    shift.isActive = false;
    await this.shiftDefRepo.save(shift);
  }

  // ============ ROSTER MANAGEMENT ============

  async createRoster(
    dto: CreateRosterDto,
    userId: string,
    tenantId?: string,
  ): Promise<StaffRoster> {
    // Check for existing roster on same date
    const existing = await this.rosterRepo.findOne({
      where: {
        employeeId: dto.employeeId,
        rosterDate: new Date(dto.rosterDate),
        status: In([RosterStatus.SCHEDULED, RosterStatus.CONFIRMED]),
        tenantId: requireTenantId(tenantId),
      },
    });

    if (existing) {
      throw new BadRequestException('Employee already has a shift scheduled for this date');
    }

    // Check shift coverage
    const shift = await this.shiftDefRepo.findOne({
      where: { id: dto.shiftDefinitionId, tenantId: requireTenantId(tenantId) },
    });
    if (!shift) throw new NotFoundException('Shift definition not found');

    const existingCount = await this.rosterRepo.count({
      where: {
        shiftDefinitionId: dto.shiftDefinitionId,
        rosterDate: new Date(dto.rosterDate),
        status: In([RosterStatus.SCHEDULED, RosterStatus.CONFIRMED]),
        tenantId: requireTenantId(tenantId),
      },
    });

    if (shift.maxStaff && existingCount >= shift.maxStaff) {
      throw new BadRequestException('Shift is already at maximum capacity');
    }

    const roster = this.rosterRepo.create({
      facilityId: dto.facilityId,
      employeeId: dto.employeeId,
      shiftDefinitionId: dto.shiftDefinitionId,
      rosterDate: new Date(dto.rosterDate),
      status: RosterStatus.SCHEDULED,
      notes: dto.notes,
      createdById: userId,
      tenantId: requireTenantId(tenantId),
    });

    return this.rosterRepo.save(roster);
  }

  async generateWeeklyRoster(
    facilityId: string,
    startDate: string,
    employeeIds: string[],
    shiftPattern: { dayOfWeek: number; shiftDefinitionId: string }[],
    userId: string,
    tenantId?: string,
  ): Promise<StaffRoster[]> {
    const rosters: StaffRoster[] = [];
    const start = new Date(startDate);

    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + day);
      const dayOfWeek = currentDate.getDay();

      const shiftsForDay = shiftPattern.filter((p) => p.dayOfWeek === dayOfWeek);

      for (const shiftConfig of shiftsForDay) {
        for (const employeeId of employeeIds) {
          try {
            const roster = await this.createRoster(
              {
                facilityId,
                employeeId,
                shiftDefinitionId: shiftConfig.shiftDefinitionId,
                rosterDate: currentDate.toISOString().slice(0, 10),
              },
              userId,
              tenantId,
            );
            rosters.push(roster);
          } catch (error) {
            // Skip if conflict
            this.logger.warn(
              `Skipped roster for ${employeeId} on ${currentDate}: ${error.message}`,
            );
          }
        }
      }
    }

    return rosters;
  }

  async getRoster(
    facilityId: string,
    startDate: string,
    endDate: string,
    options?: {
      employeeId?: string;
      departmentId?: string;
      shiftDefinitionId?: string;
    },
    tenantId?: string,
  ): Promise<StaffRoster[]> {
    const qb = this.rosterRepo
      .createQueryBuilder('roster')
      .leftJoinAndSelect('roster.employee', 'employee')
      .leftJoinAndSelect('roster.shiftDefinition', 'shift')
      .where('roster.facilityId = :facilityId', { facilityId })
      .andWhere('roster.rosterDate BETWEEN :start AND :end', {
        start: new Date(startDate),
        end: new Date(endDate),
      });
    qb.andWhere('roster.tenant_id = :tenantId', { tenantId: requireTenantId(tenantId) });

    if (options?.employeeId) {
      qb.andWhere('roster.employeeId = :employeeId', { employeeId: options.employeeId });
    }
    if (options?.departmentId) {
      qb.andWhere('shift.departmentId = :departmentId', { departmentId: options.departmentId });
    }
    if (options?.shiftDefinitionId) {
      qb.andWhere('roster.shiftDefinitionId = :shiftDefinitionId', {
        shiftDefinitionId: options.shiftDefinitionId,
      });
    }

    return qb.orderBy('roster.rosterDate', 'ASC').addOrderBy('shift.startTime', 'ASC').getMany();
  }

  async updateRosterStatus(
    id: string,
    status: RosterStatus,
    notes?: string,
    tenantId?: string,
  ): Promise<StaffRoster> {
    const roster = await this.rosterRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!roster) throw new NotFoundException('Roster entry not found');

    roster.status = status;
    if (notes) roster.notes = notes;
    if (status === RosterStatus.ABSENT && notes) roster.absenceReason = notes;

    return this.rosterRepo.save(roster);
  }

  async recordActualTimes(
    id: string,
    startTime: string,
    endTime?: string,
    tenantId?: string,
  ): Promise<StaffRoster> {
    const roster = await this.rosterRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
      relations: ['shiftDefinition'],
    });
    if (!roster) throw new NotFoundException('Roster entry not found');

    roster.actualStartTime = startTime;
    if (endTime) {
      roster.actualEndTime = endTime;

      // Calculate hours worked
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      let worked = endH * 60 + endM - (startH * 60 + startM);
      if (worked < 0) worked += 24 * 60; // Crossed midnight
      roster.hoursWorked = worked / 60;

      // Calculate overtime
      if (roster.shiftDefinition) {
        const scheduled = roster.shiftDefinition.durationHours;
        roster.overtimeHours = Math.max(0, roster.hoursWorked - Number(scheduled));
      }

      roster.status = RosterStatus.COMPLETED;
    } else {
      roster.status = RosterStatus.IN_PROGRESS;
    }

    return this.rosterRepo.save(roster);
  }

  // ============ SHIFT SWAP ============

  async requestShiftSwap(dto: RequestShiftSwapDto, tenantId?: string): Promise<ShiftSwapRequest> {
    return this.dataSource.transaction(async (manager) => {
      const rosterRepo = manager.getRepository(StaffRoster);
      const swapRepo = manager.getRepository(ShiftSwapRequest);

      const requesterRoster = await rosterRepo.findOne({
        where: { id: dto.requesterRosterId, tenantId: requireTenantId(tenantId) },
        relations: ['employee'],
      });
      if (!requesterRoster) throw new NotFoundException('Requester roster not found');

      const swap = swapRepo.create({
        facilityId: requesterRoster.facilityId,
        requesterId: requesterRoster.employeeId,
        requesterRosterId: dto.requesterRosterId,
        targetEmployeeId: dto.targetEmployeeId,
        targetRosterId: dto.targetRosterId,
        isMutualSwap: !!dto.targetRosterId,
        reason: dto.reason,
        status: SwapRequestStatus.PENDING,
        tenantId: requireTenantId(tenantId),
      });

      requesterRoster.status = RosterStatus.SWAP_PENDING;
      await rosterRepo.save(requesterRoster);

      return swapRepo.save(swap);
    });
  }

  async respondToSwapRequest(
    id: string,
    accepted: boolean,
    userId: string,
    tenantId?: string,
  ): Promise<ShiftSwapRequest> {
    return this.dataSource.transaction(async (manager) => {
      const swapRepo = manager.getRepository(ShiftSwapRequest);
      const rosterRepo = manager.getRepository(StaffRoster);

      const swap = await swapRepo.findOne({
        where: { id, tenantId: requireTenantId(tenantId) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!swap) throw new NotFoundException('Swap request not found');

      swap.targetAccepted = accepted;
      swap.targetRespondedAt = new Date();

      if (!accepted) {
        swap.status = SwapRequestStatus.REJECTED;
        await rosterRepo.update(swap.requesterRosterId, { status: RosterStatus.SCHEDULED });
      }

      return swapRepo.save(swap);
    });
  }

  async approveSwapRequest(
    id: string,
    dto: ApproveSwapDto,
    userId: string,
    tenantId?: string,
  ): Promise<ShiftSwapRequest> {
    return this.dataSource.transaction(async (manager) => {
      const swapRepo = manager.getRepository(ShiftSwapRequest);
      const rosterRepo = manager.getRepository(StaffRoster);

      const swap = await swapRepo.findOne({
        where: { id, tenantId: requireTenantId(tenantId) },
        relations: ['requesterRoster', 'targetRoster'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!swap) throw new NotFoundException('Swap request not found');

      if (!swap.targetAccepted) {
        throw new BadRequestException('Target employee has not accepted the swap request');
      }

      if (dto.approved) {
        swap.status = SwapRequestStatus.APPROVED;
        swap.approvedById = userId;
        swap.approvedAt = new Date();

        if (swap.isMutualSwap && swap.targetRosterId) {
          const tempEmployee = swap.requesterRoster.employeeId;
          await rosterRepo.update(swap.requesterRosterId, {
            employeeId: swap.targetEmployeeId,
            originalEmployeeId: tempEmployee,
            status: RosterStatus.CONFIRMED,
          });
          await rosterRepo.update(swap.targetRosterId, {
            employeeId: tempEmployee,
            originalEmployeeId: swap.targetEmployeeId,
            status: RosterStatus.CONFIRMED,
          });
        } else {
          await rosterRepo.update(swap.requesterRosterId, {
            employeeId: swap.targetEmployeeId,
            originalEmployeeId: swap.requesterId,
            status: RosterStatus.CONFIRMED,
          });
        }
      } else {
        swap.status = SwapRequestStatus.REJECTED;
        if (dto.rejectionReason) swap.rejectionReason = dto.rejectionReason;
        await rosterRepo.update(swap.requesterRosterId, { status: RosterStatus.SCHEDULED });
      }

      const saved = await swapRepo.save(swap);

      await this.writeAudit({
        action: dto.approved ? 'SHIFT_SWAP_APPROVED' : 'SHIFT_SWAP_REJECTED',
        entityType: 'ShiftSwapRequest',
        entityId: id,
        actorUserId: userId,
        tenantId,
        newValue: {
          status: saved.status,
          requesterId: swap.requesterId,
          targetEmployeeId: swap.targetEmployeeId,
        },
      });

      return saved;
    });
  }

  async getSwapRequests(
    facilityId: string,
    status?: SwapRequestStatus,
    tenantId?: string,
  ): Promise<ShiftSwapRequest[]> {
    const where: any = { facilityId };
    where.tenantId = requireTenantId(tenantId);
    if (status) where.status = status;

    return this.swapRepo.find({
      where,
      relations: [
        'requester',
        'targetEmployee',
        'requesterRoster',
        'requesterRoster.shiftDefinition',
        'approvedBy',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  // ============ ROSTER COVERAGE ============

  async getShiftCoverage(facilityId: string, date: string, tenantId?: string): Promise<any[]> {
    const shifts = await this.getShiftDefinitions(facilityId, undefined, tenantId);
    const rosters = await this.getRoster(facilityId, date, date, undefined, tenantId);

    return shifts.map((shift) => {
      const assigned = rosters.filter((r) => r.shiftDefinitionId === shift.id);
      const confirmed = assigned.filter(
        (r) => r.status === RosterStatus.CONFIRMED || r.status === RosterStatus.SCHEDULED,
      );

      return {
        shift: {
          id: shift.id,
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
        },
        minStaff: shift.minStaff,
        maxStaff: shift.maxStaff,
        assignedCount: assigned.length,
        confirmedCount: confirmed.length,
        isUnderstaffed: confirmed.length < shift.minStaff,
        isOverstaffed: shift.maxStaff && confirmed.length > shift.maxStaff,
        staff: assigned.map((r) => ({
          employeeId: r.employeeId,
          name: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : 'Unknown',
          status: r.status,
        })),
      };
    });
  }

  // ============ RECRUITMENT - JOB POSTINGS ============

  async createJobPosting(dto: CreateJobPostingDto, tenantId?: string): Promise<JobPosting> {
    const posting = this.jobPostingRepo.create({
      facilityId: dto.facilityId,
      title: dto.title,
      departmentId: dto.departmentId,
      description: dto.description,
      requirements: dto.requirements,
      responsibilities: dto.responsibilities,
      employmentType: dto.employmentType as any,
      salaryMin: dto.salaryMin,
      salaryMax: dto.salaryMax,
      location: dto.location,
      closingDate: dto.closingDate ? new Date(dto.closingDate) : undefined,
      positionsAvailable: dto.positionsAvailable || 1,
      status: JobStatus.DRAFT,
      tenantId: requireTenantId(tenantId),
    });
    return this.jobPostingRepo.save(posting as JobPosting);
  }

  async getJobPostings(
    facilityId: string,
    status?: string,
    tenantId?: string,
  ): Promise<JobPosting[]> {
    const where: any = { facilityId };
    where.tenantId = requireTenantId(tenantId);
    if (status) where.status = status;
    return this.jobPostingRepo.find({
      where,
      relations: ['department'],
      order: { createdAt: 'DESC' },
    });
  }

  async getJobPostingById(id: string, tenantId?: string): Promise<JobPosting> {
    const posting = await this.jobPostingRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
      relations: ['department'],
    });
    if (!posting) throw new NotFoundException('Job posting not found');
    return posting;
  }

  async updateJobPosting(
    id: string,
    dto: UpdateJobPostingDto,
    tenantId?: string,
  ): Promise<JobPosting> {
    const posting = await this.getJobPostingById(id, tenantId);
    Object.assign(posting, dto);
    if (dto.closingDate) posting.closingDate = new Date(dto.closingDate);
    return this.jobPostingRepo.save(posting);
  }

  async deleteJobPosting(id: string, tenantId?: string): Promise<void> {
    const posting = await this.getJobPostingById(id, tenantId);
    await this.jobPostingRepo.remove(posting);
  }

  // ============ RECRUITMENT - APPLICATIONS ============

  async getPublishedJobs(facilityId?: string, tenantId?: string): Promise<JobPosting[]> {
    const where: any = { status: JobStatus.OPEN };
    where.tenantId = requireTenantId(tenantId);
    if (facilityId) where.facilityId = facilityId;
    return this.jobPostingRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async getPublishedJobById(id: string, tenantId?: string): Promise<JobPosting> {
    const where: any = { id, status: JobStatus.OPEN };
    where.tenantId = requireTenantId(tenantId);
    const posting = await this.jobPostingRepo.findOne({ where });
    if (!posting) throw new NotFoundException('Job posting not found');
    return posting;
  }

  async createJobApplication(
    dto: CreateJobApplicationDto,
    tenantId?: string,
  ): Promise<JobApplication> {
    const posting = await this.getJobPostingById(dto.jobPostingId, tenantId);

    const application = this.jobApplicationRepo.create({
      jobPostingId: dto.jobPostingId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      coverLetter: dto.coverLetter,
      resumeUrl: dto.resumeUrl,
      status: ApplicationStatus.SUBMITTED,
      tenantId: requireTenantId(tenantId),
    });

    // Increment applications count
    posting.applicationsCount++;
    await this.jobPostingRepo.save(posting);

    return this.jobApplicationRepo.save(application);
  }

  async getJobApplications(
    jobPostingId: string,
    status?: string,
    tenantId?: string,
  ): Promise<JobApplication[]> {
    const where: any = { jobPostingId };
    where.tenantId = requireTenantId(tenantId);
    if (status) where.status = status;
    return this.jobApplicationRepo.find({
      where,
      relations: ['jobPosting'],
      order: { appliedAt: 'DESC' },
    });
  }

  async updateApplicationStatus(
    id: string,
    dto: UpdateApplicationStatusDto,
    tenantId?: string,
  ): Promise<JobApplication> {
    const application = await this.jobApplicationRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!application) throw new NotFoundException('Application not found');

    application.status = dto.status as ApplicationStatus;
    if (dto.notes) application.notes = dto.notes;
    if (dto.rating) application.rating = dto.rating;
    if (dto.interviewDate) application.interviewDate = new Date(dto.interviewDate);

    return this.jobApplicationRepo.save(application);
  }

  // ============ PERFORMANCE APPRAISALS ============

  async createAppraisal(dto: CreateAppraisalDto, tenantId?: string): Promise<PerformanceAppraisal> {
    // Check for existing appraisal
    const existing = await this.appraisalRepo.findOne({
      where: {
        employeeId: dto.employeeId,
        appraisalPeriod: dto.appraisalPeriod as any,
        year: dto.year,
        tenantId: requireTenantId(tenantId),
      },
    });
    if (existing) {
      throw new BadRequestException('Appraisal already exists for this period');
    }

    const appraisal = this.appraisalRepo.create({
      facilityId: dto.facilityId,
      employeeId: dto.employeeId,
      reviewerId: dto.reviewerId,
      appraisalPeriod: dto.appraisalPeriod as any,
      year: dto.year,
      status: AppraisalStatus.DRAFT,
      ...(dto.questions ? { questions: dto.questions } : {}),
      tenantId: requireTenantId(tenantId),
    });
    return this.appraisalRepo.save(appraisal);
  }

  async getAppraisals(
    facilityId: string,
    options?: { employeeId?: string; year?: number; status?: string },
    tenantId?: string,
  ): Promise<PerformanceAppraisal[]> {
    const where: any = { facilityId };
    where.tenantId = requireTenantId(tenantId);
    if (options?.employeeId) where.employeeId = options.employeeId;
    if (options?.year) where.year = options.year;
    if (options?.status) where.status = options.status;

    return this.appraisalRepo.find({
      where,
      relations: ['employee', 'employee.departmentRef', 'reviewer'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAppraisalById(id: string, tenantId?: string): Promise<PerformanceAppraisal> {
    const appraisal = await this.appraisalRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
      relations: ['employee', 'employee.departmentRef', 'reviewer'],
    });
    if (!appraisal) throw new NotFoundException('Appraisal not found');
    return appraisal;
  }

  async updateAppraisal(
    id: string,
    dto: UpdateAppraisalDto,
    tenantId?: string,
  ): Promise<PerformanceAppraisal> {
    const appraisal = await this.getAppraisalById(id, tenantId);
    Object.assign(appraisal, dto);

    // Calculate overall rating if ratings are provided
    const ratings = [
      dto.jobKnowledgeRating || appraisal.jobKnowledgeRating,
      dto.workQualityRating || appraisal.workQualityRating,
      dto.attendanceRating || appraisal.attendanceRating,
      dto.communicationRating || appraisal.communicationRating,
      dto.teamworkRating || appraisal.teamworkRating,
      dto.initiativeRating || appraisal.initiativeRating,
    ].filter((r) => r !== null && r !== undefined);

    if (ratings.length > 0) {
      appraisal.overallRating = ratings.reduce((a, b) => Number(a) + Number(b), 0) / ratings.length;
    }

    if (dto.status) appraisal.status = dto.status as AppraisalStatus;
    if (dto.status === 'completed') appraisal.reviewDate = new Date();
    if (dto.status === 'acknowledged') appraisal.acknowledgedDate = new Date();

    return this.appraisalRepo.save(appraisal);
  }

  async deleteAppraisal(id: string, tenantId?: string): Promise<void> {
    const appraisal = await this.getAppraisalById(id, tenantId);
    if (appraisal.status !== AppraisalStatus.DRAFT) {
      throw new BadRequestException('Only draft appraisals can be deleted');
    }
    await this.appraisalRepo.remove(appraisal);
  }

  async submitSelfReview(id: string, dto: any, tenantId?: string): Promise<PerformanceAppraisal> {
    const appraisal = await this.getAppraisalById(id, tenantId);
    if (appraisal.status !== AppraisalStatus.DRAFT) {
      throw new BadRequestException('Appraisal must be in draft status to submit self-review');
    }
    if (dto.employeeComments) appraisal.employeeComments = dto.employeeComments;
    if (dto.goals) appraisal.goals = dto.goals;
    if (dto.employeeAnswers) appraisal.employeeAnswers = dto.employeeAnswers;
    // Store self-ratings temporarily in the same fields (manager will override)
    if (dto.jobKnowledgeRating) appraisal.jobKnowledgeRating = dto.jobKnowledgeRating;
    if (dto.workQualityRating) appraisal.workQualityRating = dto.workQualityRating;
    if (dto.attendanceRating) appraisal.attendanceRating = dto.attendanceRating;
    if (dto.communicationRating) appraisal.communicationRating = dto.communicationRating;
    if (dto.teamworkRating) appraisal.teamworkRating = dto.teamworkRating;
    if (dto.initiativeRating) appraisal.initiativeRating = dto.initiativeRating;
    appraisal.status = AppraisalStatus.SELF_REVIEW;
    return this.appraisalRepo.save(appraisal);
  }

  async submitManagerReview(
    id: string,
    dto: any,
    tenantId?: string,
  ): Promise<PerformanceAppraisal> {
    const appraisal = await this.getAppraisalById(id, tenantId);
    if (![AppraisalStatus.SELF_REVIEW, AppraisalStatus.DRAFT].includes(appraisal.status)) {
      throw new BadRequestException(
        'Appraisal must be in self_review or draft status for manager review',
      );
    }
    appraisal.jobKnowledgeRating = dto.jobKnowledgeRating;
    appraisal.workQualityRating = dto.workQualityRating;
    appraisal.attendanceRating = dto.attendanceRating;
    appraisal.communicationRating = dto.communicationRating;
    appraisal.teamworkRating = dto.teamworkRating;
    appraisal.initiativeRating = dto.initiativeRating;
    if (dto.reviewerComments) appraisal.reviewerComments = dto.reviewerComments;
    if (dto.strengths) appraisal.strengths = dto.strengths;
    if (dto.areasForImprovement) appraisal.areasForImprovement = dto.areasForImprovement;
    if (dto.questions) appraisal.questions = dto.questions;

    const ratings = [
      dto.jobKnowledgeRating,
      dto.workQualityRating,
      dto.attendanceRating,
      dto.communicationRating,
      dto.teamworkRating,
      dto.initiativeRating,
    ].filter((r) => r !== null && r !== undefined);
    if (ratings.length > 0) {
      appraisal.overallRating = ratings.reduce((a, b) => Number(a) + Number(b), 0) / ratings.length;
    }

    appraisal.status = AppraisalStatus.COMPLETED;
    appraisal.reviewDate = new Date();
    return this.appraisalRepo.save(appraisal);
  }

  async acknowledgeAppraisal(id: string, tenantId?: string): Promise<PerformanceAppraisal> {
    const appraisal = await this.getAppraisalById(id, tenantId);
    if (appraisal.status !== AppraisalStatus.COMPLETED) {
      throw new BadRequestException('Only completed appraisals can be acknowledged');
    }
    appraisal.status = AppraisalStatus.ACKNOWLEDGED;
    appraisal.acknowledgedDate = new Date();
    return this.appraisalRepo.save(appraisal);
  }

  async getMyAppraisals(userId: string, tenantId?: string): Promise<PerformanceAppraisal[]> {
    // employeeId now references users table directly
    return this.appraisalRepo.find({
      where: { employeeId: userId, tenantId: requireTenantId(tenantId) },
      relations: ['employee', 'employee.departmentRef', 'reviewer'],
      order: { year: 'DESC', createdAt: 'DESC' },
    });
  }

  async getEmployeeAppraisalHistory(
    employeeId: string,
    tenantId?: string,
  ): Promise<PerformanceAppraisal[]> {
    return this.appraisalRepo.find({
      where: { employeeId, tenantId: requireTenantId(tenantId) },
      relations: ['employee', 'reviewer'],
      order: { year: 'DESC', createdAt: 'DESC' },
    });
  }

  async bulkCreateAppraisals(
    dto: any,
    tenantId?: string,
  ): Promise<{ created: number; skipped: number }> {
    // Get all active users in the department
    const departmentUsers = await this.userRepo.find({
      where: {
        department: { name: dto.department },
        status: 'active',
        deletedAt: IsNull(),
        tenantId: requireTenantId(tenantId),
      },
    });

    let created = 0;
    let skipped = 0;

    for (const user of departmentUsers) {
      // Skip if appraisal already exists for this user/period/year
      const existing = await this.appraisalRepo.findOne({
        where: {
          employeeId: user.id,
          appraisalPeriod: dto.appraisalPeriod as any,
          year: dto.year,
          tenantId: requireTenantId(tenantId),
        },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const appraisal = this.appraisalRepo.create({
        facilityId: dto.facilityId,
        employeeId: user.id,
        reviewerId: dto.reviewerId,
        appraisalPeriod: dto.appraisalPeriod as any,
        year: dto.year,
        status: AppraisalStatus.DRAFT,
        tenantId: requireTenantId(tenantId),
      });
      await this.appraisalRepo.save(appraisal);
      created++;
    }

    return { created, skipped };
  }

  // ============ TRAINING PROGRAMS ============

  async createTrainingProgram(
    dto: CreateTrainingProgramDto,
    tenantId?: string,
  ): Promise<TrainingProgram> {
    const program = this.trainingProgramRepo.create({
      facilityId: dto.facilityId,
      name: dto.name,
      description: dto.description,
      trainingType: dto.trainingType as any,
      trainer: dto.trainer,
      location: dto.location,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      durationHours: dto.durationHours,
      maxParticipants: dto.maxParticipants,
      isMandatory: dto.isMandatory || false,
      providesCertification: dto.providesCertification || false,
      certificationName: dto.certificationName,
      status: TrainingStatus.SCHEDULED,
      tenantId: requireTenantId(tenantId),
    });
    return this.trainingProgramRepo.save(program);
  }

  async getTrainingPrograms(
    facilityId: string,
    status?: string,
    tenantId?: string,
  ): Promise<TrainingProgram[]> {
    const where: any = { facilityId };
    where.tenantId = requireTenantId(tenantId);
    if (status) where.status = status;
    return this.trainingProgramRepo.find({
      where,
      order: { startDate: 'DESC' },
    });
  }

  async getTrainingProgramById(id: string, tenantId?: string): Promise<TrainingProgram> {
    const program = await this.trainingProgramRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!program) throw new NotFoundException('Training program not found');
    return program;
  }

  async updateTrainingProgram(
    id: string,
    dto: UpdateTrainingProgramDto,
    tenantId?: string,
  ): Promise<TrainingProgram> {
    const program = await this.getTrainingProgramById(id, tenantId);
    Object.assign(program, dto);
    if (dto.startDate) program.startDate = new Date(dto.startDate);
    if (dto.endDate) program.endDate = new Date(dto.endDate);
    if (dto.status) program.status = dto.status as TrainingStatus;
    return this.trainingProgramRepo.save(program);
  }

  async deleteTrainingProgram(id: string, tenantId?: string): Promise<void> {
    const program = await this.getTrainingProgramById(id, tenantId);
    await this.trainingProgramRepo.remove(program);
  }

  // ============ TRAINING ENROLLMENTS ============

  async enrollEmployee(dto: EnrollEmployeeDto, tenantId?: string): Promise<TrainingEnrollment> {
    const program = await this.getTrainingProgramById(dto.trainingProgramId, tenantId);

    // Check if already enrolled
    const existing = await this.trainingEnrollmentRepo.findOne({
      where: {
        trainingProgramId: dto.trainingProgramId,
        employeeId: dto.employeeId,
        tenantId: requireTenantId(tenantId),
      },
    });
    if (existing) {
      throw new BadRequestException('Employee is already enrolled in this program');
    }

    // Check max participants
    if (program.maxParticipants) {
      const enrolledCount = await this.trainingEnrollmentRepo.count({
        where: { trainingProgramId: dto.trainingProgramId, tenantId: requireTenantId(tenantId) },
      });
      if (enrolledCount >= program.maxParticipants) {
        throw new BadRequestException('Training program is at full capacity');
      }
    }

    const enrollment = this.trainingEnrollmentRepo.create({
      trainingProgramId: dto.trainingProgramId,
      employeeId: dto.employeeId,
      status: EnrollmentStatus.ENROLLED,
      tenantId: requireTenantId(tenantId),
    });
    return this.trainingEnrollmentRepo.save(enrollment);
  }

  async getTrainingEnrollments(
    trainingProgramId: string,
    tenantId?: string,
  ): Promise<TrainingEnrollment[]> {
    return this.trainingEnrollmentRepo.find({
      where: { trainingProgramId, tenantId: requireTenantId(tenantId) },
      relations: ['employee'],
      order: { enrolledAt: 'DESC' },
    });
  }

  async getEmployeeTrainings(employeeId: string, tenantId?: string): Promise<TrainingEnrollment[]> {
    return this.trainingEnrollmentRepo.find({
      where: { employeeId, tenantId: requireTenantId(tenantId) },
      relations: ['trainingProgram'],
      order: { enrolledAt: 'DESC' },
    });
  }

  async updateEnrollment(
    id: string,
    dto: UpdateEnrollmentDto,
    tenantId?: string,
  ): Promise<TrainingEnrollment> {
    const enrollment = await this.trainingEnrollmentRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    if (dto.status) enrollment.status = dto.status as EnrollmentStatus;
    if (dto.score !== undefined) enrollment.score = dto.score;
    if (dto.certified !== undefined) enrollment.certified = dto.certified;
    if (dto.feedback) enrollment.feedback = dto.feedback;

    if (dto.status === 'completed') {
      enrollment.completionDate = new Date();
    }

    return this.trainingEnrollmentRepo.save(enrollment);
  }

  // ============ RECRUITMENT DASHBOARD ============

  async getRecruitmentStats(facilityId: string, tenantId?: string) {
    const [openPositions, totalApplications, shortlisted, hired] = await Promise.all([
      this.jobPostingRepo.count({
        where: { facilityId, status: JobStatus.OPEN, tenantId: requireTenantId(tenantId) },
      }),
      this.jobApplicationRepo.count({
        where: { jobPosting: { facilityId, tenantId: requireTenantId(tenantId) } },
      }),
      this.jobApplicationRepo.count({
        where: {
          jobPosting: { facilityId, tenantId: requireTenantId(tenantId) },
          status: ApplicationStatus.SHORTLISTED,
        },
      }),
      this.jobApplicationRepo.count({
        where: {
          jobPosting: { facilityId, tenantId: requireTenantId(tenantId) },
          status: ApplicationStatus.HIRED,
        },
      }),
    ]);

    return { openPositions, totalApplications, shortlisted, hired };
  }

  // ============ TRAINING DASHBOARD ============

  async getTrainingStats(facilityId: string, tenantId?: string) {
    const [totalPrograms, activePrograms, totalEnrollments, completed] = await Promise.all([
      this.trainingProgramRepo.count({ where: { facilityId, tenantId: requireTenantId(tenantId) } }),
      this.trainingProgramRepo.count({
        where: {
          facilityId,
          status: TrainingStatus.IN_PROGRESS,
          tenantId: requireTenantId(tenantId),
        },
      }),
      this.trainingEnrollmentRepo.count({
        where: { trainingProgram: { facilityId, tenantId: requireTenantId(tenantId) } },
      }),
      this.trainingEnrollmentRepo.count({
        where: {
          trainingProgram: { facilityId, tenantId: requireTenantId(tenantId) },
          status: EnrollmentStatus.COMPLETED,
        },
      }),
    ]);

    return { totalPrograms, activePrograms, totalEnrollments, completed };
  }

  // ============ APPRAISALS DASHBOARD ============

  async getAppraisalStats(facilityId: string, year: number, tenantId?: string) {
    const [total, pending, completed] = await Promise.all([
      this.appraisalRepo.count({ where: { facilityId, year, tenantId: requireTenantId(tenantId) } }),
      this.appraisalRepo.count({
        where: {
          facilityId,
          year,
          status: In([
            AppraisalStatus.DRAFT,
            AppraisalStatus.SELF_REVIEW,
            AppraisalStatus.MANAGER_REVIEW,
          ]),
          tenantId: requireTenantId(tenantId),
        },
      }),
      this.appraisalRepo.count({
        where: {
          facilityId,
          year,
          status: In([AppraisalStatus.COMPLETED, AppraisalStatus.ACKNOWLEDGED]),
          tenantId: requireTenantId(tenantId),
        },
      }),
    ]);

    // Get average rating
    const avgQb = this.appraisalRepo
      .createQueryBuilder('a')
      .select('AVG(a.overallRating)', 'avg')
      .where('a.facilityId = :facilityId AND a.year = :year AND a.overallRating IS NOT NULL', {
        facilityId,
        year,
      });
    avgQb.andWhere('a.tenant_id = :tenantId', { tenantId: requireTenantId(tenantId) });
    const avgResult = await avgQb.getRawOne();

    return {
      total,
      pending,
      completed,
      averageRating: avgResult?.avg ? parseFloat(avgResult.avg).toFixed(2) : null,
    };
  }

  // ============ STAFF DOCUMENTS ============

  async getStaffDocuments(userId: string, tenantId?: string) {
    return this.documentRepo.find({
      where: { userId, tenantId: requireTenantId(tenantId) },
      order: { createdAt: 'DESC' },
    });
  }

  async getDocumentById(documentId: string, tenantId?: string) {
    return this.documentRepo.findOne({
      where: { id: documentId, tenantId: requireTenantId(tenantId) },
    });
  }

  async uploadStaffDocument(
    userId: string,
    file: { path: string; mimetype: string; size: number },
    data: {
      documentType: DocumentType;
      documentName: string;
      licenseNumber?: string;
      issuingAuthority?: string;
      issueDate?: string;
      expiryDate?: string;
      notes?: string;
    },

    tenantId?: string,
  ) {
    const document = this.documentRepo.create({
      userId,
      documentType: data.documentType,
      documentName: data.documentName,
      filePath: file.path,
      fileType: file.mimetype,
      fileSize: file.size,
      licenseNumber: data.licenseNumber,
      issuingAuthority: data.issuingAuthority,
      issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      notes: data.notes,
      status: DocumentStatus.PENDING,
      tenantId: requireTenantId(tenantId),
    } as DeepPartial<StaffDocument>);

    return this.documentRepo.save(document);
  }

  async verifyDocument(
    documentId: string,
    verifiedBy: string,
    status: DocumentStatus,
    tenantId?: string,
  ) {
    const document = await this.documentRepo.findOne({
      where: { id: documentId, tenantId: requireTenantId(tenantId) },
    });
    if (!document) throw new NotFoundException('Document not found');

    document.status = status;
    document.verifiedBy = verifiedBy;
    document.verifiedAt = new Date();

    return this.documentRepo.save(document);
  }

  async deleteDocument(documentId: string, tenantId?: string) {
    const document = await this.documentRepo.findOne({
      where: { id: documentId, tenantId: requireTenantId(tenantId) },
    });
    if (!document) throw new NotFoundException('Document not found');

    // Soft delete
    await this.documentRepo.softRemove(document);
    return { message: 'Document deleted' };
  }

  async getDocumentStats(tenantId?: string) {
    const [total, valid, expiringSoon, expired] = await Promise.all([
      this.documentRepo.count({
        where: { deletedAt: IsNull(), tenantId: requireTenantId(tenantId) },
      }),
      this.documentRepo.count({
        where: {
          status: DocumentStatus.VERIFIED,
          deletedAt: IsNull(),
          tenantId: requireTenantId(tenantId),
        },
      }),
      this.documentRepo.count({
        where: {
          status: DocumentStatus.VERIFIED,
          expiryDate: Between(new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
          deletedAt: IsNull(),
          tenantId: requireTenantId(tenantId),
        },
      }),
      this.documentRepo.count({
        where: {
          expiryDate: LessThanOrEqual(new Date()),
          deletedAt: IsNull(),
          tenantId: requireTenantId(tenantId),
        },
      }),
    ]);

    return { total, valid, expiringSoon, expired };
  }

  async getLeaveBalances(facilityId?: string, tenantId?: string): Promise<any[]> {
    const where: any = { status: Not(EmploymentStatus.TERMINATED) };
    where.tenantId = requireTenantId(tenantId);
    if (facilityId) where.facilityId = facilityId;
    const employees = await this.employeeRepo.find({ where, take: 200 });

    // For each employee, sum approved leave taken this year
    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const results = await Promise.all(
      employees.map(async (emp) => {
        const approved = await this.leaveRepo.find({
          where: {
            employeeId: emp.id,
            status: LeaveStatus.APPROVED,
            startDate: Between(new Date(yearStart), new Date(yearEnd)),
            tenantId: requireTenantId(tenantId),
          },
        });
        const usedAnnual = approved
          .filter((l) => l.leaveType === LeaveType.ANNUAL)
          .reduce((s, l) => s + l.daysRequested, 0);
        const usedSick = approved
          .filter((l) => l.leaveType === LeaveType.SICK)
          .reduce((s, l) => s + l.daysRequested, 0);
        const usedCasual = approved
          .filter((l) => l.leaveType === LeaveType.COMPASSIONATE)
          .reduce((s, l) => s + l.daysRequested, 0);

        const annualEntitled = emp.annualLeaveBalance ?? 21;
        const sickEntitled = emp.sickLeaveBalance ?? 14;

        return {
          staffId: emp.employeeNumber || emp.id,
          staffName: `${emp.firstName} ${emp.lastName}`.trim(),
          department: emp.department ?? '',
          annual: {
            entitled: annualEntitled,
            used: usedAnnual,
            balance: annualEntitled - usedAnnual,
          },
          sick: { entitled: sickEntitled, used: usedSick, balance: sickEntitled - usedSick },
          casual: { entitled: 7, used: usedCasual, balance: 7 - usedCasual },
        };
      }),
    );
    return results;
  }

  // ============ DISCIPLINARY ACTIONS ============

  async createDisciplinaryAction(
    dto: any,
    userId: string,
    tenantId?: string,
  ): Promise<DisciplinaryAction> {
    const action = this.disciplinaryRepo.create({
      ...dto,
      issuedById: userId,
      tenantId: requireTenantId(tenantId),
    });
    const saved = await this.disciplinaryRepo.save(action);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async getDisciplinaryActions(
    employeeId?: string,
    facilityId?: string,
    tenantId?: string,
  ): Promise<DisciplinaryAction[]> {
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (facilityId) where.facilityId = facilityId;
    where.tenantId = requireTenantId(tenantId);
    return this.disciplinaryRepo.find({
      where,
      relations: ['employee', 'issuedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getDisciplinaryAction(id: string, tenantId?: string): Promise<DisciplinaryAction> {
    const action = await this.disciplinaryRepo.findOne({
      where: { id },
      relations: ['employee', 'issuedBy'],
    });
    if (!action) throw new NotFoundException('Disciplinary action not found');
    return action;
  }

  async updateDisciplinaryAction(
    id: string,
    dto: any,
    tenantId?: string,
  ): Promise<DisciplinaryAction> {
    const action = await this.getDisciplinaryAction(id, tenantId);
    Object.assign(action, dto);
    if (dto.status === 'resolved' && !action.resolutionDate) {
      action.resolutionDate = new Date().toISOString().split('T')[0];
    }
    return this.disciplinaryRepo.save(action);
  }

  async acknowledgeDisciplinary(id: string, tenantId?: string): Promise<DisciplinaryAction> {
    const action = await this.getDisciplinaryAction(id, tenantId);
    action.acknowledgedAt = new Date();
    return this.disciplinaryRepo.save(action);
  }

  // ============ SALARY HISTORY ============

  async recordSalaryChange(dto: any, userId: string, tenantId?: string): Promise<SalaryHistory> {
    const record = this.salaryHistoryRepo.create({
      ...dto,
      approvedById: userId,
      tenantId: requireTenantId(tenantId),
    });
    const saved = await this.salaryHistoryRepo.save(record);
    const result = Array.isArray(saved) ? saved[0] : saved;
    await this.writeAudit({
      action: 'EMPLOYEE_SALARY_CHANGED',
      entityType: 'Employee',
      entityId: (dto?.employeeId as string) || result?.employeeId,
      actorUserId: userId,
      tenantId,
      newValue: {
        salaryHistoryId: result?.id,
        newSalary: dto?.newSalary,
        previousSalary: dto?.previousSalary,
        changeType: dto?.changeType,
        effectiveDate: dto?.effectiveDate,
        reason: dto?.reason,
      },
    });
    return result;
  }

  async getSalaryHistory(employeeId: string, tenantId?: string): Promise<SalaryHistory[]> {
    return this.salaryHistoryRepo.find({
      where: { employeeId, tenantId: requireTenantId(tenantId) },
      relations: ['approvedBy'],
      order: { effectiveDate: 'DESC' },
    });
  }

  // ============ ONBOARDING ============

  async createOnboardingTask(dto: any, tenantId?: string): Promise<OnboardingTask> {
    const task = this.onboardingTaskRepo.create({
      ...dto,
      tenantId: requireTenantId(tenantId),
    });
    const saved = await this.onboardingTaskRepo.save(task);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async createOnboardingFromTemplate(
    employeeId: string,
    facilityId?: string,
    tenantId?: string,
  ): Promise<OnboardingTask[]> {
    const defaultTasks = [
      {
        taskName: 'Submit personal documents (ID, certificates)',
        category: OnboardingCategory.DOCUMENTATION,
        sortOrder: 1,
      },
      {
        taskName: 'Complete employment contract signing',
        category: OnboardingCategory.DOCUMENTATION,
        sortOrder: 2,
      },
      { taskName: 'Register for NSSF', category: OnboardingCategory.COMPLIANCE, sortOrder: 3 },
      { taskName: 'Register TIN with URA', category: OnboardingCategory.COMPLIANCE, sortOrder: 4 },
      {
        taskName: 'Set up system account and credentials',
        category: OnboardingCategory.IT_SETUP,
        sortOrder: 5,
      },
      { taskName: 'Issue staff ID card', category: OnboardingCategory.EQUIPMENT, sortOrder: 6 },
      {
        taskName: 'Provide uniform and equipment',
        category: OnboardingCategory.EQUIPMENT,
        sortOrder: 7,
      },
      {
        taskName: 'Facility tour and introductions',
        category: OnboardingCategory.ORIENTATION,
        sortOrder: 8,
      },
      {
        taskName: 'Review policies and procedures manual',
        category: OnboardingCategory.ORIENTATION,
        sortOrder: 9,
      },
      {
        taskName: 'Health and safety orientation',
        category: OnboardingCategory.TRAINING,
        sortOrder: 10,
      },
      {
        taskName: 'Department-specific training',
        category: OnboardingCategory.TRAINING,
        sortOrder: 11,
      },
      { taskName: 'Assign mentor/buddy', category: OnboardingCategory.ORIENTATION, sortOrder: 12 },
      {
        taskName: 'Set up bank account for salary',
        category: OnboardingCategory.DOCUMENTATION,
        sortOrder: 13,
      },
      {
        taskName: 'Complete probation objectives setting',
        category: OnboardingCategory.COMPLIANCE,
        sortOrder: 14,
      },
    ];

    const tasks = defaultTasks.map((t) =>
      this.onboardingTaskRepo.create({
        ...t,
        employeeId,
        facilityId,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 weeks
        tenantId: requireTenantId(tenantId),
      }),
    );
    return this.onboardingTaskRepo.save(tasks);
  }

  async getOnboardingTasks(employeeId: string, tenantId?: string): Promise<OnboardingTask[]> {
    return this.onboardingTaskRepo.find({
      where: { employeeId, tenantId: requireTenantId(tenantId) },
      relations: ['assignedTo', 'completedBy'],
      order: { sortOrder: 'ASC' },
    });
  }

  async updateOnboardingTask(
    id: string,
    dto: any,
    userId: string,
    tenantId?: string,
  ): Promise<OnboardingTask> {
    const task = await this.onboardingTaskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Onboarding task not found');
    Object.assign(task, dto);
    if (dto.status === 'completed' && !task.completedAt) {
      task.completedAt = new Date();
      task.completedById = userId;
    }
    return this.onboardingTaskRepo.save(task);
  }

  async getOnboardingProgress(
    employeeId: string,
    tenantId?: string,
  ): Promise<{ total: number; completed: number; percentage: number }> {
    const tasks = await this.getOnboardingTasks(employeeId, tenantId);
    const completed = tasks.filter((t) => t.status === OnboardingTaskStatus.COMPLETED).length;
    return {
      total: tasks.length,
      completed,
      percentage: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
    };
  }

  // ============ PAYROLL REPORTS ============

  async getPayrollReport(payrollRunId: string, tenantId?: string): Promise<any> {
    const run = await this.payrollRunRepo.findOne({ where: { id: payrollRunId } });
    if (!run) throw new NotFoundException('Payroll run not found');
    const payslips = await this.payslipRepo.find({
      where: { payrollRunId, tenantId: requireTenantId(tenantId) },
      relations: ['employee'],
    });
    const totalPaye = payslips.reduce((s, p) => s + Number(p.paye || 0), 0);
    const totalNssfEmployee = payslips.reduce((s, p) => s + Number(p.nssfEmployee || 0), 0);
    const totalNssfEmployer = payslips.reduce((s, p) => s + Number(p.nssfEmployer || 0), 0);
    return {
      ...run,
      payslipCount: payslips.length,
      totalPaye,
      totalNssfEmployee,
      totalNssfEmployer,
      totalNssf: totalNssfEmployee + totalNssfEmployer,
      payslips: payslips.map((p) => ({
        employeeName: p.employee?.fullName || p.employee?.username || 'Unknown',
        employeeNumber: p.employee?.employeeNumber || '',
        basicSalary: Number(p.basicSalary || 0),
        grossSalary: Number(p.grossSalary || 0),
        paye: Number(p.paye || 0),
        nssfEmployee: Number(p.nssfEmployee || 0),
        nssfEmployer: Number(p.nssfEmployer || 0),
        totalDeductions: Number(p.totalDeductions || 0),
        netSalary: Number(p.netSalary || 0),
      })),
    };
  }

  async getTaxReport(year: number, facilityId?: string, tenantId?: string): Promise<any> {
    const where: any = { year, status: In([PayrollStatus.COMPLETED, PayrollStatus.PAID]) };
    if (facilityId) where.facilityId = facilityId;
    where.tenantId = requireTenantId(tenantId);
    const runs = await this.payrollRunRepo.find({ where, order: { month: 'ASC' } });
    const monthlyData = [];
    for (const run of runs) {
      const payslips = await this.payslipRepo.find({ where: { payrollRunId: run.id } });
      monthlyData.push({
        month: run.month,
        year: run.year,
        totalGross: payslips.reduce((s, p) => s + Number(p.grossSalary || 0), 0),
        totalPaye: payslips.reduce((s, p) => s + Number(p.paye || 0), 0),
        totalNssfEmployee: payslips.reduce((s, p) => s + Number(p.nssfEmployee || 0), 0),
        totalNssfEmployer: payslips.reduce((s, p) => s + Number(p.nssfEmployer || 0), 0),
        employeeCount: payslips.length,
      });
    }
    return {
      year,
      months: monthlyData,
      total: {
        gross: monthlyData.reduce((s, m) => s + m.totalGross, 0),
        paye: monthlyData.reduce((s, m) => s + m.totalPaye, 0),
        nssfEmployee: monthlyData.reduce((s, m) => s + m.totalNssfEmployee, 0),
        nssfEmployer: monthlyData.reduce((s, m) => s + m.totalNssfEmployer, 0),
      },
    };
  }
}
