import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  Res,
  Header,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { HrService } from './hr.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import * as path from 'path';
import * as fs from 'fs';
import { validateFileContent } from '../../common/file-validation';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  RecordAttendanceDto,
  RequestLeaveDto,
  ApproveLeaveDto,
  CreatePayrollRunDto,
  CreateJobPostingDto,
  UpdateJobPostingDto,
  CreateJobApplicationDto,
  UpdateApplicationStatusDto,
  CreateAppraisalDto,
  UpdateAppraisalDto,
  SubmitSelfReviewDto,
  SubmitManagerReviewDto,
  BulkCreateAppraisalDto,
  CreateTrainingProgramDto,
  UpdateTrainingProgramDto,
  EnrollEmployeeDto,
  UpdateEnrollmentDto,
  CreateShiftDefinitionDto,
  CreateRosterDto,
  RequestShiftSwapDto,
  ApproveSwapDto,
  CreateDisciplinaryDto,
  UpdateDisciplinaryDto,
  CreateSalaryChangeDto,
  CreateOnboardingTaskDto,
  CreateOnboardingFromTemplateDto,
  UpdateOnboardingTaskDto,
  GenerateRosterDto,
  DeactivateStaffDto,
  OffboardStaffDto,
  CreateStaffDto,
  UpdateStaffDto,
  LeaveTypeConfigDto,
  HolidayConfigDto,
} from './dto/hr.dto';
import { EmploymentStatus } from '../../database/entities/employee.entity';
import { LeaveStatus } from '../../database/entities/leave-request.entity';
import { PayrollStatus } from '../../database/entities/payroll-run.entity';
import { DocumentType, DocumentStatus } from '../../database/entities/staff-document.entity';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('HR & Payroll')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('hr')
@Controller('hr')
export class HrController {
  constructor(
    private readonly hrService: HrService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  // ============ DASHBOARD ============
  @Get('dashboard')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get HR dashboard stats' })
  @ApiQuery({ name: 'facilityId', required: false })
  async getDashboard(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    const scopedFacilityId = this.scopeFacilityId(req, facilityId);
    return this.hrService.getStaffDashboard(scopedFacilityId, req?.user?.tenantId);
  }

  // ============ STAFF (Users as Staff) ============
  @Get('staff')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get staff list (users)' })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async getStaff(
    @Query('facilityId') facilityId?: string,
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Request() req?: any,
  ) {
    return this.hrService.getStaff(
      this.scopeFacilityId(req, facilityId),
      { status, departmentId, limit, offset },
      req?.user?.tenantId,
    );
  }

  private scopeFacilityId(req: any, requested?: string): string | undefined {
    const u = req?.user;
    if (!u) return requested;
    if (u.isSystemAdmin) return requested;
    const allowed = u.allFacilityIds && u.allFacilityIds.length > 0 ? u.allFacilityIds : (u.facilityId ? [u.facilityId] : []);
    if (allowed.length === 0) return requested;
    if (requested && allowed.includes(requested)) return requested;
    return allowed[0];
  }

  @Get('staff/:id')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get staff member by ID' })
  async getStaffById(@Param('id') id: string, @Request() req: any) {
    return this.hrService.getStaffById(id, req.user?.tenantId);
  }

