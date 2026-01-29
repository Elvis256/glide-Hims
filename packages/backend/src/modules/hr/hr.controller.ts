import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { HrService } from './hr.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  RecordAttendanceDto,
  RequestLeaveDto,
  ApproveLeaveDto,
  CreatePayrollRunDto,
} from './dto/hr.dto';
import { EmploymentStatus } from '../../database/entities/employee.entity';
import { LeaveStatus } from '../../database/entities/leave-request.entity';
import { PayrollStatus } from '../../database/entities/payroll-run.entity';

@ApiTags('HR & Payroll')
@ApiBearerAuth()
@Controller('hr')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  // ============ DASHBOARD ============
  @Get('dashboard')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get HR dashboard stats' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getDashboard(@Query('facilityId') facilityId: string) {
    return this.hrService.getDashboard(facilityId);
  }

  // ============ EMPLOYEES ============
  @Post('employees')
  @AuthWithPermissions('employees.create')
  @ApiOperation({ summary: 'Create new employee' })
  async createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.hrService.createEmployee(dto);
  }

  @Get('employees')
  @AuthWithPermissions('employees.read')
  @ApiOperation({ summary: 'Get employees list' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'status', required: false, enum: EmploymentStatus })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async getEmployees(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: EmploymentStatus,
    @Query('department') department?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.hrService.getEmployees(facilityId, { status, department, limit, offset });
  }

  @Get('employees/:id')
  @AuthWithPermissions('employees.read')
  @ApiOperation({ summary: 'Get employee by ID' })
  async getEmployeeById(@Param('id') id: string) {
    return this.hrService.getEmployeeById(id);
  }

  @Patch('employees/:id')
  @AuthWithPermissions('employees.update')
  @ApiOperation({ summary: 'Update employee' })
  async updateEmployee(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.hrService.updateEmployee(id, dto);
  }

  @Post('employees/:id/terminate')
  @AuthWithPermissions('employees.delete')
  @ApiOperation({ summary: 'Terminate employee' })
  async terminateEmployee(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.hrService.terminateEmployee(id, reason);
  }

  // ============ ATTENDANCE ============
  @Post('attendance')
  @AuthWithPermissions('attendance.create')
  @ApiOperation({ summary: 'Record attendance' })
  async recordAttendance(
    @Body() dto: RecordAttendanceDto,
    @Query('facilityId') facilityId: string,
  ) {
    return this.hrService.recordAttendance(dto, facilityId);
  }

  @Post('attendance/clock-in')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Clock in employee' })
  async clockIn(
    @Body('employeeId') employeeId: string,
    @Query('facilityId') facilityId: string,
  ) {
    return this.hrService.clockIn(employeeId, facilityId);
  }

  @Post('attendance/clock-out')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Clock out employee' })
  async clockOut(
    @Body('employeeId') employeeId: string,
    @Query('facilityId') facilityId: string,
  ) {
    return this.hrService.clockOut(employeeId, facilityId);
  }

  @Get('attendance')
  @AuthWithPermissions('attendance.read')
  @ApiOperation({ summary: 'Get attendance records' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getAttendance(
    @Query('facilityId') facilityId: string,
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.hrService.getAttendance(facilityId, { employeeId, startDate, endDate });
  }

  // ============ LEAVE ============
  @Post('leave')
  @AuthWithPermissions('leave.create')
  @ApiOperation({ summary: 'Request leave' })
  async requestLeave(@Body() dto: RequestLeaveDto) {
    return this.hrService.requestLeave(dto);
  }

  @Patch('leave/:id/approve')
  @AuthWithPermissions('leave.approve')
  @ApiOperation({ summary: 'Approve or reject leave' })
  async approveLeave(
    @Param('id') id: string,
    @Body() dto: ApproveLeaveDto,
    @Request() req: any,
  ) {
    return this.hrService.approveLeave(id, dto, req.user.id);
  }

  @Get('leave')
  @AuthWithPermissions('leave.read')
  @ApiOperation({ summary: 'Get leave requests' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'status', required: false, enum: LeaveStatus })
  @ApiQuery({ name: 'employeeId', required: false })
  async getLeaveRequests(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: LeaveStatus,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.hrService.getLeaveRequests(facilityId, { status, employeeId });
  }

  // ============ PAYROLL ============
  @Post('payroll')
  @AuthWithPermissions('payroll.create')
  @ApiOperation({ summary: 'Create payroll run' })
  async createPayrollRun(@Body() dto: CreatePayrollRunDto, @Request() req: any) {
    return this.hrService.createPayrollRun(dto, req.user.id);
  }

  @Post('payroll/:id/process')
  @AuthWithPermissions('payroll.process')
  @ApiOperation({ summary: 'Process payroll' })
  async processPayroll(@Param('id') id: string) {
    return this.hrService.processPayroll(id);
  }

  @Get('payroll')
  @AuthWithPermissions('payroll.read')
  @ApiOperation({ summary: 'Get payroll runs' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PayrollStatus })
  async getPayrollRuns(
    @Query('facilityId') facilityId: string,
    @Query('year') year?: number,
    @Query('status') status?: PayrollStatus,
  ) {
    return this.hrService.getPayrollRuns(facilityId, { year, status });
  }

  @Get('payroll/:id/payslips')
  @AuthWithPermissions('payroll.read')
  @ApiOperation({ summary: 'Get payslips for payroll run' })
  async getPayslips(@Param('id') id: string) {
    return this.hrService.getPayslips(id);
  }

  @Get('employees/:id/payslips')
  @AuthWithPermissions('payroll.read')
  @ApiOperation({ summary: 'Get employee payslips' })
  async getEmployeePayslips(@Param('id') id: string) {
    return this.hrService.getEmployeePayslips(id);
  }
}
