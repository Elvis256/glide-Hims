import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ReferralType, ReferralPriority, ReferralReason, ReferralStatus } from '../../../database/entities/referral.entity';

class DiagnosisCodeDto {
  @IsString()
  code: string;

  @IsString()
  name: string;
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
}

class InvestigationDto {
  @IsString()
  type: string;

  @IsString()
  name: string;

  @IsString()
  result: string;

  @IsString()
  date: string;
}

export class CreateReferralDto {
  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  sourceEncounterId?: string;

  @IsEnum(ReferralType)
  type: ReferralType;

  @IsEnum(ReferralPriority)
  priority: ReferralPriority;

  @IsEnum(ReferralReason)
  reason: ReferralReason;

  @IsOptional()
  @IsString()
  reasonDetails?: string;

  @IsString()
  clinicalSummary: string;

  @IsOptional()
  @IsString()
  provisionalDiagnosis?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosisCodeDto)
  diagnosisCodes?: DiagnosisCodeDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => VitalSignsDto)
  vitalSigns?: VitalSignsDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvestigationDto)
  investigationsDone?: InvestigationDto[];

  @IsOptional()
  @IsString()
  treatmentGiven?: string;

  @IsOptional()
  @IsString()
  referringDepartment?: string;

  @IsOptional()
  @IsString()
  referredToDepartment?: string;

  @IsOptional()
  @IsString()
  referredToSpecialty?: string;

  @IsOptional()
  @IsUUID()
  toFacilityId?: string;

  @IsOptional()
  @IsString()
  externalFacilityName?: string;

  @IsOptional()
  @IsString()
  externalFacilityAddress?: string;

  @IsOptional()
  @IsString()
  externalFacilityPhone?: string;

  @IsOptional()
  @IsDateString()
  appointmentDate?: string;

  @IsOptional()
  @IsString()
  appointmentTime?: string;

  @IsOptional()
  @IsString()
  transportMode?: string;

  @IsOptional()
  @IsBoolean()
  escortRequired?: boolean;

  @IsOptional()
  @IsString()
  escortName?: string;

  @IsOptional()
  @IsString()
  escortPhone?: string;

  @IsOptional()
  @IsString()
  communityHealthWorkerName?: string;

  @IsOptional()
  @IsString()
  communityHealthWorkerPhone?: string;
}

export class AcceptReferralDto {
  @IsOptional()
  @IsDateString()
  appointmentDate?: string;

  @IsOptional()
  @IsString()
  appointmentTime?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectReferralDto {
  @IsString()
  rejectionReason: string;
}

export class CompleteReferralDto {
  @IsOptional()
  @IsUUID()
  destinationEncounterId?: string;

  @IsOptional()
  @IsString()
  feedbackNotes?: string;
}

export class ReferralFilterDto {
  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;

  @IsOptional()
  @IsEnum(ReferralType)
  type?: ReferralType;

  @IsOptional()
  @IsEnum(ReferralPriority)
  priority?: ReferralPriority;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  fromFacilityId?: string;

  @IsOptional()
  @IsUUID()
  toFacilityId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