  @Patch('staff/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update staff member HR details' })
  async updateStaff(@Param('id') id: string, @Body() dto: UpdateStaffDto, @Request() req: any) {
    return this.hrService.updateStaff(id, dto, req.user?.tenantId);
  }

  @Post('staff')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create new staff member (user with HR profile)' })
  async createStaff(@Body() dto: CreateStaffDto, @Request() req: any) {
    return this.hrService.createStaff(dto as any, req.user?.tenantId);
  }

  @Post('staff/:id/deactivate')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Deactivate a staff member' })
  async deactivateStaff(
    @Param('id') id: string,
    @Body() body: DeactivateStaffDto,
    @Request() req: any,
  ) {
    return this.hrService.deactivateStaff(id, body.reason, req.user?.tenantId);
  }

  @Post('staff/:id/reactivate')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Reactivate a staff member' })
  async reactivateStaff(@Param('id') id: string, @Request() req: any) {
    return this.hrService.reactivateStaff(id, req.user?.tenantId);
  }

  @Post('staff/:id/offboard')
  @AuthWithPermissions('hr.update')
  @ApiOperation({
    summary: 'Offboard a staff member (deactivate, revoke access, record termination)',
  })
  async offboardStaff(@Param('id') id: string, @Body() dto: OffboardStaffDto, @Request() req: any) {
    return this.hrService.offboardEmployee(
      id,
      dto,
      req.user?.sub || req.user?.id,
      req.user?.tenantId,
    );
  }

  @Get('designations/stats')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get designation/job title statistics' })
  async getDesignationStats(@Request() req: any) {
    return this.hrService.getDesignationStats(req.user?.tenantId);
  }

  @Get('staff/category/:category')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get staff by category (consultant, specialist, etc.)' })
  async getStaffByCategory(@Param('category') category: string, @Request() req: any) {
    return this.hrService.getStaffByCategory(category, req.user?.tenantId);
  }

  // ============ EMPLOYEES (Legacy) ============
  @Post('employees')
  @AuthWithPermissions('employees.create')
  @Header('Deprecation', 'true')
  @Header('Sunset', '2026-06-01')
  @Header('Link', '</api/v1/hr/staff>; rel="successor-version"')
  @ApiOperation({
    deprecated: true,
    summary: 'Create new employee (deprecated — use POST /hr/staff)',
  })
  async createEmployee(@Body() dto: CreateEmployeeDto, @Request() req: any) {
    return this.hrService.createEmployee(dto, req.user?.tenantId);
  }

  @Get('employees')
  @AuthWithPermissions('employees.read')
  @Header('Deprecation', 'true')
  @Header('Sunset', '2026-06-01')
  @Header('Link', '</api/v1/hr/staff>; rel="successor-version"')
  @ApiOperation({
    deprecated: true,
    summary: 'Get employees list (deprecated — use GET /hr/staff)',
  })
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
    @Request() req?: any,
  ) {
    return this.hrService.getEmployees(
      facilityId,
      { status, department, limit, offset },
      req?.user?.tenantId,
    );
  }

  @Get('employees/:id')
  @AuthWithPermissions('employees.read')
  @Header('Deprecation', 'true')
  @Header('Sunset', '2026-06-01')
  @Header('Link', '</api/v1/hr/staff>; rel="successor-version"')
  @ApiOperation({
    deprecated: true,
    summary: 'Get employee by ID (deprecated — use GET /hr/staff/:id)',
  })
  async getEmployeeById(@Param('id') id: string, @Request() req: any) {
    return this.hrService.getEmployeeById(id, req.user?.tenantId);
  }

  @Patch('employees/:id')
  @AuthWithPermissions('employees.update')
  @Header('Deprecation', 'true')
  @Header('Sunset', '2026-06-01')
  @Header('Link', '</api/v1/hr/staff>; rel="successor-version"')
  @ApiOperation({
    deprecated: true,
    summary: 'Update employee (deprecated — use PATCH /hr/staff/:id)',
  })
  async updateEmployee(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @Request() req: any,
  ) {
    return this.hrService.updateEmployee(id, dto, req.user?.tenantId);
  }

  @Post('employees/:id/terminate')
  @AuthWithPermissions('employees.delete')
  @Header('Deprecation', 'true')
  @Header('Sunset', '2026-06-01')
  @Header('Link', '</api/v1/hr/staff>; rel="successor-version"')
  @ApiOperation({
    deprecated: true,
    summary: 'Terminate employee (deprecated — use POST /hr/staff/:id/offboard)',
  })
  async terminateEmployee(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.hrService.terminateEmployee(id, reason, req.user?.tenantId);
  }

  // ============ ATTENDANCE ============
  @Post('attendance')
  @AuthWithPermissions('attendance.create')
  @ApiOperation({ summary: 'Record attendance' })
  async recordAttendance(
    @Body() dto: RecordAttendanceDto,
    @Query('facilityId') facilityId: string,
    @Request() req: any,
  ) {
    return this.hrService.recordAttendance(dto, facilityId, req.user?.tenantId);
  }

  @Post('attendance/clock-in')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Clock in employee' })
  async clockIn(
    @Body('employeeId') employeeId: string,
    @Query('facilityId') facilityId: string,
    @Request() req: any,
  ) {
    return this.hrService.clockIn(employeeId, facilityId, req.user?.tenantId);
  }

  @Post('attendance/clock-out')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Clock out employee' })
  async clockOut(
    @Body('employeeId') employeeId: string,
    @Query('facilityId') facilityId: string,
    @Request() req: any,
  ) {
    return this.hrService.clockOut(employeeId, facilityId, req.user?.tenantId);
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
    @Request() req?: any,
  ) {
    return this.hrService.getAttendance(
      facilityId,
      { employeeId, startDate, endDate },
      req?.user?.tenantId,
    );
  }

  // ============ LEAVE ============
  @Post('leave')
  @AuthWithPermissions('leave.create')
  @ApiOperation({ summary: 'Request leave' })
  async requestLeave(@Body() dto: RequestLeaveDto, @Request() req: any) {
    return this.hrService.requestLeave(dto, req.user?.tenantId);
  }

  @Patch('leave/:id/approve')
  @AuthWithPermissions('leave.approve')
  @ApiOperation({ summary: 'Approve or reject leave' })
  async approveLeave(@Param('id') id: string, @Body() dto: ApproveLeaveDto, @Request() req: any) {
    return this.hrService.approveLeave(id, dto, req.user.id, req.user?.tenantId);
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
    @Request() req?: any,
  ) {
    return this.hrService.getLeaveRequests(facilityId, { status, employeeId }, req?.user?.tenantId);
  }

  // ============ PAYROLL ============
  @Post('payroll')
  @AuthWithPermissions('payroll.create')
  @ApiOperation({ summary: 'Create payroll run' })
  async createPayrollRun(@Body() dto: CreatePayrollRunDto, @Request() req: any) {
    return this.hrService.createPayrollRun(dto, req.user.id, req.user?.tenantId);
  }

  // ============ PAYROLL REPORTS ============

  @Get('payroll/tax-report/:year')
  @AuthWithPermissions('payroll.read')
  @ApiOperation({ summary: 'Get annual tax report (PAYE/NSSF)' })
  @ApiQuery({ name: 'facilityId', required: false })
  getTaxReport(
    @Param('year') year: string,
    @Query('facilityId') facilityId?: string,
    @Request() req?: any,
  ) {
    return this.hrService.getTaxReport(parseInt(year), facilityId, req?.user?.tenantId);
  }

  @Get('payroll/:id/report')
  @AuthWithPermissions('payroll.read')
  @ApiOperation({ summary: 'Get detailed payroll report' })
  getPayrollReport(@Param('id') id: string, @Request() req: any) {
    return this.hrService.getPayrollReport(id, req.user?.tenantId);
  }

  @Post('payroll/:id/process')
  @AuthWithPermissions('payroll.process')
  @ApiOperation({ summary: 'Process payroll' })
  async processPayroll(@Param('id') id: string, @Request() req: any) {
    return this.hrService.processPayroll(id, req.user?.tenantId);
  }

  @Post('payroll/:id/reset')
  @AuthWithPermissions('payroll.process')
  @ApiOperation({ summary: 'Reset payroll run to draft' })
  async resetPayrollRun(@Param('id') id: string, @Request() req: any) {
    return this.hrService.resetPayrollRun(id, req.user?.tenantId);
  }

  @Post('payroll/:id/approve')
  @AuthWithPermissions('payroll.process')
  @ApiOperation({ summary: 'Approve payroll run (Draft → Approved)' })
  async approvePayrollRun(@Param('id') id: string, @Request() req: any) {
    return this.hrService.approvePayrollRun(id, req.user?.id, req.user?.tenantId);
  }

  @Post('payroll/:id/mark-paid')
  @AuthWithPermissions('payroll.process')
  @ApiOperation({ summary: 'Mark payroll run as paid (Completed → Paid)' })
  async markPayrollPaid(@Param('id') id: string, @Request() req: any) {
    return this.hrService.markPayrollPaid(id, req.user?.tenantId);
  }

  @Get('payroll/:id/export/paye')
  @AuthWithPermissions('payroll.read')
  @ApiOperation({ summary: 'Export PAYE CSV' })
  async exportPaye(@Param('id') id: string, @Request() req: any, @Res() res: any) {
    const csv = await this.hrService.exportPayrollPaye(id, req.user?.tenantId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="paye-${id}.csv"`);
    res.send(csv);
  }

  @Get('payroll/:id/export/nssf')
  @AuthWithPermissions('payroll.read')
  @ApiOperation({ summary: 'Export NSSF CSV' })
  async exportNssf(@Param('id') id: string, @Request() req: any, @Res() res: any) {
    const csv = await this.hrService.exportPayrollNssf(id, req.user?.tenantId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="nssf-${id}.csv"`);
    res.send(csv);
  }

  @Get('payroll/:id/export/bank')
  @AuthWithPermissions('payroll.read')
  @ApiOperation({ summary: 'Export bank transfer file CSV' })
  async exportBank(@Param('id') id: string, @Request() req: any, @Res() res: any) {
    const csv = await this.hrService.exportPayrollBank(id, req.user?.tenantId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bank-${id}.csv"`);
    res.send(csv);
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
    @Request() req?: any,
  ) {
    return this.hrService.getPayrollRuns(facilityId, { year, status }, req?.user?.tenantId);
  }

  @Get('payroll/:id/payslips')
  @AuthWithPermissions('payroll.read')
  @ApiOperation({ summary: 'Get payslips for payroll run' })
  async getPayslips(@Param('id') id: string, @Request() req: any) {
    return this.hrService.getPayslips(id, req.user?.tenantId);
  }

  @Get('employees/:id/payslips')
  @AuthWithPermissions('payroll.read')
  @ApiOperation({ summary: 'Get employee payslips' })
  async getEmployeePayslips(@Param('id') id: string, @Request() req: any) {
    return this.hrService.getEmployeePayslips(id, req.user?.tenantId);
  }

  @Get('my-payslips')
  @AuthWithPermissions() // Any authenticated user can view their own payslips
  @ApiOperation({ summary: 'Get current user payslips' })
  @ApiQuery({ name: 'year', required: false })
  async getMyPayslips(@Request() req: any, @Query('year') year?: number) {
    return this.hrService.getMyPayslips(req.user.id, year, req.user?.tenantId);
  }

  // ============ RECRUITMENT - JOB POSTINGS ============
  @Post('recruitment/jobs')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create job posting' })
  async createJobPosting(@Body() dto: CreateJobPostingDto, @Request() req: any) {
    return this.hrService.createJobPosting(dto, req.user?.tenantId);
  }

  @Get('recruitment/jobs')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get job postings' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'status', required: false })
  async getJobPostings(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    return this.hrService.getJobPostings(facilityId, status, req?.user?.tenantId);
  }

  @Get('recruitment/jobs/:id')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get job posting by ID' })
  async getJobPostingById(@Param('id') id: string, @Request() req: any) {
    return this.hrService.getJobPostingById(id, req.user?.tenantId);
  }

  @Patch('recruitment/jobs/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update job posting' })
  async updateJobPosting(
    @Param('id') id: string,
    @Body() dto: UpdateJobPostingDto,
    @Request() req: any,
  ) {
    return this.hrService.updateJobPosting(id, dto, req.user?.tenantId);
  }

  @Delete('recruitment/jobs/:id')
  @AuthWithPermissions('hr.delete')
  @ApiOperation({ summary: 'Delete job posting' })
  async deleteJobPosting(@Param('id') id: string, @Request() req: any) {
    return this.hrService.deleteJobPosting(id, req.user?.tenantId);
  }

  @Get('recruitment/stats')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get recruitment stats' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getRecruitmentStats(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.hrService.getRecruitmentStats(facilityId, req.user?.tenantId);
  }

  // ============ RECRUITMENT - APPLICATIONS ============
  @Post('recruitment/applications')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Submit job application' })
  async createJobApplication(@Body() dto: CreateJobApplicationDto, @Request() req: any) {
    return this.hrService.createJobApplication(dto, req.user?.tenantId);
  }

  @Get('recruitment/jobs/:id/applications')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get applications for job' })
  @ApiQuery({ name: 'status', required: false })
  async getJobApplications(
    @Param('id') jobPostingId: string,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    return this.hrService.getJobApplications(jobPostingId, status, req?.user?.tenantId);
  }

  @Patch('recruitment/applications/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update application status' })
  async updateApplicationStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @Request() req: any,
  ) {
    return this.hrService.updateApplicationStatus(id, dto, req.user?.tenantId);
  }

  // ============ PERFORMANCE APPRAISALS ============
  @Post('appraisals')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create performance appraisal' })
  async createAppraisal(@Body() dto: CreateAppraisalDto, @Request() req: any) {
    return this.hrService.createAppraisal(dto, req.user?.tenantId);
  }

  @Post('appraisals/bulk')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Bulk create appraisals for department' })
  async bulkCreateAppraisals(@Body() dto: BulkCreateAppraisalDto, @Request() req: any) {
    return this.hrService.bulkCreateAppraisals(dto, req.user?.tenantId);
  }

  @Get('appraisals/stats')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get appraisal stats' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'year', required: true })
  async getAppraisalStats(
    @Query('facilityId') facilityId: string,
    @Query('year') year: number,
    @Request() req?: any,
  ) {
    return this.hrService.getAppraisalStats(facilityId, year, req?.user?.tenantId);
  }

  @Get('appraisals/employee/:employeeId/history')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get employee performance history' })
  async getEmployeeHistory(@Param('employeeId') employeeId: string, @Request() req: any) {
    return this.hrService.getEmployeeAppraisalHistory(employeeId, req.user?.tenantId);
  }

  @Get('my-appraisals')
  @ApiOperation({ summary: 'Get current user appraisals' })
  async getMyAppraisals(@Request() req: any) {
    return this.hrService.getMyAppraisals(req.user?.id || req.user?.userId, req.user?.tenantId);
  }

  @Get('appraisals')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get appraisals' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'status', required: false })
  async getAppraisals(
    @Query('facilityId') facilityId: string,
    @Query('employeeId') employeeId?: string,
    @Query('year') year?: number,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    return this.hrService.getAppraisals(
      facilityId,
      { employeeId, year, status },
      req?.user?.tenantId,
    );
  }

  @Get('appraisals/:id')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get appraisal by ID' })
  async getAppraisalById(@Param('id') id: string, @Request() req: any) {
    return this.hrService.getAppraisalById(id);
  }

  @Patch('appraisals/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update appraisal' })
  async updateAppraisal(
    @Param('id') id: string,
    @Body() dto: UpdateAppraisalDto,
    @Request() req: any,
  ) {
    return this.hrService.updateAppraisal(id, dto);
  }

  @Delete('appraisals/:id')
  @AuthWithPermissions('hr.delete')
  @ApiOperation({ summary: 'Delete draft appraisal' })
  async deleteAppraisal(@Param('id') id: string, @Request() req: any) {
    return this.hrService.deleteAppraisal(id);
  }

  @Post('appraisals/:id/submit-self-review')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Submit employee self-review' })
  async submitSelfReview(
    @Param('id') id: string,
    @Body() dto: SubmitSelfReviewDto,
    @Request() req: any,
  ) {
    return this.hrService.submitSelfReview(id, dto);
  }

  @Post('appraisals/:id/submit-manager-review')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Submit manager review and complete appraisal' })
  async submitManagerReview(
    @Param('id') id: string,
    @Body() dto: SubmitManagerReviewDto,
    @Request() req: any,
  ) {
    return this.hrService.submitManagerReview(id, dto);
  }

  @Post('appraisals/:id/acknowledge')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Employee acknowledges completed appraisal' })
  async acknowledgeAppraisal(@Param('id') id: string, @Request() req: any) {
    return this.hrService.acknowledgeAppraisal(id);
  }

  // ============ TRAINING PROGRAMS ============
  @Post('training/programs')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create training program' })
  async createTrainingProgram(@Body() dto: CreateTrainingProgramDto, @Request() req: any) {
    return this.hrService.createTrainingProgram(dto, req.user?.tenantId);
  }

  @Get('training/programs')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get training programs' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'status', required: false })
  async getTrainingPrograms(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    return this.hrService.getTrainingPrograms(facilityId, status, req?.user?.tenantId);
  }

  @Get('training/programs/:id')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get training program by ID' })
  async getTrainingProgramById(@Param('id') id: string, @Request() req: any) {
    return this.hrService.getTrainingProgramById(id, req.user?.tenantId);
  }

  @Patch('training/programs/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update training program' })
  async updateTrainingProgram(
    @Param('id') id: string,
    @Body() dto: UpdateTrainingProgramDto,
    @Request() req: any,
  ) {
    return this.hrService.updateTrainingProgram(id, dto, req.user?.tenantId);
  }

  @Delete('training/programs/:id')
  @AuthWithPermissions('hr.delete')
  @ApiOperation({ summary: 'Delete training program' })
  async deleteTrainingProgram(@Param('id') id: string, @Request() req: any) {
    return this.hrService.deleteTrainingProgram(id, req.user?.tenantId);
  }

  @Get('training/stats')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get training stats' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getTrainingStats(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.hrService.getTrainingStats(facilityId, req.user?.tenantId);
  }

  // ============ TRAINING ENROLLMENTS ============
  @Post('training/enrollments')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Enroll employee in training' })
  async enrollEmployee(@Body() dto: EnrollEmployeeDto, @Request() req: any) {
    return this.hrService.enrollEmployee(dto, req.user?.tenantId);
  }

  @Get('training/programs/:id/enrollments')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get enrollments for training' })
  async getTrainingEnrollments(@Param('id') trainingProgramId: string, @Request() req: any) {
    return this.hrService.getTrainingEnrollments(trainingProgramId, req.user?.tenantId);
  }

  @Get('employees/:id/trainings')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get employee trainings' })
  async getEmployeeTrainings(@Param('id') employeeId: string, @Request() req: any) {
    return this.hrService.getEmployeeTrainings(employeeId, req.user?.tenantId);
  }

  @Patch('training/enrollments/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update enrollment' })
  async updateEnrollment(
    @Param('id') id: string,
    @Body() dto: UpdateEnrollmentDto,
    @Request() req: any,
  ) {
    return this.hrService.updateEnrollment(id, dto, req.user?.tenantId);
  }

  // ============ STAFF DOCUMENTS ============

  @Get('documents/stats')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get document statistics' })
  async getDocumentStats(@Request() req: any) {
    return this.hrService.getDocumentStats(req.user?.tenantId);
  }

  @Get('staff/:userId/documents')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get staff documents' })
  async getStaffDocuments(@Param('userId') userId: string, @Request() req: any) {
    return this.hrService.getStaffDocuments(userId, req.user?.tenantId);
  }

  @Post('staff/:userId/documents')
  @AuthWithPermissions('hr.create')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload staff document' })
  async uploadStaffDocument(
    @Param('userId') userId: string,
    @UploadedFile() file: any,
    @Body()
    data: {
      documentType: DocumentType;
      documentName: string;
      licenseNumber?: string;
      issuingAuthority?: string;
      issueDate?: string;
      expiryDate?: string;
      notes?: string;
    },
    @Request() req: any,
  ) {
    if (!file) {
      throw new Error('File is required');
    }
    // Validate file content matches declared MIME type
    if (file?.path) {
      const header = fs.readFileSync(file.path, { flag: 'r' }).subarray(0, 16);
      if (!validateFileContent(header, file.mimetype)) {
        throw new BadRequestException('File content does not match declared type');
      }
    }
    return this.hrService.uploadStaffDocument(userId, file, data, req.user?.tenantId);
  }

  @Patch('documents/:id/verify')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Verify staff document' })
  async verifyDocument(
    @Param('id') documentId: string,
    @Body() data: { status: DocumentStatus },
    @Request() req: any,
  ) {
    return this.hrService.verifyDocument(documentId, req.user.sub, data.status, req.user?.tenantId);
  }

  @Delete('documents/:id')
  @AuthWithPermissions('hr.delete')
  @ApiOperation({ summary: 'Delete staff document' })
  async deleteDocument(@Param('id') documentId: string, @Request() req: any) {
    return this.hrService.deleteDocument(documentId, req.user?.tenantId);
  }

  @Get('documents/:id/download')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Download staff document' })
  async downloadDocument(@Param('id') documentId: string, @Res() res: any, @Request() req: any) {
    const document = await this.hrService.getDocumentById(documentId, req.user?.tenantId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const filePath = path.resolve(path.join(process.cwd(), document.filePath));
    // Prevent path traversal: resolved path must be within uploads directory
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(403).json({ message: 'Invalid file path' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    const safeName = (document.documentName || 'document')
      .replace(/[/\\]/g, '_')
      .replace(/[^\w\s.\-()]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
    return res.sendFile(filePath);
  }

  // ============ SHIFT DEFINITIONS ============

  @Get('shifts')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'List shift definitions' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'departmentId', required: false })
  getShifts(
    @Query('facilityId') facilityId: string,
    @Query('departmentId') departmentId?: string,
    @Request() req?: any,
  ) {
    return this.hrService.getShiftDefinitions(facilityId, departmentId, req?.user?.tenantId);
  }

  @Post('shifts')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create shift definition' })
  createShift(@Body() dto: CreateShiftDefinitionDto, @Request() req: any) {
    return this.hrService.createShiftDefinition(dto, req.user?.tenantId);
  }

  @Patch('shifts/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update shift definition' })
  updateShift(
    @Param('id') id: string,
    @Body() dto: Partial<CreateShiftDefinitionDto>,
    @Request() req: any,
  ) {
    return this.hrService.updateShiftDefinition(id, dto, req.user?.tenantId);
  }

  @Delete('shifts/:id')
  @AuthWithPermissions('hr.delete')
  @ApiOperation({ summary: 'Delete shift definition' })
  deleteShift(@Param('id') id: string, @Request() req: any) {
    return this.hrService.deleteShiftDefinition(id, req.user?.tenantId);
  }

  // ============ ROSTER ============

  @Get('roster')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get staff roster' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'departmentId', required: false })
  getRoster(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('departmentId') departmentId?: string,
    @Request() req?: any,
  ) {
    return this.hrService.getRoster(
      facilityId,
      startDate,
      endDate,
      departmentId ? { departmentId } : undefined,
      req?.user?.tenantId,
    );
  }

  @Post('roster')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Assign staff to roster' })
  assignRoster(@Body() dto: CreateRosterDto, @Request() req: any) {
    return this.hrService.createRoster(dto, dto.employeeId, req.user?.tenantId);
  }

  // ============ LEAVE TYPES & HOLIDAYS (settings-backed) ============

  @Get('leave-types')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get configurable leave types' })
  async getLeaveTypes(@Request() req: any) {
    try {
      const s = await this.settingsService.getByKey('hr_leave_types', req.user?.tenantId);
      return (s.value as any[]) ?? DEFAULT_LEAVE_TYPES;
    } catch {
      return DEFAULT_LEAVE_TYPES;
    }
  }

  @Put('leave-types')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Save leave types configuration' })
  async saveLeaveTypes(@Body() body: LeaveTypeConfigDto[], @Request() req: any) {
    await this.settingsService.upsert(
      'hr_leave_types',
      body,
      req.user?.tenantId,
      'HR leave types configuration',
    );
    return body;
  }

  @Get('holidays')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get public holidays' })
  async getHolidays(@Request() req: any) {
    try {
      const s = await this.settingsService.getByKey('hr_holidays', req.user?.tenantId);
      return (s.value as any[]) ?? [];
    } catch {
      return [];
    }
  }

  @Put('holidays')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Save public holidays' })
  async saveHolidays(@Body() body: HolidayConfigDto[], @Request() req: any) {
    await this.settingsService.upsert(
      'hr_holidays',
      body,
      req.user?.tenantId,
      'Public holidays configuration',
    );
    return body;
  }

  @Get('leave/balances')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get leave balances for all staff' })
  @ApiQuery({ name: 'facilityId', required: false })
  async getLeaveBalances(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    return this.hrService.getLeaveBalances(facilityId, req?.user?.tenantId);
  }

  // ============ SHIFT SWAPS ============

  @Post('shift-swaps')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Request a shift swap' })
  requestShiftSwap(@Body() dto: RequestShiftSwapDto, @Request() req: any) {
    return this.hrService.requestShiftSwap(dto, req.user?.tenantId);
  }

  @Get('shift-swaps')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'List shift swap requests' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'status', required: false })
  getShiftSwaps(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    return this.hrService.getSwapRequests(facilityId, status as any, req?.user?.tenantId);
  }

  @Patch('shift-swaps/:id/respond')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Respond to a shift swap request (accept/decline)' })
  respondToSwap(@Param('id') id: string, @Body('accepted') accepted: boolean, @Request() req: any) {
    return this.hrService.respondToSwapRequest(id, accepted, req.user?.id, req.user?.tenantId);
  }

  @Patch('shift-swaps/:id/approve')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Manager approval of a shift swap' })
  approveSwap(@Param('id') id: string, @Body() dto: ApproveSwapDto, @Request() req: any) {
    return this.hrService.approveSwapRequest(id, dto, req.user?.id, req.user?.tenantId);
  }

  @Post('roster/generate')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Auto-generate weekly roster' })
  generateRoster(@Body() dto: GenerateRosterDto, @Request() req: any) {
    return this.hrService.generateWeeklyRoster(
      dto.facilityId,
      dto.startDate,
      dto.employeeIds,
      dto.shiftPattern,
      req.user?.id,
      req.user?.tenantId,
    );
  }

  @Patch('roster/:id/status')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update roster entry status' })
  updateRosterStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('notes') notes?: string,
    @Request() req?: any,
  ) {
    return this.hrService.updateRosterStatus(id, status as any, notes, req?.user?.tenantId);
  }

  @Patch('roster/:id/actual-times')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Record actual start/end times for roster entry' })
  recordActualTimes(
    @Param('id') id: string,
    @Body('startTime') startTime: string,
    @Body('endTime') endTime?: string,
    @Request() req?: any,
  ) {
    return this.hrService.recordActualTimes(id, startTime, endTime, req?.user?.tenantId);
  }

  @Get('shift-coverage')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get shift coverage for a date' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'date', required: true })
  getShiftCoverage(
    @Query('facilityId') facilityId: string,
    @Query('date') date: string,
    @Request() req?: any,
  ) {
    return this.hrService.getShiftCoverage(facilityId, date, req?.user?.tenantId);
  }

  // ============ DISCIPLINARY ACTIONS ============

  @Post('disciplinary')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create a disciplinary action' })
  createDisciplinary(@Body() dto: CreateDisciplinaryDto, @Request() req: any) {
    return this.hrService.createDisciplinaryAction(dto, req.user?.id, req.user?.tenantId);
  }

  @Get('disciplinary')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'List disciplinary actions' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'facilityId', required: false })
  getDisciplinaryActions(
    @Query('employeeId') employeeId?: string,
    @Query('facilityId') facilityId?: string,
    @Request() req?: any,
  ) {
    return this.hrService.getDisciplinaryActions(employeeId, facilityId, req?.user?.tenantId);
  }

  @Get('disciplinary/:id')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get disciplinary action details' })
  getDisciplinaryAction(@Param('id') id: string, @Request() req: any) {
    return this.hrService.getDisciplinaryAction(id, req.user?.tenantId);
  }

  @Patch('disciplinary/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update disciplinary action' })
  updateDisciplinary(
    @Param('id') id: string,
    @Body() dto: UpdateDisciplinaryDto,
    @Request() req: any,
  ) {
    return this.hrService.updateDisciplinaryAction(id, dto, req.user?.tenantId);
  }

  @Patch('disciplinary/:id/acknowledge')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Employee acknowledges disciplinary action' })
  acknowledgeDisciplinary(@Param('id') id: string, @Request() req: any) {
    return this.hrService.acknowledgeDisciplinary(id, req.user?.tenantId);
  }

  // ============ SALARY HISTORY ============

  @Post('salary-history')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Record a salary change' })
  recordSalaryChange(@Body() dto: CreateSalaryChangeDto, @Request() req: any) {
    return this.hrService.recordSalaryChange(dto, req.user?.id, req.user?.tenantId);
  }

  @Get('salary-history/:employeeId')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get salary history for an employee' })
  getSalaryHistory(@Param('employeeId') employeeId: string, @Request() req: any) {
    return this.hrService.getSalaryHistory(employeeId, req.user?.tenantId);
  }

  // ============ ONBOARDING ============

  @Post('onboarding')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create an onboarding task' })
  createOnboardingTask(@Body() dto: CreateOnboardingTaskDto, @Request() req: any) {
    return this.hrService.createOnboardingTask(dto, req.user?.tenantId);
  }

  @Post('onboarding/from-template')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create onboarding tasks from default template' })
  createOnboardingFromTemplate(@Body() dto: CreateOnboardingFromTemplateDto, @Request() req: any) {
    return this.hrService.createOnboardingFromTemplate(
      dto.employeeId,
      dto.facilityId,
      req.user?.tenantId,
    );
  }

  @Get('onboarding/:employeeId')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get onboarding tasks for an employee' })
  getOnboardingTasks(@Param('employeeId') employeeId: string, @Request() req: any) {
    return this.hrService.getOnboardingTasks(employeeId, req.user?.tenantId);
  }

  @Get('onboarding/:employeeId/progress')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get onboarding progress' })
  getOnboardingProgress(@Param('employeeId') employeeId: string, @Request() req: any) {
    return this.hrService.getOnboardingProgress(employeeId, req.user?.tenantId);
  }

  @Patch('onboarding/tasks/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update an onboarding task' })
  updateOnboardingTask(
    @Param('id') id: string,
    @Body() dto: UpdateOnboardingTaskDto,
    @Request() req: any,
  ) {
    return this.hrService.updateOnboardingTask(id, dto, req.user?.id, req.user?.tenantId);
  }
}

