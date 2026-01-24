import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import { Employee, EmploymentStatus } from '../../database/entities/employee.entity';
import { AttendanceRecord } from '../../database/entities/attendance.entity';
import { LeaveRequest, LeaveStatus, LeaveType } from '../../database/entities/leave-request.entity';
import { PayrollRun, PayrollStatus } from '../../database/entities/payroll-run.entity';
import { Payslip } from '../../database/entities/payslip.entity';
import { ShiftDefinition, ShiftType } from '../../database/entities/shift-definition.entity';
import { StaffRoster, RosterStatus } from '../../database/entities/staff-roster.entity';
import { ShiftSwapRequest, SwapRequestStatus } from '../../database/entities/shift-swap-request.entity';
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
} from './dto/hr.dto';

@Injectable()
export class HrService {
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
  ) {}

  // ============ EMPLOYEE MANAGEMENT ============

  private async generateEmployeeNumber(facilityId: string): Promise<string> {
    const count = await this.employeeRepo.count({ where: { facilityId } });
    return `EMP${String(count + 1).padStart(5, '0')}`;
  }

  async createEmployee(dto: CreateEmployeeDto): Promise<Employee> {
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
    });

    return this.employeeRepo.save(employee);
  }

  async getEmployees(facilityId: string, options: { status?: EmploymentStatus; department?: string; limit?: number; offset?: number }) {
    const where: any = { facilityId };
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

  async getEmployeeById(id: string): Promise<Employee> {
    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: ['facility', 'user'],
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.getEmployeeById(id);
    Object.assign(employee, dto);
    return this.employeeRepo.save(employee);
  }

  async terminateEmployee(id: string, reason: string): Promise<Employee> {
    const employee = await this.getEmployeeById(id);
    employee.status = EmploymentStatus.TERMINATED;
    employee.terminationDate = new Date();
    employee.terminationReason = reason;
    return this.employeeRepo.save(employee);
  }

  // ============ ATTENDANCE ============

  async recordAttendance(dto: RecordAttendanceDto, facilityId: string): Promise<AttendanceRecord> {
    // Check if record exists for this date
    const existing = await this.attendanceRepo.findOne({
      where: { employeeId: dto.employeeId, date: new Date(dto.date) },
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
    });

    return this.attendanceRepo.save(record);
  }

  async clockIn(employeeId: string, facilityId: string): Promise<AttendanceRecord> {
    const today = new Date();
    const time = today.toTimeString().slice(0, 5);

    return this.recordAttendance({
      employeeId,
      date: today.toISOString().slice(0, 10),
      clockIn: time,
      status: 'present',
    }, facilityId);
  }

  async clockOut(employeeId: string, facilityId: string): Promise<AttendanceRecord> {
    const today = new Date();
    const time = today.toTimeString().slice(0, 5);

    return this.recordAttendance({
      employeeId,
      date: today.toISOString().slice(0, 10),
      clockOut: time,
    }, facilityId);
  }

  private calculateHoursWorked(clockIn: string, clockOut: string): number {
    const [inH, inM] = clockIn.split(':').map(Number);
    const [outH, outM] = clockOut.split(':').map(Number);
    const inMinutes = inH * 60 + inM;
    const outMinutes = outH * 60 + outM;
    return Math.round((outMinutes - inMinutes) / 60 * 100) / 100;
  }

  async getAttendance(facilityId: string, options: { employeeId?: string; startDate?: string; endDate?: string }) {
    const where: any = { facilityId };
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

  async requestLeave(dto: RequestLeaveDto): Promise<LeaveRequest> {
    const employee = await this.getEmployeeById(dto.employeeId);

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
    });

    return this.leaveRepo.save(leave);
  }

  async approveLeave(id: string, dto: ApproveLeaveDto, userId: string): Promise<LeaveRequest> {
    const leave = await this.leaveRepo.findOne({
      where: { id },
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

  async getLeaveRequests(facilityId: string, options: { status?: LeaveStatus; employeeId?: string }) {
    const qb = this.leaveRepo.createQueryBuilder('leave')
      .leftJoinAndSelect('leave.employee', 'employee')
      .where('employee.facilityId = :facilityId', { facilityId });

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

  async createPayrollRun(dto: CreatePayrollRunDto, userId: string): Promise<PayrollRun> {
    // Check if payroll already exists for this month
    const existing = await this.payrollRunRepo.findOne({
      where: { facilityId: dto.facilityId, month: dto.month, year: dto.year },
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
    });

    return this.payrollRunRepo.save(payroll);
  }

  async processPayroll(id: string): Promise<PayrollRun> {
    const payroll = await this.payrollRunRepo.findOne({ where: { id } });
    if (!payroll) throw new NotFoundException('Payroll run not found');

    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new BadRequestException('Payroll has already been processed');
    }

    payroll.status = PayrollStatus.PROCESSING;
    await this.payrollRunRepo.save(payroll);

    // Get active employees
    const employees = await this.employeeRepo.find({
      where: { facilityId: payroll.facilityId, status: EmploymentStatus.ACTIVE },
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
        daysWorked: 22, // Default working days
        isPaid: false,
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

  async getPayrollRuns(facilityId: string, options: { year?: number; status?: PayrollStatus }) {
    const where: any = { facilityId };
    if (options.year) where.year = options.year;
    if (options.status) where.status = options.status;

    return this.payrollRunRepo.find({
      where,
      order: { year: 'DESC', month: 'DESC' },
    });
  }

  async getPayslips(payrollRunId: string): Promise<Payslip[]> {
    return this.payslipRepo.find({
      where: { payrollRunId },
      relations: ['employee'],
      order: { employee: { lastName: 'ASC' } },
    });
  }

  async getEmployeePayslips(employeeId: string): Promise<Payslip[]> {
    return this.payslipRepo.find({
      where: { employeeId },
      relations: ['payrollRun'],
      order: { createdAt: 'DESC' },
    });
  }

  // ============ DASHBOARD ============

  async getDashboard(facilityId: string) {
    const [
      totalEmployees,
      activeEmployees,
      pendingLeaves,
      todayAttendance,
    ] = await Promise.all([
      this.employeeRepo.count({ where: { facilityId } }),
      this.employeeRepo.count({ where: { facilityId, status: EmploymentStatus.ACTIVE } }),
      this.leaveRepo.count({
        where: {
          status: LeaveStatus.PENDING,
          employee: { facilityId },
        },
      }),
      this.attendanceRepo.count({
        where: {
          facilityId,
          date: new Date(),
          status: 'present',
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

  async createShiftDefinition(dto: CreateShiftDefinitionDto): Promise<ShiftDefinition> {
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
    });

    return this.shiftDefRepo.save(shift);
  }

  async getShiftDefinitions(facilityId: string, departmentId?: string): Promise<ShiftDefinition[]> {
    const where: any = { facilityId, isActive: true };
    if (departmentId) where.departmentId = departmentId;

    return this.shiftDefRepo.find({
      where,
      relations: ['department'],
      order: { startTime: 'ASC' },
    });
  }

  async updateShiftDefinition(id: string, updates: Partial<CreateShiftDefinitionDto>): Promise<ShiftDefinition> {
    const shift = await this.shiftDefRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Shift definition not found');

    Object.assign(shift, updates);
    return this.shiftDefRepo.save(shift);
  }

  async deleteShiftDefinition(id: string): Promise<void> {
    const shift = await this.shiftDefRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Shift definition not found');
    shift.isActive = false;
    await this.shiftDefRepo.save(shift);
  }

  // ============ ROSTER MANAGEMENT ============

  async createRoster(dto: CreateRosterDto, userId: string): Promise<StaffRoster> {
    // Check for existing roster on same date
    const existing = await this.rosterRepo.findOne({
      where: {
        employeeId: dto.employeeId,
        rosterDate: new Date(dto.rosterDate),
        status: In([RosterStatus.SCHEDULED, RosterStatus.CONFIRMED]),
      },
    });

    if (existing) {
      throw new BadRequestException('Employee already has a shift scheduled for this date');
    }

    // Check shift coverage
    const shift = await this.shiftDefRepo.findOne({ where: { id: dto.shiftDefinitionId } });
    if (!shift) throw new NotFoundException('Shift definition not found');

    const existingCount = await this.rosterRepo.count({
      where: {
        shiftDefinitionId: dto.shiftDefinitionId,
        rosterDate: new Date(dto.rosterDate),
        status: In([RosterStatus.SCHEDULED, RosterStatus.CONFIRMED]),
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
    });

    return this.rosterRepo.save(roster);
  }

  async generateWeeklyRoster(
    facilityId: string,
    startDate: string,
    employeeIds: string[],
    shiftPattern: { dayOfWeek: number; shiftDefinitionId: string }[],
    userId: string,
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
            }, userId);
            rosters.push(roster);
          } catch (error) {
            // Skip if conflict
            console.warn(`Skipped roster for ${employeeId} on ${currentDate}: ${error.message}`);
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
  }): Promise<StaffRoster[]> {
    const qb = this.rosterRepo.createQueryBuilder('roster')
      .leftJoinAndSelect('roster.employee', 'employee')
      .leftJoinAndSelect('roster.shiftDefinition', 'shift')
      .where('roster.facilityId = :facilityId', { facilityId })
      .andWhere('roster.rosterDate BETWEEN :start AND :end', {
        start: new Date(startDate),
        end: new Date(endDate),
      });

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

  async updateRosterStatus(id: string, status: RosterStatus, notes?: string): Promise<StaffRoster> {
    const roster = await this.rosterRepo.findOne({ where: { id } });
    if (!roster) throw new NotFoundException('Roster entry not found');

    roster.status = status;
    if (notes) roster.notes = notes;
    if (status === RosterStatus.ABSENT && notes) roster.absenceReason = notes;

    return this.rosterRepo.save(roster);
  }

  async recordActualTimes(id: string, startTime: string, endTime?: string): Promise<StaffRoster> {
    const roster = await this.rosterRepo.findOne({
      where: { id },
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

  async requestShiftSwap(dto: RequestShiftSwapDto): Promise<ShiftSwapRequest> {
    const requesterRoster = await this.rosterRepo.findOne({
      where: { id: dto.requesterRosterId },
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
    });

    // Update requester's roster status
    requesterRoster.status = RosterStatus.SWAP_PENDING;
    await this.rosterRepo.save(requesterRoster);

    return this.swapRepo.save(swap);
  }

  async respondToSwapRequest(id: string, accepted: boolean, userId: string): Promise<ShiftSwapRequest> {
    const swap = await this.swapRepo.findOne({
      where: { id },
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

  async approveSwapRequest(id: string, dto: ApproveSwapDto, userId: string): Promise<ShiftSwapRequest> {
    const swap = await this.swapRepo.findOne({
      where: { id },
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

  async getSwapRequests(facilityId: string, status?: SwapRequestStatus): Promise<ShiftSwapRequest[]> {
    const where: any = { facilityId };
    if (status) where.status = status;

    return this.swapRepo.find({
      where,
      relations: ['requester', 'targetEmployee', 'requesterRoster', 'requesterRoster.shiftDefinition', 'approvedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  // ============ ROSTER COVERAGE ============

  async getShiftCoverage(facilityId: string, date: string): Promise<any[]> {
    const shifts = await this.getShiftDefinitions(facilityId);
    const rosters = await this.getRoster(facilityId, date, date);

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
}
