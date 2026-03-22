import { IsString, IsOptional, IsUUID, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { ReferralPriority, ReferralStage } from '../../../database/entities/sample-referral.entity';

export class CreateSampleReferralDto {
  @IsUUID()
  sampleId: string;

  @IsUUID()
  fromFacilityId: string;

  @IsUUID()
  toFacilityId: string;

  @IsString()
  @IsOptional()
  testRequested?: string;

  @IsString()
  @IsOptional()
  clinicalInfo?: string;

  @IsEnum(ReferralPriority)
  @IsOptional()
  priority?: ReferralPriority;

  @IsString()
  @IsOptional()
  transportMethod?: string;

  @IsString()
  @IsOptional()
  transporterName?: string;

  @IsString()
  @IsOptional()
  transporterPhone?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateStageDto {
  @IsEnum(ReferralStage)
  stage: ReferralStage;

  @IsNumber()
  @IsOptional()
  temperatureOnArrival?: number;

  @IsString()
  @IsOptional()
  sampleConditionOnArrival?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RejectReferralDto {
  @IsString()
  rejectionReason: string;
}

export class SampleReferralQueryDto {
  @IsEnum(ReferralStage)
  @IsOptional()
  stage?: ReferralStage;

  @IsString()
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
