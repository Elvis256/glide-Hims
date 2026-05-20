import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  IsDateString,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ReferralPriority, ReferralStage } from '../../../database/entities/sample-referral.entity';

const FINITE = { allowNaN: false, allowInfinity: false } as const;

export class CreateSampleReferralDto {
  @IsUUID()
  sampleId: string;

  @IsUUID()
  fromFacilityId: string;

  @IsUUID()
  toFacilityId: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  testRequested?: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  clinicalInfo?: string;

  @IsEnum(ReferralPriority)
  @IsOptional()
  priority?: ReferralPriority;

  @IsString()
  @MaxLength(64)
  @IsOptional()
  transportMethod?: string;

  @IsString()
  @MaxLength(128)
  @IsOptional()
  transporterName?: string;

  @IsString()
  @MaxLength(32)
  @IsOptional()
  transporterPhone?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;
}

export class UpdateStageDto {
  @IsEnum(ReferralStage)
  stage: ReferralStage;

  @IsNumber(FINITE)
  @Min(-50)
  @Max(100)
  @IsOptional()
  temperatureOnArrival?: number;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  sampleConditionOnArrival?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;
}

export class RejectReferralDto {
  @IsString()
  @MaxLength(1000)
  rejectionReason: string;
}

export class SampleReferralQueryDto {
  @IsEnum(ReferralStage)
  @IsOptional()
  stage?: ReferralStage;

  @IsIn(['incoming', 'outgoing'])
  @IsOptional()
  direction?: 'incoming' | 'outgoing';

  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @IsEnum(ReferralPriority)
  @IsOptional()
  priority?: ReferralPriority;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;

  @IsString()
  @MaxLength(128)
  @IsOptional()
  search?: string;
}

export class TATStatsQueryDto {
  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;
}
