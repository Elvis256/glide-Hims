import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsNumber,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType, Gender, MaritalStatus } from '../../../database/entities/employee.entity';
import { LeaveType } from '../../../database/entities/leave-request.entity';
import { ApplicationStatus } from '../../../database/entities/job-application.entity';

// ============ EMPLOYEE ============
export class CreateEmployeeDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  otherNames?: string;

  @ApiProperty()
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender: Gender;

  @ApiPropertyOptional({ enum: MaritalStatus })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nssfNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tinNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty()
  @IsString()
  jobTitle: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'FK to departments.id (preferred over free-text department)' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ enum: EmploymentType })
  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @ApiProperty()
  @IsDateString()
  hireDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  salaryGrade?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  basicSalary: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  allowances?: { name: string; amount: number; taxable: boolean }[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'FK to departments.id (preferred over free-text department)' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  basicSalary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  allowances?: { name: string; amount: number; taxable: boolean }[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  deductions?: { name: string; amount: number; type: 'fixed' | 'percentage' }[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;
}

// ============ ATTENDANCE ============
export class RecordAttendanceDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clockIn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clockOut?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ClockInOutDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;
}

// ============ LEAVE ============
export class RequestLeaveDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiProperty({ enum: LeaveType })
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApproveLeaveDto {
  @ApiProperty()
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ PAYROLL ============
export class CreatePayrollRunDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  month: number;

  @ApiProperty()
  @IsInt()
  @Min(2020)
  year: number;
}

export class ProcessPayrollDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}

// ============ SHIFT DEFINITIONS ============
import { ShiftType } from '../../../database/entities/shift-definition.entity';

export class CreateShiftDefinitionDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ enum: ShiftType })
  @IsEnum(ShiftType)
  shiftType: ShiftType;

  @ApiProperty({ description: 'Start time in HH:mm format' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'End time in HH:mm format' })
  @IsString()
  endTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  breakMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minStaff?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  maxStaff?: number;

  @ApiPropertyOptional({ default: 1.0 })
  @IsOptional()
  @IsNumber()
  payMultiplier?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

// ============ ROSTER ============
export class CreateRosterDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiProperty()
  @IsUUID()
  shiftDefinitionId: string;

  @ApiProperty({ description: 'Date in YYYY-MM-DD format' })
  @IsDateString()
  rosterDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class GenerateWeeklyRosterDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty({ description: 'Start date of the week (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  employeeIds: string[];

  @ApiProperty({ description: 'Array of {dayOfWeek: 0-6, shiftDefinitionId: uuid}' })
  @IsArray()
  shiftPattern: { dayOfWeek: number; shiftDefinitionId: string }[];
}

// ============ SHIFT SWAP ============
export class RequestShiftSwapDto {
  @ApiProperty()
  @IsUUID()
  requesterRosterId: string;

  @ApiProperty()
  @IsUUID()
  targetEmployeeId: string;

  @ApiPropertyOptional({ description: 'Target roster ID for mutual swap' })
  @IsOptional()
  @IsUUID()
  targetRosterId?: string;

  @ApiProperty()
  @IsString()
  reason: string;
}

export class ApproveSwapDto {
  @ApiProperty()
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

// ============ RECRUITMENT ============
export class CreateJobPostingDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsibilities?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employmentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  salaryMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  salaryMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  closingDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  positionsAvailable?: number;
}

export class UpdateJobPostingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  closingDate?: string;
}

export class CreateJobApplicationDto {
  @ApiProperty()
  @IsUUID()
  jobPostingId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  coverLetter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2_000)
  resumeUrl?: string;
}

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  interviewDate?: string;
}

// ============ APPRAISALS ============
export class CreateAppraisalDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiProperty()
  @IsUUID()
  reviewerId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  appraisalPeriod: string;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiPropertyOptional({ description: 'Custom questions for the employee to answer' })
  @IsOptional()
  @IsArray()
  questions?: { id: string; question: string }[];
}

export class UpdateAppraisalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  jobKnowledgeRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  workQualityRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  attendanceRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  communicationRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  teamworkRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  initiativeRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  overallRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeComments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewerComments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  strengths?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  areasForImprovement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goals?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Custom questions for the employee to answer' })
  @IsOptional()
  @IsArray()
  questions?: { id: string; question: string }[];
}

export class SubmitSelfReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  jobKnowledgeRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  workQualityRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  attendanceRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  communicationRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  teamworkRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  initiativeRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeComments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goals?: string;

  @ApiPropertyOptional({ description: 'Answers to custom questions set by manager' })
  @IsOptional()
  @IsArray()
  employeeAnswers?: { questionId: string; answer: string }[];
}

export class SubmitManagerReviewDto {
  @ApiProperty()
  @IsNumber()
  jobKnowledgeRating: number;

