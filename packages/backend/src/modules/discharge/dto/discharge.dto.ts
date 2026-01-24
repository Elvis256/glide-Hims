import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { DischargeType, DischargeDestination } from '../../../database/entities/discharge-summary.entity';

class ProcedureDto {
  @IsString()
  name: string;

  @IsString()
  date: string;

  @IsOptional()
  @IsString()
  surgeon?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class ConsultationDto {
  @IsString()
  specialty: string;

  @IsString()
  consultant: string;

  @IsString()
  date: string;

  @IsString()
  recommendations: string;
}

class DischargeMedicationDto {
  @IsString()
  drugName: string;

  @IsString()
  dosage: string;

  @IsString()
  frequency: string;

  @IsString()
  route: string;

  @IsString()
  duration: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsBoolean()
  isNew: boolean;
}

class DiscontinuedMedicationDto {
  @IsString()
  drugName: string;

  @IsString()
  reason: string;
}

class FollowUpAppointmentDto {
  @IsString()
  date: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsString()
  department: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsString()
  purpose: string;
}

class PendingResultDto {
  @IsString()
  testName: string;

  @IsString()
  expectedDate: string;

  @IsString()
  instructions: string;
}

class PendingReferralDto {
  @IsString()
  specialty: string;

  @IsString()
  reason: string;

  @IsString()
  urgency: string;
}

class EducationProvidedDto {
  @IsString()
  topic: string;

  @IsString()
  method: string;

  @IsString()
  understoodBy: string;
}

class VitalSignsDto {
  @IsOptional()
  temperature?: number;

  @IsOptional()
  pulse?: number;

  @IsOptional()
  @IsString()
  bloodPressure?: string;

  @IsOptional()
  respiratoryRate?: number;

  @IsOptional()
  oxygenSaturation?: number;

  @IsOptional()
  weight?: number;
}

export class CreateDischargeSummaryDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  encounterId: string;

  @IsEnum(DischargeType)
  type: DischargeType;

  @IsEnum(DischargeDestination)
  destination: DischargeDestination;

  @IsDateString()
  dischargeDate: string;

  // Clinical Summary
  @IsString()
  chiefComplaint: string;

  @IsOptional()
  @IsString()
  presentingIllness?: string;

  @IsOptional()
  @IsString()
  admissionDiagnosis?: string;

  @IsString()
  finalDiagnosis: string;

  @IsOptional()
  @IsArray()
  diagnosisCodes?: { code: string; name: string; type: 'primary' | 'secondary' | 'complication' }[];

  @IsOptional()
  @IsArray()
  secondaryDiagnoses?: string[];

  @IsOptional()
  @IsArray()
  comorbidities?: string[];

  // Hospital Course
  @IsString()
  hospitalCourse: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcedureDto)
  proceduresPerformed?: ProcedureDto[];

  @IsOptional()
  @IsString()
  significantFindings?: string;

  @IsOptional()
  @IsString()
  complications?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsultationDto)
  consultations?: ConsultationDto[];

  // Condition at Discharge
  @IsString()
  conditionAtDischarge: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VitalSignsDto)
  vitalSignsAtDischarge?: VitalSignsDto;

  @IsOptional()
  @IsString()
  functionalStatus?: string;

  // Discharge Medications
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DischargeMedicationDto)
  dischargeMedications?: DischargeMedicationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscontinuedMedicationDto)
  medicationsDiscontinued?: DiscontinuedMedicationDto[];

  // Instructions
  @IsString()
  dischargeInstructions: string;

  @IsOptional()
  @IsString()
  dietInstructions?: string;

  @IsOptional()
  @IsString()
  activityInstructions?: string;

  @IsOptional()
  @IsString()
  woundCareInstructions?: string;

  @IsOptional()
  @IsString()
  warningSigns?: string;

  @IsOptional()
  @IsString()
  whenToSeekCare?: string;

  // Follow-up
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FollowUpAppointmentDto)
  followUpAppointments?: FollowUpAppointmentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingResultDto)
  pendingResults?: PendingResultDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingReferralDto)
  pendingReferrals?: PendingReferralDto[];

  // For transfers
  @IsOptional()
  @IsString()
  transferFacilityName?: string;

  @IsOptional()
  @IsString()
  transferReason?: string;

  @IsOptional()
  @IsString()
  transportMode?: string;

  // For AMA
  @IsOptional()
  @IsString()
  amaReason?: string;

  @IsOptional()
  @IsBoolean()
  amaRisksExplained?: boolean;

  @IsOptional()
  @IsBoolean()
  amaConsentSigned?: boolean;

  // Patient Education
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationProvidedDto)
  educationProvided?: EducationProvidedDto[];

  // Contact
  @IsOptional()
  @IsBoolean()
  emergencyContactInformed?: boolean;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsUUID()
  attendingPhysicianId?: string;
}

export class DischargeSummaryFilterDto {
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsEnum(DischargeType)
  type?: DischargeType;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