// Default leave types returned when settings not yet configured
const DEFAULT_LEAVE_TYPES = [
  {
    id: 'annual',
    name: 'Annual Leave',
    code: 'AL',
    defaultDays: 21,
    carryForward: true,
    maxCarryForward: 10,
    paidLeave: true,
    status: 'Active',
  },
  {
    id: 'sick',
    name: 'Sick Leave',
    code: 'SL',
    defaultDays: 14,
    carryForward: false,
    maxCarryForward: 0,
    paidLeave: true,
    status: 'Active',
  },
  {
    id: 'casual',
    name: 'Casual Leave',
    code: 'CL',
    defaultDays: 7,
    carryForward: false,
    maxCarryForward: 0,
    paidLeave: true,
    status: 'Active',
  },
  {
    id: 'maternity',
    name: 'Maternity Leave',
    code: 'ML',
    defaultDays: 90,
    carryForward: false,
    maxCarryForward: 0,
    paidLeave: true,
    status: 'Active',
  },
  {
    id: 'paternity',
    name: 'Paternity Leave',
    code: 'PL',
    defaultDays: 14,
    carryForward: false,
    maxCarryForward: 0,
    paidLeave: true,
    status: 'Active',
  },
  {
    id: 'unpaid',
    name: 'Unpaid Leave',
    code: 'UL',
    defaultDays: 30,
    carryForward: false,
    maxCarryForward: 0,
    paidLeave: false,
    status: 'Active',
  },
  {
    id: 'bereavement',
    name: 'Bereavement Leave',
    code: 'BL',
    defaultDays: 5,
    carryForward: false,
    maxCarryForward: 0,
    paidLeave: true,
    status: 'Active',
  },
  {
    id: 'study',
    name: 'Study Leave',
    code: 'STL',
    defaultDays: 10,
    carryForward: false,
    maxCarryForward: 0,
    paidLeave: true,
    status: 'Active',
  },
];