  @ApiProperty()
  @IsNumber()
  workQualityRating: number;

  @ApiProperty()
  @IsNumber()
  attendanceRating: number;

  @ApiProperty()
  @IsNumber()
  communicationRating: number;

  @ApiProperty()
  @IsNumber()
  teamworkRating: number;

  @ApiProperty()
  @IsNumber()
  initiativeRating: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewerComments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  strengths?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  areasForImprovement?: string;

  @ApiPropertyOptional({ description: 'Custom questions to add/update' })
  @IsOptional()
  @IsArray()
  questions?: { id: string; question: string }[];
}

export class BulkCreateAppraisalDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty({ description: 'Department name to filter employees' })
  @IsString()
  department: string;

  @ApiProperty()
  @IsUUID()
  reviewerId: string;

  @ApiProperty()
  @IsString()
  appraisalPeriod: string;

  @ApiProperty()
  @IsInt()
  year: number;
}
export class CreateTrainingProgramDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  trainingType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trainer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  durationHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  maxParticipants?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  providesCertification?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificationName?: string;
}

export class UpdateTrainingProgramDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class EnrollEmployeeDto {
  @ApiProperty()
  @IsUUID()
  trainingProgramId: string;

  @ApiProperty()
  @IsUUID()
  employeeId: string;
}

export class UpdateEnrollmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  certified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feedback?: string;
}

// ============ DISCIPLINARY ACTION DTOs ============

export class CreateDisciplinaryDto {
  @IsNotEmpty() @IsUUID() employeeId: string;
  @IsNotEmpty() @IsString() type: string;
  @IsNotEmpty() @IsString() reason: string;
  @IsNotEmpty() @IsString() incidentDate: string;
  @IsOptional() @IsString() details?: string;
  @IsOptional() @IsString() expectedImprovement?: string;
  @IsOptional() @IsString() consequences?: string;
  @IsOptional() @IsString() followUpDate?: string;
  @IsOptional() @IsString() facilityId?: string;
}

export class UpdateDisciplinaryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() resolutionNotes?: string;
  @IsOptional() @IsString() resolutionDate?: string;
  @IsOptional() @IsString() appealNotes?: string;
  @IsOptional() @IsString() followUpDate?: string;
}

// ============ SALARY HISTORY DTOs ============

export class CreateSalaryChangeDto {
  @IsNotEmpty() @IsUUID() employeeId: string;
  @IsNotEmpty() @IsNumber() newSalary: number;
  @IsOptional() @IsNumber() previousSalary?: number;
  @IsOptional() @IsString() previousTitle?: string;
  @IsOptional() @IsString() newTitle?: string;
  @IsOptional() @IsString() previousDepartment?: string;
  @IsOptional() @IsString() newDepartment?: string;
  @IsNotEmpty() @IsString() changeType: string;
  @IsNotEmpty() @IsString() effectiveDate: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() notes?: string;
}

// ============ ONBOARDING DTOs ============

export class CreateOnboardingTaskDto {
  @IsNotEmpty() @IsUUID() employeeId: string;
  @IsNotEmpty() @IsString() taskName: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
}

export class CreateOnboardingFromTemplateDto {
  @IsNotEmpty() @IsUUID() employeeId: string;
  @IsOptional() @IsString() facilityId?: string;
}

export class UpdateOnboardingTaskDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}

// ============ ROSTER GENERATION DTOs ============

export class GenerateRosterDto {
  @IsNotEmpty() @IsString() facilityId: string;
  @IsNotEmpty() @IsString() startDate: string;
  @IsNotEmpty() @IsArray() employeeIds: string[];
  @IsNotEmpty() @IsArray() shiftPattern: { shiftDefinitionId: string; dayOfWeek: number }[];
}

// ============ STAFF LIFECYCLE DTOs ============

export class CreateStaffDto {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsArray()
  roles?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  basicSalary?: number;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  facilityId?: string;

  @IsOptional()
  @IsString()
  staffCategory?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  hireDate?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basicSalary?: number;

  @IsOptional()
  @IsArray()
  allowances?: { name: string; amount: number; taxable: boolean }[];

  @IsOptional()
  @IsArray()
  deductions?: { name: string; amount: number; type: 'fixed' | 'percentage' }[];

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;
}

export class LeaveTypeConfigDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultDays?: number;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;
}

export class HolidayConfigDto {
  @IsString()
  name: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsBoolean()
  recurring?: boolean;
}

export class DeactivateStaffDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class OffboardStaffDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsDateString()
  terminationDate?: string;

  @IsOptional()
  @IsBoolean()
  revokeAccess?: boolean;

  @IsOptional()
  @IsBoolean()
  deactivateAccount?: boolean;
}
