import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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

  @Get('my-payslips')
  @AuthWithPermissions() // Any authenticated user can view their own payslips
  @ApiOperation({ summary: 'Get current user payslips' })
  @ApiQuery({ name: 'year', required: false })
  async getMyPayslips(@Request() req: any, @Query('year') year?: number) {
    return this.hrService.getMyPayslips(req.user.id, year);
  }

  // ============ RECRUITMENT - JOB POSTINGS ============
  @Post('recruitment/jobs')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create job posting' })
  async createJobPosting(@Body() dto: CreateJobPostingDto) {
    return this.hrService.createJobPosting(dto);
  }

  @Get('recruitment/jobs')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get job postings' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'status', required: false })
  async getJobPostings(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: string,
  ) {
    return this.hrService.getJobPostings(facilityId, status);
  }

  @Get('recruitment/jobs/:id')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get job posting by ID' })
  async getJobPostingById(@Param('id') id: string) {
    return this.hrService.getJobPostingById(id);
  }

  @Patch('recruitment/jobs/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update job posting' })
  async updateJobPosting(@Param('id') id: string, @Body() dto: UpdateJobPostingDto) {
    return this.hrService.updateJobPosting(id, dto);
  }

  @Delete('recruitment/jobs/:id')
  @AuthWithPermissions('hr.delete')
  @ApiOperation({ summary: 'Delete job posting' })
  async deleteJobPosting(@Param('id') id: string) {
    return this.hrService.deleteJobPosting(id);
  }

  @Get('recruitment/stats')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get recruitment stats' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getRecruitmentStats(@Query('facilityId') facilityId: string) {
    return this.hrService.getRecruitmentStats(facilityId);
  }

  // ============ RECRUITMENT - APPLICATIONS ============
  @Post('recruitment/applications')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Submit job application' })
  async createJobApplication(@Body() dto: CreateJobApplicationDto) {
    return this.hrService.createJobApplication(dto);
  }

  @Get('recruitment/jobs/:id/applications')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get applications for job' })
  @ApiQuery({ name: 'status', required: false })
  async getJobApplications(
    @Param('id') jobPostingId: string,
    @Query('status') status?: string,
  ) {
    return this.hrService.getJobApplications(jobPostingId, status);
  }

  @Patch('recruitment/applications/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update application status' })
  async updateApplicationStatus(@Param('id') id: string, @Body() dto: UpdateApplicationStatusDto) {
    return this.hrService.updateApplicationStatus(id, dto);
  }

  // ============ PERFORMANCE APPRAISALS ============
  @Post('appraisals')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create performance appraisal' })
  async createAppraisal(@Body() dto: CreateAppraisalDto) {
    return this.hrService.createAppraisal(dto);
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
  ) {
    return this.hrService.getAppraisals(facilityId, { employeeId, year, status });
  }

  @Get('appraisals/:id')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get appraisal by ID' })
  async getAppraisalById(@Param('id') id: string) {
    return this.hrService.getAppraisalById(id);
  }

  @Patch('appraisals/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update appraisal' })
  async updateAppraisal(@Param('id') id: string, @Body() dto: UpdateAppraisalDto) {
    return this.hrService.updateAppraisal(id, dto);
  }

  @Get('appraisals/stats')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get appraisal stats' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'year', required: true })
  async getAppraisalStats(
    @Query('facilityId') facilityId: string,
    @Query('year') year: number,
  ) {
    return this.hrService.getAppraisalStats(facilityId, year);
  }

  // ============ TRAINING PROGRAMS ============
  @Post('training/programs')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create training program' })
  async createTrainingProgram(@Body() dto: CreateTrainingProgramDto) {
    return this.hrService.createTrainingProgram(dto);
  }

  @Get('training/programs')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get training programs' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'status', required: false })
  async getTrainingPrograms(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: string,
  ) {
    return this.hrService.getTrainingPrograms(facilityId, status);
  }

  @Get('training/programs/:id')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get training program by ID' })
  async getTrainingProgramById(@Param('id') id: string) {
    return this.hrService.getTrainingProgramById(id);
  }

  @Patch('training/programs/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update training program' })
  async updateTrainingProgram(@Param('id') id: string, @Body() dto: UpdateTrainingProgramDto) {
    return this.hrService.updateTrainingProgram(id, dto);
  }

  @Delete('training/programs/:id')
  @AuthWithPermissions('hr.delete')
  @ApiOperation({ summary: 'Delete training program' })
  async deleteTrainingProgram(@Param('id') id: string) {
    return this.hrService.deleteTrainingProgram(id);
  }

  @Get('training/stats')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get training stats' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getTrainingStats(@Query('facilityId') facilityId: string) {
    return this.hrService.getTrainingStats(facilityId);
  }

  // ============ TRAINING ENROLLMENTS ============
  @Post('training/enrollments')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Enroll employee in training' })
  async enrollEmployee(@Body() dto: EnrollEmployeeDto) {
    return this.hrService.enrollEmployee(dto);
  }

  @Get('training/programs/:id/enrollments')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get enrollments for training' })
  async getTrainingEnrollments(@Param('id') trainingProgramId: string) {
    return this.hrService.getTrainingEnrollments(trainingProgramId);
  }

  @Get('employees/:id/trainings')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Get employee trainings' })
  async getEmployeeTrainings(@Param('id') employeeId: string) {
    return this.hrService.getEmployeeTrainings(employeeId);
  }

  @Patch('training/enrollments/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update enrollment' })
  async updateEnrollment(@Param('id') id: string, @Body() dto: UpdateEnrollmentDto) {
    return this.hrService.updateEnrollment(id, dto);
  }
}
