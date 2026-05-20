import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsArray,
  ValidateNested,
  IsIn,
  IsNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
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
  @MaxLength(2000)
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
  @MaxLength(2000)
  @IsOptional()
  chiefComplaint?: string;

  @IsString()
  @MaxLength(4000)
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

  /**
   * Optional UUID of the provider this encounter should be ASSIGNED to
   * (e.g. nurse forwarding a patient to a specific doctor for IN_CONSULTATION).
   * The acting user is always taken from the authenticated session — never
   * from the request body — to prevent actor spoofing in the audit log.
   */
  @IsUUID()
  @IsOptional()
  attendingProviderId?: string;

  /** @deprecated Use `attendingProviderId`. Accepted for backward compatibility. */
  @IsUUID()
  @IsOptional()
  providerId?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  reason?: string;
}

export class EncounterQueryDto {
  @IsString()
  @MaxLength(128)
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
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(10000)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number = 20;
}

class DiagnosisDto {
  @IsString()
  @MaxLength(32)
  code: string;

  @IsString()
  @MaxLength(512)
  description: string;

  @IsIn(['primary', 'secondary', 'differential'])
  type: 'primary' | 'secondary' | 'differential';
}

export class ReturnReasonDto {
  @IsString()
  @MaxLength(1000)
  @IsNotEmpty({ message: 'Reason is required' })
  reason: string;
}

export class CompleteConsultationDto {
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  chiefComplaint?: string;

  @IsString()
  @MaxLength(4000)
  @IsOptional()
  notes?: string;

  @IsString()
  @MaxLength(8000)
  @IsOptional()
  subjective?: string;

  @IsString()
  @MaxLength(8000)
  @IsOptional()
  objective?: string;

  @IsString()
  @MaxLength(8000)
  @IsNotEmpty({ message: 'Assessment is required to complete consultation' })
  assessment: string;

  @IsString()
  @MaxLength(8000)
  @IsNotEmpty({ message: 'Plan is required to complete consultation' })
  plan: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one diagnosis is required' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DiagnosisDto)
  diagnoses: DiagnosisDto[];

  @IsDateString()
  @IsOptional()
  followUpDate?: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  followUpNotes?: string;
}
