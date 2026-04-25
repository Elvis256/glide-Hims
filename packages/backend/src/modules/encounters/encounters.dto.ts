import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsIn,
  IsNotEmpty,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EncounterType,
  EncounterStatus,
  PayerType,
} from '../../database/entities/encounter.entity';

export class CreateEncounterDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  facilityId: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsEnum(EncounterType)
  @IsOptional()
  type?: EncounterType = EncounterType.OPD;

  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @IsEnum(PayerType)
  @IsOptional()
  payerType?: PayerType;

  @IsUUID()
  @IsOptional()
  insurancePolicyId?: string;
}

export class UpdateEncounterDto {
  // Note: status is intentionally excluded — use PATCH :id/status endpoint
  // to ensure transitions are validated against VALID_TRANSITIONS.

  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  attendingProviderId?: string;
}

export class UpdateStatusDto {
  @IsEnum(EncounterStatus)
  status: EncounterStatus;

  @IsUUID()
  @IsOptional()
  providerId?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class EncounterQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(EncounterStatus)
  @IsOptional()
  status?: EncounterStatus;

  @IsEnum(EncounterType)
  @IsOptional()
  type?: EncounterType;

  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}

class DiagnosisDto {
  @IsString()
  code: string;

  @IsString()
  description: string;

  @IsIn(['primary', 'secondary', 'differential'])
  type: 'primary' | 'secondary' | 'differential';
}

export class ReturnReasonDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason is required' })
  reason: string;
}

export class CompleteConsultationDto {
  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  subjective?: string;

  @IsString()
  @IsOptional()
  objective?: string;

  @IsString()
  @IsNotEmpty({ message: 'Assessment is required to complete consultation' })
  assessment: string;

  @IsString()
  @IsNotEmpty({ message: 'Plan is required to complete consultation' })
  plan: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one diagnosis is required' })
  @ValidateNested({ each: true })
  @Type(() => DiagnosisDto)
  diagnoses: DiagnosisDto[];

  @IsDateString()
  @IsOptional()
  followUpDate?: string;

  @IsString()
  @IsOptional()
  followUpNotes?: string;
}
