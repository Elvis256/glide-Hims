import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  IsEnum,
  IsNumber,
  IsArray,
  IsBoolean,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType, Gender, MaritalStatus } from '../../../database/entities/employee.entity';
import { LeaveType } from '../../../database/entities/leave-request.entity';

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
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverLetter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resumeUrl?: string;
}

export class UpdateApplicationStatusDto {
  @ApiProperty()
  @IsString()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
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
  appraisalPeriod: string;

  @ApiProperty()
  @IsInt()
  year: number;
}

export class UpdateAppraisalDto {
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
  @IsNumber()
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
}

// ============ TRAINING ============
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
