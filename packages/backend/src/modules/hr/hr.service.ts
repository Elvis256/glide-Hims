import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, In, IsNull, Not } from 'typeorm';
import { Employee, EmploymentStatus } from '../../database/entities/employee.entity';
import { AttendanceRecord } from '../../database/entities/attendance.entity';
import { LeaveRequest, LeaveStatus, LeaveType } from '../../database/entities/leave-request.entity';
import { PayrollRun, PayrollStatus } from '../../database/entities/payroll-run.entity';
import { Payslip } from '../../database/entities/payslip.entity';
import { ShiftDefinition, ShiftType } from '../../database/entities/shift-definition.entity';
import { StaffRoster, RosterStatus } from '../../database/entities/staff-roster.entity';
import { ShiftSwapRequest, SwapRequestStatus } from '../../database/entities/shift-swap-request.entity';
import { JobPosting, JobStatus } from '../../database/entities/job-posting.entity';
import { JobApplication, ApplicationStatus } from '../../database/entities/job-application.entity';
import { PerformanceAppraisal, AppraisalStatus } from '../../database/entities/performance-appraisal.entity';
import { TrainingProgram, TrainingStatus } from '../../database/entities/training-program.entity';
import { TrainingEnrollment, EnrollmentStatus } from '../../database/entities/training-enrollment.entity';
import { User } from '../../database/entities/user.entity';
import { Department } from '../../database/entities/department.entity';
import { StaffDocument, DocumentType, DocumentStatus } from '../../database/entities/staff-document.entity';
import { Role } from '../../database/entities/role.entity';
import { UserRole } from '../../database/entities/user-role.entity';
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
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
  ) {}

  // ============ STAFF MANAGEMENT (Users as Staff) ============

  async getStaff(facilityId?: string, options: { status?: string; departmentId?: string; limit?: number; offset?: number } = {}, tenantId?: string) {
    const where: any = { deletedAt: IsNull() };
    if (tenantId) where.tenantId = tenantId;
    if (options.status) where.status = options.status;
    if (options.departmentId) where.departmentId = options.departmentId;
    // Note: facilityId filter can be added if needed: if (facilityId) where.facilityId = facilityId;

    const [data, total] = await this.userRepo.findAndCount({
      where,
      relations: ['department', 'facility', 'userRoles', 'userRoles.role'],
      order: { fullName: 'ASC' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    // Transform to staff format
    const staff = data.map(user => ({
      id: user.id,
      employeeNumber: user.employeeNumber || `EMP${user.id.slice(0, 5).toUpperCase()}`,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      username: user.username,
      roles: (user.userRoles || []).map((ur: any) => ({ id: ur.role?.id, name: ur.role?.name })).filter((r: any) => r.id),
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

    return { data: staff, meta: { total, limit: options.limit || 50, offset: options.offset || 0 } };
  }

  async getStaffById(id: string, tenantId?: string) {
    const user = await this.userRepo.findOne({
      where: { id, deletedAt: IsNull() , ...(tenantId ? { tenantId } : {}) },
      relations: ['department', 'facility', 'userRoles', 'userRoles.role'],
    });
    if (!user) throw new NotFoundException('Staff member not found');
    return user;
  }

  async updateStaff(id: string, dto: {
    jobTitle?: string;
    staffCategory?: string;
    employmentType?: string;
    departmentId?: string;
    facilityId?: string;
    dateOfBirth?: string;
    gender?: string;
    hireDate?: string;
    basicSalary?: number;
    phone?: string;
    address?: string;
    nationalId?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    bankName?: string;
    bankAccountNumber?: string;
  }, tenantId?: string) {
    const user = await this.getStaffById(id, tenantId);
    
    if (dto.jobTitle !== undefined) user.jobTitle = dto.jobTitle;
    if (dto.staffCategory !== undefined) user.staffCategory = dto.staffCategory as any;
    if (dto.employmentType !== undefined) user.employmentType = dto.employmentType as any;
    if (dto.departmentId !== undefined) user.departmentId = dto.departmentId;
    if (dto.facilityId !== undefined) user.facilityId = dto.facilityId;
    if (dto.dateOfBirth !== undefined) user.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.gender !== undefined) user.gender = dto.gender;
    if (dto.hireDate !== undefined) user.hireDate = new Date(dto.hireDate);
    if (dto.basicSalary !== undefined) user.basicSalary = dto.basicSalary;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.address !== undefined) user.address = dto.address;
    if (dto.nationalId !== undefined) user.nationalId = dto.nationalId;
    if (dto.emergencyContactName !== undefined) user.emergencyContactName = dto.emergencyContactName;
    if (dto.emergencyContactPhone !== undefined) user.emergencyContactPhone = dto.emergencyContactPhone;
    if (dto.bankName !== undefined) user.bankName = dto.bankName;
    if (dto.bankAccountNumber !== undefined) user.bankAccountNumber = dto.bankAccountNumber;

    return this.userRepo.save(user);
  }

  async getStaffDashboard(facilityId?: string, tenantId?: string) {
    const where: any = { deletedAt: IsNull() };
    if (tenantId) where.tenantId = tenantId;
    // if (facilityId) where.facilityId = facilityId;

    const totalStaff = await this.userRepo.count({ where });
    const activeStaff = await this.userRepo.count({ where: { ...where, status: 'active' } });
    const onLeaveStaff = await this.userRepo.count({ where: { ...where, status: 'on_leave' } });
    const resignedStaff = await this.userRepo.count({ where: { ...where, status: In(['resigned', 'terminated', 'inactive']) } });

    // Get pending leave requests count
    const pendingLeave = await this.leaveRepo.count({ where: { status: LeaveStatus.PENDING, ...(tenantId ? { tenantId } : {}) } });

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
    if (tenantId) qb.andWhere('user.tenant_id = :tenantId', { tenantId });
    const stats = await qb
      .groupBy('user.jobTitle')
      .addGroupBy('user.staffCategory')
      .getRawMany();
    
    return stats.map(s => ({
      jobTitle: s.jobTitle || 'Not Assigned',
      staffCategory: s.staffCategory || 'Other',
      count: parseInt(s.count),
    }));
  }

  // Get staff by category (consultants, specialists, etc.)
  async getStaffByCategory(category: string, tenantId?: string) {
    return this.userRepo.find({
      where: { 
        staffCategory: category as any,
        deletedAt: IsNull(),
        ...(tenantId ? { tenantId } : {}),
      },
      select: ['id', 'fullName', 'email', 'phone', 'employeeNumber', 'jobTitle', 'departmentId', 'status'],
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
  async createStaff(dto: {
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
  }, tenantId?: string) {
    // Check for existing email
    const existingEmail = await this.userRepo.findOne({ where: { email: dto.email , ...(tenantId ? { tenantId } : {}) } });
    if (existingEmail) {
      throw new ConflictException('A user with this email already exists');
    }

    // Generate username if not provided
    const username = dto.username || dto.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Check for existing username
    const existingUsername = await this.userRepo.findOne({ where: { username , ...(tenantId ? { tenantId } : {}) } });
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
      staffCategory: dto.staffCategory as any,
      employmentType: dto.employmentType as any,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      gender: dto.gender as any,
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
      ...(tenantId ? { tenantId } : {}),
    });

    const savedUser = await this.userRepo.save(user);

    // Assign role if provided
    if (dto.roleId) {
      const role = await this.roleRepo.findOne({ where: { id: dto.roleId , ...(tenantId ? { tenantId } : {}) } });
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
    const user = await this.userRepo.findOne({ where: { id , ...(tenantId ? { tenantId } : {}) } });
    if (!user) throw new NotFoundException('Staff member not found');

    user.status = 'inactive';
    await this.userRepo.save(user);

    return { success: true, message: 'Staff member deactivated' };
  }

  // Reactivate staff member
  async reactivateStaff(id: string, tenantId?: string) {
    const user = await this.userRepo.findOne({ where: { id , ...(tenantId ? { tenantId } : {}) } });
    if (!user) throw new NotFoundException('Staff member not found');

    user.status = 'active';
    await this.userRepo.save(user);

    return { success: true, message: 'Staff member reactivated' };
  }

  // Offboard employee (comprehensive deactivation workflow)
  async offboardEmployee(
    userId: string,
    dto: { reason: string; terminationDate?: string; revokeAccess?: boolean; deactivateAccount?: boolean },
    performedById: string,
    tenantId?: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId, ...(tenantId ? { tenantId } : {}) } });
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
    const employee = await this.employeeRepo.findOne({ where: { userId, ...(tenantId ? { tenantId } : {}) } });
    if (employee) {
      employee.status = 'terminated' as any;
      if (dto.terminationDate) {
        (employee as any).terminationDate = new Date(dto.terminationDate);
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
    const count = await this.employeeRepo.count({ where: { facilityId } });
    return `EMP${String(count + 1).padStart(5, '0')}`;
  }

  async createEmployee(dto: CreateEmployeeDto, tenantId?: string): Promise<Employee> {
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
      department: dto.department,
      employmentType: dto.employmentType,
      hireDate: new Date(dto.hireDate),
      salaryGrade: dto.salaryGrade,
      basicSalary: dto.basicSalary,
      allowances: dto.allowances,
      bankName: dto.bankName,
      bankAccountNumber: dto.bankAccountNumber,
      status: EmploymentStatus.ACTIVE,
      ...(tenantId ? { tenantId } : {}),
    });

    return this.employeeRepo.save(employee);
  }

  async getEmployees(facilityId: string, options: { status?: EmploymentStatus; department?: string; limit?: number; offset?: number }, tenantId?: string) {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    if (options.status) where.status = options.status;
    if (options.department) where.department = options.department;

    const [data, total] = await this.employeeRepo.findAndCount({
      where,
      order: { lastName: 'ASC', firstName: 'ASC' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    return { data, meta: { total, limit: options.limit || 50, offset: options.offset || 0 } };
  }

  async getEmployeeById(id: string, tenantId?: string): Promise<Employee> {
    const employee = await this.employeeRepo.findOne({
      where: { id , ...(tenantId ? { tenantId } : {}) },
      relations: ['facility', 'user'],
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto, tenantId?: string): Promise<Employee> {
    const employee = await this.getEmployeeById(id, tenantId);
    Object.assign(employee, dto);
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

  async recordAttendance(dto: RecordAttendanceDto, facilityId: string, tenantId?: string): Promise<AttendanceRecord> {
    // Check if record exists for this date
    const existing = await this.attendanceRepo.findOne({
      where: { employeeId: dto.employeeId, date: new Date(dto.date) , ...(tenantId ? { tenantId } : {}) },
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
      ...(tenantId ? { tenantId } : {}),
    });

    return this.attendanceRepo.save(record);
  }

  async clockIn(employeeId: string, facilityId: string, tenantId?: string): Promise<AttendanceRecord> {
    const today = new Date();
    const time = today.toTimeString().slice(0, 5);

    return this.recordAttendance({
      employeeId,
      date: today.toISOString().slice(0, 10),
      clockIn: time,
      status: 'present',
    }, facilityId, tenantId);
  }

  async clockOut(employeeId: string, facilityId: string, tenantId?: string): Promise<AttendanceRecord> {
    const today = new Date();
    const time = today.toTimeString().slice(0, 5);

    return this.recordAttendance({
      employeeId,
      date: today.toISOString().slice(0, 10),
      clockOut: time,
    }, facilityId, tenantId);
  }

  private calculateHoursWorked(clockIn: string, clockOut: string): number {
    const [inH, inM] = clockIn.split(':').map(Number);
    const [outH, outM] = clockOut.split(':').map(Number);
    const inMinutes = inH * 60 + inM;
    const outMinutes = outH * 60 + outM;
    return Math.round((outMinutes - inMinutes) / 60 * 100) / 100;
  }

  async getAttendance(facilityId: string, options: { employeeId?: string; startDate?: string; endDate?: string }, tenantId?: string) {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    if (options.employeeId) where.employeeId = options.employeeId;
    if (options.startDate && options.endDate) {
      where.date = Between(new Date(options.startDate), new Date(options.endDate));
    }

    return this.attendanceRepo.find({
      where,
      relations: ['employee'],
      order: { date: 'DESC' },
    });
  }

  // ============ LEAVE MANAGEMENT ============

  async requestLeave(dto: RequestLeaveDto, tenantId?: string): Promise<LeaveRequest> {
    const employee = await this.getEmployeeById(dto.employeeId, tenantId);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const daysRequested = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Check leave balance for annual/sick leave
    if (dto.leaveType === LeaveType.ANNUAL && daysRequested > employee.annualLeaveBalance) {
      throw new BadRequestException(`Insufficient annual leave balance. Available: ${employee.annualLeaveBalance} days`);
    }
    if (dto.leaveType === LeaveType.SICK && daysRequested > employee.sickLeaveBalance) {
      throw new BadRequestException(`Insufficient sick leave balance. Available: ${employee.sickLeaveBalance} days`);
    }

    const leave = this.leaveRepo.create({
      employeeId: dto.employeeId,
      leaveType: dto.leaveType,
      startDate,
      endDate,
      daysRequested,
      reason: dto.reason,
      status: LeaveStatus.PENDING,
      ...(tenantId ? { tenantId } : {}),
    });

    return this.leaveRepo.save(leave);
  }

  async approveLeave(id: string, dto: ApproveLeaveDto, userId: string, tenantId?: string): Promise<LeaveRequest> {
    const leave = await this.leaveRepo.findOne({
      where: { id , ...(tenantId ? { tenantId } : {}) },
      relations: ['employee'],
    });
    if (!leave) throw new NotFoundException('Leave request not found');

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Leave request has already been processed');
    }

    leave.status = dto.approved ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;
    leave.approvedById = userId;
    leave.approvedAt = new Date();
    if (dto.notes) leave.approvalNotes = dto.notes;

    // Update leave balance if approved
    if (dto.approved) {
      const employee = leave.employee;
      if (leave.leaveType === LeaveType.ANNUAL) {
        employee.annualLeaveBalance -= leave.daysRequested;
      } else if (leave.leaveType === LeaveType.SICK) {
        employee.sickLeaveBalance -= leave.daysRequested;
      }
      await this.employeeRepo.save(employee);
    }

    return this.leaveRepo.save(leave);
  }

  async getLeaveRequests(facilityId: string, options: { status?: LeaveStatus; employeeId?: string }, tenantId?: string) {
    const qb = this.leaveRepo.createQueryBuilder('leave')
      .leftJoinAndSelect('leave.employee', 'employee')
      .where('employee.facilityId = :facilityId', { facilityId });
    if (tenantId) qb.andWhere('leave.tenantId = :tenantId', { tenantId });

    if (options.status) {
      qb.andWhere('leave.status = :status', { status: options.status });
    }
    if (options.employeeId) {
      qb.andWhere('leave.employeeId = :employeeId', { employeeId: options.employeeId });
    }

    return qb.orderBy('leave.createdAt', 'DESC').getMany();
  }

  // ============ PAYROLL ============

  private async generatePayrollNumber(facilityId: string, month: number, year: number): Promise<string> {
    return `PAY${year}${String(month).padStart(2, '0')}-${facilityId.slice(0, 4).toUpperCase()}`;
  }

  async createPayrollRun(dto: CreatePayrollRunDto, userId: string, tenantId?: string): Promise<PayrollRun> {
    // Check if payroll already exists for this month
    const existing = await this.payrollRunRepo.findOne({
      where: { facilityId: dto.facilityId, month: dto.month, year: dto.year , ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) {
      throw new BadRequestException(`Payroll for ${dto.month}/${dto.year} already exists`);
    }

    const payrollNumber = await this.generatePayrollNumber(dto.facilityId, dto.month, dto.year);

    // Calculate pay period
    const payPeriodStart = new Date(dto.year, dto.month - 1, 1);
    const payPeriodEnd = new Date(dto.year, dto.month, 0);

    const payroll = this.payrollRunRepo.create({
      payrollNumber,
      facilityId: dto.facilityId,
      month: dto.month,
      year: dto.year,
      payPeriodStart,
      payPeriodEnd,
      status: PayrollStatus.DRAFT,
      createdById: userId,
      ...(tenantId ? { tenantId } : {}),
    });

    return this.payrollRunRepo.save(payroll);
  }

  async processPayroll(id: string, tenantId?: string): Promise<PayrollRun> {
    const payroll = await this.payrollRunRepo.findOne({ where: { id , ...(tenantId ? { tenantId } : {}) } });
    if (!payroll) throw new NotFoundException('Payroll run not found');

    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new BadRequestException('Payroll has already been processed');
    }

    payroll.status = PayrollStatus.PROCESSING;
    await this.payrollRunRepo.save(payroll);

    // Get active employees
    const employees = await this.employeeRepo.find({
      where: { facilityId: payroll.facilityId, status: EmploymentStatus.ACTIVE , ...(tenantId ? { tenantId } : {}) },
    });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalPaye = 0;
    let totalNssf = 0;

    for (const emp of employees) {
      // Calculate gross salary
      const allowancesTotal = (emp.allowances || []).reduce((sum, a) => sum + a.amount, 0);
      const grossSalary = Number(emp.basicSalary) + allowancesTotal;

      // Calculate NSSF (5% employee, 10% employer, max 500,000 UGX salary cap)
      const nssfSalaryCap = Math.min(grossSalary, 500000);
      const nssfEmployee = nssfSalaryCap * 0.05;
      const nssfEmployer = nssfSalaryCap * 0.10;

      // Calculate PAYE (Uganda tax brackets simplified)
      const paye = this.calculatePaye(grossSalary);

      // Other deductions
      const otherDeductionsTotal = (emp.deductions || []).reduce((sum, d) => {
        if (d.type === 'fixed') return sum + d.amount;
        return sum + (grossSalary * d.amount / 100);
      }, 0);

      const totalDeductionsForEmp = paye + nssfEmployee + otherDeductionsTotal;
      const netSalary = grossSalary - totalDeductionsForEmp;

      // Create payslip
      const payslip = this.payslipRepo.create({
        payrollRunId: payroll.id,
        employeeId: emp.id,
        basicSalary: emp.basicSalary,
        allowances: emp.allowances?.map(a => ({ name: a.name, amount: a.amount })),
        grossSalary,
        paye,
        nssfEmployee,
        nssfEmployer,
        otherDeductions: emp.deductions?.map(d => ({ name: d.name, amount: d.type === 'fixed' ? d.amount : grossSalary * d.amount / 100 })),
        totalDeductions: totalDeductionsForEmp,
        netSalary,
        daysWorked: 22,
        isPaid: false,
        ...(tenantId ? { tenantId } : {}),
      });
      await this.payslipRepo.save(payslip);

      totalGross += grossSalary;
      totalDeductions += totalDeductionsForEmp;
      totalNet += netSalary;
      totalPaye += paye;
      totalNssf += nssfEmployee + nssfEmployer;
    }

    // Update payroll totals
    payroll.employeeCount = employees.length;
    payroll.totalGross = totalGross;
    payroll.totalDeductions = totalDeductions;
    payroll.totalNet = totalNet;
    payroll.totalPaye = totalPaye;
    payroll.totalNssf = totalNssf;
    payroll.status = PayrollStatus.COMPLETED;

    return this.payrollRunRepo.save(payroll);
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
      paye += bracket * 0.10;
      remaining -= bracket;
    }

    // Third bracket (335,001-410,000) - 20%
    if (remaining > 0) {
      const bracket = Math.min(remaining, 75000);
      paye += bracket * 0.20;
      remaining -= bracket;
    }

    // Fourth bracket (410,001-10,000,000) - 30%
    if (remaining > 0) {
      const bracket = Math.min(remaining, 9590000);
      paye += bracket * 0.30;
      remaining -= bracket;
    }

    // Above 10,000,000 - 40%
    if (remaining > 0) {
      paye += remaining * 0.40;
    }

    return Math.round(paye);
  }

  async getPayrollRuns(facilityId: string, options: { year?: number; status?: PayrollStatus }, tenantId?: string) {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    if (options.year) where.year = options.year;
    if (options.status) where.status = options.status;

    return this.payrollRunRepo.find({
      where,
      order: { year: 'DESC', month: 'DESC' },
    });
  }

  async getPayslips(payrollRunId: string, tenantId?: string): Promise<Payslip[]> {
    return this.payslipRepo.find({
      where: { payrollRunId , ...(tenantId ? { tenantId } : {}) },
      relations: ['employee'],
      order: { employee: { lastName: 'ASC' } },
    });
  }

  async getEmployeePayslips(employeeId: string, tenantId?: string): Promise<Payslip[]> {
    return this.payslipRepo.find({
      where: { employeeId , ...(tenantId ? { tenantId } : {}) },
      relations: ['payrollRun'],
      order: { createdAt: 'DESC' },
    });
  }

  async getMyPayslips(userId: string, year?: number, tenantId?: string): Promise<Payslip[]> {
    // Find employee linked to this user
    const employee = await this.employeeRepo.findOne({
      where: { userId , ...(tenantId ? { tenantId } : {}) },
    });

    if (!employee) {
      return [];
    }

    const whereClause: any = { employeeId: employee.id };
    if (tenantId) whereClause.tenantId = tenantId;
    
    // Filter by year if provided
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
    const [
      totalEmployees,
      activeEmployees,
      pendingLeaves,
      todayAttendance,
    ] = await Promise.all([
      this.employeeRepo.count({ where: { facilityId , ...(tenantId ? { tenantId } : {}) } }),
      this.employeeRepo.count({ where: { facilityId, status: EmploymentStatus.ACTIVE , ...(tenantId ? { tenantId } : {}) } }),
      this.leaveRepo.count({
        where: {
          status: LeaveStatus.PENDING,
          employee: { facilityId },
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.attendanceRepo.count({
        where: {
          facilityId,
          date: new Date(),
          status: 'present',
          ...(tenantId ? { tenantId } : {}),
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

  async createShiftDefinition(dto: CreateShiftDefinitionDto, tenantId?: string): Promise<ShiftDefinition> {
    // Calculate duration
    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);
    let durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
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
      ...(tenantId ? { tenantId } : {}),
    });

    return this.shiftDefRepo.save(shift);
  }

  async getShiftDefinitions(facilityId: string, departmentId?: string, tenantId?: string): Promise<ShiftDefinition[]> {
    const where: any = { facilityId, isActive: true };
    if (tenantId) where.tenantId = tenantId;
    if (departmentId) where.departmentId = departmentId;

    return this.shiftDefRepo.find({
      where,
      relations: ['department'],
      order: { startTime: 'ASC' },
    });
  }

  async updateShiftDefinition(id: string, updates: Partial<CreateShiftDefinitionDto>, tenantId?: string): Promise<ShiftDefinition> {
    const shift = await this.shiftDefRepo.findOne({ where: { id , ...(tenantId ? { tenantId } : {}) } });
    if (!shift) throw new NotFoundException('Shift definition not found');

    Object.assign(shift, updates);
    return this.shiftDefRepo.save(shift);
  }

  async deleteShiftDefinition(id: string, tenantId?: string): Promise<void> {
    const shift = await this.shiftDefRepo.findOne({ where: { id , ...(tenantId ? { tenantId } : {}) } });
    if (!shift) throw new NotFoundException('Shift definition not found');
    shift.isActive = false;
    await this.shiftDefRepo.save(shift);
  }

  // ============ ROSTER MANAGEMENT ============

  async createRoster(dto: CreateRosterDto, userId: string, tenantId?: string): Promise<StaffRoster> {
    // Check for existing roster on same date
    const existing = await this.rosterRepo.findOne({
      where: {
        employeeId: dto.employeeId,
        rosterDate: new Date(dto.rosterDate),
        status: In([RosterStatus.SCHEDULED, RosterStatus.CONFIRMED]),
        ...(tenantId ? { tenantId } : {}),
      },
    });

    if (existing) {
      throw new BadRequestException('Employee already has a shift scheduled for this date');
    }

    // Check shift coverage
    const shift = await this.shiftDefRepo.findOne({ where: { id: dto.shiftDefinitionId , ...(tenantId ? { tenantId } : {}) } });
    if (!shift) throw new NotFoundException('Shift definition not found');

    const existingCount = await this.rosterRepo.count({
      where: {
        shiftDefinitionId: dto.shiftDefinitionId,
        rosterDate: new Date(dto.rosterDate),
        status: In([RosterStatus.SCHEDULED, RosterStatus.CONFIRMED]),
        ...(tenantId ? { tenantId } : {}),
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
      ...(tenantId ? { tenantId } : {}),
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

      const shiftsForDay = shiftPattern.filter(p => p.dayOfWeek === dayOfWeek);

      for (const shiftConfig of shiftsForDay) {
        for (const employeeId of employeeIds) {
          try {
            const roster = await this.createRoster({
              facilityId,
              employeeId,
              shiftDefinitionId: shiftConfig.shiftDefinitionId,
              rosterDate: currentDate.toISOString().slice(0, 10),
            }, userId, tenantId);
            rosters.push(roster);
          } catch (error) {
            // Skip if conflict
            this.logger.warn(`Skipped roster for ${employeeId} on ${currentDate}: ${error.message}`);
          }
        }
      }
    }

    return rosters;
  }

  async getRoster(facilityId: string, startDate: string, endDate: string, options?: {
    employeeId?: string;
    departmentId?: string;
    shiftDefinitionId?: string;
  }, tenantId?: string): Promise<StaffRoster[]> {
    const qb = this.rosterRepo.createQueryBuilder('roster')
      .leftJoinAndSelect('roster.employee', 'employee')
      .leftJoinAndSelect('roster.shiftDefinition', 'shift')
      .where('roster.facilityId = :facilityId', { facilityId })
      .andWhere('roster.rosterDate BETWEEN :start AND :end', {
        start: new Date(startDate),
        end: new Date(endDate),
      });
    if (tenantId) qb.andWhere('roster.tenant_id = :tenantId', { tenantId });

    if (options?.employeeId) {
      qb.andWhere('roster.employeeId = :employeeId', { employeeId: options.employeeId });
    }
    if (options?.departmentId) {
      qb.andWhere('shift.departmentId = :departmentId', { departmentId: options.departmentId });
    }
    if (options?.shiftDefinitionId) {
      qb.andWhere('roster.shiftDefinitionId = :shiftDefinitionId', { shiftDefinitionId: options.shiftDefinitionId });
    }

    return qb.orderBy('roster.rosterDate', 'ASC').addOrderBy('shift.startTime', 'ASC').getMany();
  }

  async updateRosterStatus(id: string, status: RosterStatus, notes?: string, tenantId?: string): Promise<StaffRoster> {
    const roster = await this.rosterRepo.findOne({ where: { id , ...(tenantId ? { tenantId } : {}) } });
    if (!roster) throw new NotFoundException('Roster entry not found');

    roster.status = status;
    if (notes) roster.notes = notes;
    if (status === RosterStatus.ABSENT && notes) roster.absenceReason = notes;

    return this.rosterRepo.save(roster);
  }

  async recordActualTimes(id: string, startTime: string, endTime?: string, tenantId?: string): Promise<StaffRoster> {
    const roster = await this.rosterRepo.findOne({
      where: { id , ...(tenantId ? { tenantId } : {}) },
      relations: ['shiftDefinition'],
    });
    if (!roster) throw new NotFoundException('Roster entry not found');

    roster.actualStartTime = startTime;
    if (endTime) {
      roster.actualEndTime = endTime;
      
      // Calculate hours worked
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      let worked = (endH * 60 + endM) - (startH * 60 + startM);
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
    const requesterRoster = await this.rosterRepo.findOne({
      where: { id: dto.requesterRosterId , ...(tenantId ? { tenantId } : {}) },
      relations: ['employee'],
    });
    if (!requesterRoster) throw new NotFoundException('Requester roster not found');

    const swap = this.swapRepo.create({
      facilityId: requesterRoster.facilityId,
      requesterId: requesterRoster.employeeId,
      requesterRosterId: dto.requesterRosterId,
      targetEmployeeId: dto.targetEmployeeId,
      targetRosterId: dto.targetRosterId,
      isMutualSwap: !!dto.targetRosterId,
      reason: dto.reason,
      status: SwapRequestStatus.PENDING,
      ...(tenantId ? { tenantId } : {}),
    });

    // Update requester's roster status
    requesterRoster.status = RosterStatus.SWAP_PENDING;
    await this.rosterRepo.save(requesterRoster);

    return this.swapRepo.save(swap);
  }

  async respondToSwapRequest(id: string, accepted: boolean, userId: string, tenantId?: string): Promise<ShiftSwapRequest> {
    const swap = await this.swapRepo.findOne({
      where: { id , ...(tenantId ? { tenantId } : {}) },
      relations: ['requesterRoster', 'targetRoster'],
    });
    if (!swap) throw new NotFoundException('Swap request not found');

    swap.targetAccepted = accepted;
    swap.targetRespondedAt = new Date();

    if (!accepted) {
      swap.status = SwapRequestStatus.REJECTED;
      // Revert requester's roster status
      await this.rosterRepo.update(swap.requesterRosterId, { status: RosterStatus.SCHEDULED });
    }

    return this.swapRepo.save(swap);
  }

  async approveSwapRequest(id: string, dto: ApproveSwapDto, userId: string, tenantId?: string): Promise<ShiftSwapRequest> {
    const swap = await this.swapRepo.findOne({
      where: { id , ...(tenantId ? { tenantId } : {}) },
      relations: ['requesterRoster', 'targetRoster'],
    });
    if (!swap) throw new NotFoundException('Swap request not found');

    if (!swap.targetAccepted) {
      throw new BadRequestException('Target employee has not accepted the swap request');
    }

    if (dto.approved) {
      swap.status = SwapRequestStatus.APPROVED;
      swap.approvedById = userId;
      swap.approvedAt = new Date();

      // Execute the swap
      if (swap.isMutualSwap && swap.targetRosterId) {
        // Mutual swap - exchange employees
        const tempEmployee = swap.requesterRoster.employeeId;
        await this.rosterRepo.update(swap.requesterRosterId, {
          employeeId: swap.targetEmployeeId,
          originalEmployeeId: tempEmployee,
          status: RosterStatus.CONFIRMED,
        });
        await this.rosterRepo.update(swap.targetRosterId, {
          employeeId: tempEmployee,
          originalEmployeeId: swap.targetEmployeeId,
          status: RosterStatus.CONFIRMED,
        });
      } else {
        // Simple takeover
        await this.rosterRepo.update(swap.requesterRosterId, {
          employeeId: swap.targetEmployeeId,
          originalEmployeeId: swap.requesterId,
          status: RosterStatus.CONFIRMED,
        });
      }
    } else {
      swap.status = SwapRequestStatus.REJECTED;
      if (dto.rejectionReason) swap.rejectionReason = dto.rejectionReason;
      await this.rosterRepo.update(swap.requesterRosterId, { status: RosterStatus.SCHEDULED });
    }

    return this.swapRepo.save(swap);
  }

  async getSwapRequests(facilityId: string, status?: SwapRequestStatus, tenantId?: string): Promise<ShiftSwapRequest[]> {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;

    return this.swapRepo.find({
      where,
      relations: ['requester', 'targetEmployee', 'requesterRoster', 'requesterRoster.shiftDefinition', 'approvedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  // ============ ROSTER COVERAGE ============

  async getShiftCoverage(facilityId: string, date: string, tenantId?: string): Promise<any[]> {
    const shifts = await this.getShiftDefinitions(facilityId, undefined, tenantId);
    const rosters = await this.getRoster(facilityId, date, date, undefined, tenantId);

    return shifts.map(shift => {
      const assigned = rosters.filter(r => r.shiftDefinitionId === shift.id);
      const confirmed = assigned.filter(r => r.status === RosterStatus.CONFIRMED || r.status === RosterStatus.SCHEDULED);

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
        staff: assigned.map(r => ({
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
      ...(tenantId ? { tenantId } : {}),
    });
    return this.jobPostingRepo.save(posting as JobPosting);
  }

  async getJobPostings(facilityId: string, status?: string, tenantId?: string): Promise<JobPosting[]> {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;
    return this.jobPostingRepo.find({
      where,
      relations: ['department'],
      order: { createdAt: 'DESC' },
    });
  }

  async getJobPostingById(id: string, tenantId?: string): Promise<JobPosting> {
    const posting = await this.jobPostingRepo.findOne({
      where: { id , ...(tenantId ? { tenantId } : {}) },
      relations: ['department'],
    });
    if (!posting) throw new NotFoundException('Job posting not found');
    return posting;
  }

  async updateJobPosting(id: string, dto: UpdateJobPostingDto, tenantId?: string): Promise<JobPosting> {
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

  async createJobApplication(dto: CreateJobApplicationDto, tenantId?: string): Promise<JobApplication> {
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
      ...(tenantId ? { tenantId } : {}),
    });
    
    // Increment applications count
    posting.applicationsCount++;
    await this.jobPostingRepo.save(posting);
    
    return this.jobApplicationRepo.save(application);
  }

  async getJobApplications(jobPostingId: string, status?: string, tenantId?: string): Promise<JobApplication[]> {
    const where: any = { jobPostingId };
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;
    return this.jobApplicationRepo.find({
      where,
      relations: ['jobPosting'],
      order: { appliedAt: 'DESC' },
    });
  }

  async updateApplicationStatus(id: string, dto: UpdateApplicationStatusDto, tenantId?: string): Promise<JobApplication> {
    const application = await this.jobApplicationRepo.findOne({ where: { id , ...(tenantId ? { tenantId } : {}) } });
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
        ...(tenantId ? { tenantId } : {}),
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
      ...(tenantId ? { tenantId } : {}),
    });
    return this.appraisalRepo.save(appraisal);
  }

  async getAppraisals(facilityId: string, options?: { employeeId?: string; year?: number; status?: string }, tenantId?: string): Promise<PerformanceAppraisal[]> {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    if (options?.employeeId) where.employeeId = options.employeeId;
    if (options?.year) where.year = options.year;
    if (options?.status) where.status = options.status;

    return this.appraisalRepo.find({
      where,
      relations: ['employee', 'employee.department', 'reviewer'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAppraisalById(id: string, tenantId?: string): Promise<PerformanceAppraisal> {
    const appraisal = await this.appraisalRepo.findOne({
      where: { id , ...(tenantId ? { tenantId } : {}) },
      relations: ['employee', 'employee.department', 'reviewer'],
    });
    if (!appraisal) throw new NotFoundException('Appraisal not found');
    return appraisal;
  }

  async updateAppraisal(id: string, dto: UpdateAppraisalDto, tenantId?: string): Promise<PerformanceAppraisal> {
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
    ].filter(r => r !== null && r !== undefined);
    
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

  async submitManagerReview(id: string, dto: any, tenantId?: string): Promise<PerformanceAppraisal> {
    const appraisal = await this.getAppraisalById(id, tenantId);
    if (![AppraisalStatus.SELF_REVIEW, AppraisalStatus.DRAFT].includes(appraisal.status)) {
      throw new BadRequestException('Appraisal must be in self_review or draft status for manager review');
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
      dto.jobKnowledgeRating, dto.workQualityRating, dto.attendanceRating,
      dto.communicationRating, dto.teamworkRating, dto.initiativeRating,
    ].filter(r => r !== null && r !== undefined);
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
      where: { employeeId: userId, ...(tenantId ? { tenantId } : {}) },
      relations: ['employee', 'employee.department', 'reviewer'],
      order: { year: 'DESC', createdAt: 'DESC' },
    });
  }

  async getEmployeeAppraisalHistory(employeeId: string, tenantId?: string): Promise<PerformanceAppraisal[]> {
    return this.appraisalRepo.find({
      where: { employeeId, ...(tenantId ? { tenantId } : {}) },
      relations: ['employee', 'reviewer'],
      order: { year: 'DESC', createdAt: 'DESC' },
    });
  }

  async bulkCreateAppraisals(dto: any, tenantId?: string): Promise<{ created: number; skipped: number }> {
    // Get all active users in the department
    const departmentUsers = await this.userRepo.find({
      where: {
        department: { name: dto.department },
        status: 'active',
        deletedAt: IsNull(),
        ...(tenantId ? { tenantId } : {}),
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
          ...(tenantId ? { tenantId } : {}),
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
        ...(tenantId ? { tenantId } : {}),
      });
      await this.appraisalRepo.save(appraisal);
      created++;
    }

    return { created, skipped };
  }

  // ============ TRAINING PROGRAMS ============

  async createTrainingProgram(dto: CreateTrainingProgramDto, tenantId?: string): Promise<TrainingProgram> {
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
      ...(tenantId ? { tenantId } : {}),
    });
    return this.trainingProgramRepo.save(program);
  }

  async getTrainingPrograms(facilityId: string, status?: string, tenantId?: string): Promise<TrainingProgram[]> {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;
    return this.trainingProgramRepo.find({
      where,
      order: { startDate: 'DESC' },
    });
  }

  async getTrainingProgramById(id: string, tenantId?: string): Promise<TrainingProgram> {
    const program = await this.trainingProgramRepo.findOne({ where: { id , ...(tenantId ? { tenantId } : {}) } });
    if (!program) throw new NotFoundException('Training program not found');
    return program;
  }

  async updateTrainingProgram(id: string, dto: UpdateTrainingProgramDto, tenantId?: string): Promise<TrainingProgram> {
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
      where: { trainingProgramId: dto.trainingProgramId, employeeId: dto.employeeId , ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) {
      throw new BadRequestException('Employee is already enrolled in this program');
    }

    // Check max participants
    if (program.maxParticipants) {
      const enrolledCount = await this.trainingEnrollmentRepo.count({
        where: { trainingProgramId: dto.trainingProgramId , ...(tenantId ? { tenantId } : {}) },
      });
      if (enrolledCount >= program.maxParticipants) {
        throw new BadRequestException('Training program is at full capacity');
      }
    }

    const enrollment = this.trainingEnrollmentRepo.create({
      trainingProgramId: dto.trainingProgramId,
      employeeId: dto.employeeId,
      status: EnrollmentStatus.ENROLLED,
      ...(tenantId ? { tenantId } : {}),
    });
    return this.trainingEnrollmentRepo.save(enrollment);
  }

  async getTrainingEnrollments(trainingProgramId: string, tenantId?: string): Promise<TrainingEnrollment[]> {
    return this.trainingEnrollmentRepo.find({
      where: { trainingProgramId , ...(tenantId ? { tenantId } : {}) },
      relations: ['employee'],
      order: { enrolledAt: 'DESC' },
    });
  }

  async getEmployeeTrainings(employeeId: string, tenantId?: string): Promise<TrainingEnrollment[]> {
    return this.trainingEnrollmentRepo.find({
      where: { employeeId , ...(tenantId ? { tenantId } : {}) },
      relations: ['trainingProgram'],
      order: { enrolledAt: 'DESC' },
    });
  }

  async updateEnrollment(id: string, dto: UpdateEnrollmentDto, tenantId?: string): Promise<TrainingEnrollment> {
    const enrollment = await this.trainingEnrollmentRepo.findOne({ where: { id , ...(tenantId ? { tenantId } : {}) } });
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
      this.jobPostingRepo.count({ where: { facilityId, status: JobStatus.OPEN , ...(tenantId ? { tenantId } : {}) } }),
      this.jobApplicationRepo.count({
        where: { jobPosting: { facilityId , ...(tenantId ? { tenantId } : {}) } },
      }),
      this.jobApplicationRepo.count({
        where: { jobPosting: { facilityId , ...(tenantId ? { tenantId } : {}) }, status: ApplicationStatus.SHORTLISTED },
      }),
      this.jobApplicationRepo.count({
        where: { jobPosting: { facilityId , ...(tenantId ? { tenantId } : {}) }, status: ApplicationStatus.HIRED },
      }),
    ]);

    return { openPositions, totalApplications, shortlisted, hired };
  }

  // ============ TRAINING DASHBOARD ============

  async getTrainingStats(facilityId: string, tenantId?: string) {
    const [totalPrograms, activePrograms, totalEnrollments, completed] = await Promise.all([
      this.trainingProgramRepo.count({ where: { facilityId , ...(tenantId ? { tenantId } : {}) } }),
      this.trainingProgramRepo.count({ where: { facilityId, status: TrainingStatus.IN_PROGRESS , ...(tenantId ? { tenantId } : {}) } }),
      this.trainingEnrollmentRepo.count({
        where: { trainingProgram: { facilityId , ...(tenantId ? { tenantId } : {}) } },
      }),
      this.trainingEnrollmentRepo.count({
        where: { trainingProgram: { facilityId , ...(tenantId ? { tenantId } : {}) }, status: EnrollmentStatus.COMPLETED },
      }),
    ]);

    return { totalPrograms, activePrograms, totalEnrollments, completed };
  }

  // ============ APPRAISALS DASHBOARD ============

  async getAppraisalStats(facilityId: string, year: number, tenantId?: string) {
    const [total, pending, completed] = await Promise.all([
      this.appraisalRepo.count({ where: { facilityId, year , ...(tenantId ? { tenantId } : {}) } }),
      this.appraisalRepo.count({ where: { facilityId, year, status: In([AppraisalStatus.DRAFT, AppraisalStatus.SELF_REVIEW, AppraisalStatus.MANAGER_REVIEW]) , ...(tenantId ? { tenantId } : {}) } }),
      this.appraisalRepo.count({ where: { facilityId, year, status: In([AppraisalStatus.COMPLETED, AppraisalStatus.ACKNOWLEDGED]) , ...(tenantId ? { tenantId } : {}) } }),
    ]);

    // Get average rating
    const avgQb = this.appraisalRepo
      .createQueryBuilder('a')
      .select('AVG(a.overallRating)', 'avg')
      .where('a.facilityId = :facilityId AND a.year = :year AND a.overallRating IS NOT NULL', { facilityId, year });
    if (tenantId) avgQb.andWhere('a.tenant_id = :tenantId', { tenantId });
    const avgResult = await avgQb.getRawOne();

    return { 
      total, 
      pending, 
      completed, 
      averageRating: avgResult?.avg ? parseFloat(avgResult.avg).toFixed(2) : null 
    };
  }

  // ============ STAFF DOCUMENTS ============

  async getStaffDocuments(userId: string, tenantId?: string) {
    return this.documentRepo.find({
      where: { userId , ...(tenantId ? { tenantId } : {}) },
      order: { createdAt: 'DESC' },
    });
  }

  async getDocumentById(documentId: string, tenantId?: string) {
    return this.documentRepo.findOne({ where: { id: documentId , ...(tenantId ? { tenantId } : {}) } });
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
  
    tenantId?: string) {
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
      ...(tenantId ? { tenantId } : {}),
    } as any);

    return this.documentRepo.save(document);
  }

  async verifyDocument(documentId: string, verifiedBy: string, status: DocumentStatus, tenantId?: string) {
    const document = await this.documentRepo.findOne({ where: { id: documentId , ...(tenantId ? { tenantId } : {}) } });
    if (!document) throw new NotFoundException('Document not found');

    document.status = status;
    document.verifiedBy = verifiedBy;
    document.verifiedAt = new Date();

    return this.documentRepo.save(document);
  }

  async deleteDocument(documentId: string, tenantId?: string) {
    const document = await this.documentRepo.findOne({ where: { id: documentId , ...(tenantId ? { tenantId } : {}) } });
    if (!document) throw new NotFoundException('Document not found');
    
    // Soft delete
    await this.documentRepo.softRemove(document);
    return { message: 'Document deleted' };
  }

  async getDocumentStats(tenantId?: string) {
    const [total, valid, expiringSoon, expired] = await Promise.all([
      this.documentRepo.count({ where: { deletedAt: IsNull() , ...(tenantId ? { tenantId } : {}) } }),
      this.documentRepo.count({ where: { status: DocumentStatus.VERIFIED, deletedAt: IsNull() , ...(tenantId ? { tenantId } : {}) } }),
      this.documentRepo.count({
        where: {
          status: DocumentStatus.VERIFIED,
          expiryDate: Between(new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
          deletedAt: IsNull(),
          ...(tenantId ? { tenantId } : {}),
        },
      }),
      this.documentRepo.count({
        where: {
          expiryDate: LessThanOrEqual(new Date()),
          deletedAt: IsNull(),
          ...(tenantId ? { tenantId } : {}),
        },
      }),
    ]);

    return { total, valid, expiringSoon, expired };
  }

  async getLeaveBalances(facilityId?: string, tenantId?: string): Promise<any[]> {
    const where: any = { status: Not(EmploymentStatus.TERMINATED) };
    if (tenantId) where.tenantId = tenantId;
    if (facilityId) where.facilityId = facilityId;
    const employees = await this.employeeRepo.find({ where, take: 200 });

    // For each employee, sum approved leave taken this year
    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const results = await Promise.all(employees.map(async (emp) => {
      const approved = await this.leaveRepo.find({
        where: {
          employeeId: emp.id,
          status: LeaveStatus.APPROVED,
          startDate: Between(new Date(yearStart), new Date(yearEnd)) as any,
          ...(tenantId ? { tenantId } : {}),
        },
      });
      const usedAnnual = approved
        .filter(l => l.leaveType === LeaveType.ANNUAL)
        .reduce((s, l) => s + l.daysRequested, 0);
      const usedSick = approved
        .filter(l => l.leaveType === LeaveType.SICK)
        .reduce((s, l) => s + l.daysRequested, 0);
      const usedCasual = approved
        .filter(l => l.leaveType === LeaveType.COMPASSIONATE)
        .reduce((s, l) => s + l.daysRequested, 0);

      const annualEntitled = emp.annualLeaveBalance ?? 21;
      const sickEntitled = emp.sickLeaveBalance ?? 14;

      return {
        staffId: emp.employeeNumber || emp.id,
        staffName: `${emp.firstName} ${emp.lastName}`.trim(),
        department: emp.department ?? '',
        annual: { entitled: annualEntitled, used: usedAnnual, balance: annualEntitled - usedAnnual },
        sick: { entitled: sickEntitled, used: usedSick, balance: sickEntitled - usedSick },
        casual: { entitled: 7, used: usedCasual, balance: 7 - usedCasual },
      };
    }));
    return results;
  }
}
