import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsDateString,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  LabTestCategory,
  LabTestStatus,
  SampleType,
} from '../../../database/entities/lab-test.entity';
import { SampleStatus, SamplePriority } from '../../../database/entities/lab-sample.entity';
import { AbnormalFlag } from '../../../database/entities/lab-result.entity';

const FINITE = { allowNaN: false, allowInfinity: false } as const;

// Lab Test DTOs
export class ReferenceRangeDto {
  @IsString()
  @MaxLength(128)
  parameter: string;

  @IsString()
  @MaxLength(32)
  unit: string;

  @IsNumber(FINITE)
  @Min(-1_000_000_000)
  @Max(1_000_000_000)
  @IsOptional()
  normalMin?: number;

  @IsNumber(FINITE)
  @Min(-1_000_000_000)
  @Max(1_000_000_000)
  @IsOptional()
  normalMax?: number;

  @IsNumber(FINITE)
  @Min(-1_000_000_000)
  @Max(1_000_000_000)
  @IsOptional()
  criticalLow?: number;

  @IsNumber(FINITE)
  @Min(-1_000_000_000)
  @Max(1_000_000_000)
  @IsOptional()
  criticalHigh?: number;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  textNormal?: string;

  @IsString()
  @MaxLength(64)
  @IsOptional()
  ageGroup?: string;

  @IsIn(['male', 'female', 'all'])
  @IsOptional()
  gender?: 'male' | 'female' | 'all';
}

export class CreateLabTestDto {
  @IsString()
  @MaxLength(32)
  code: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @IsEnum(LabTestCategory)
  @IsOptional()
  category?: LabTestCategory;

  @IsEnum(SampleType)
  @IsOptional()
  sampleType?: SampleType;

  @IsNumber(FINITE)
  @Min(0)
  @Max(1_000_000)
  @IsOptional()
  price?: number;

  @IsNumber(FINITE)
  @Min(0)
  @Max(43_200)
  @IsOptional()
  turnaroundTimeMinutes?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceRangeDto)
  @IsOptional()
  referenceRanges?: ReferenceRangeDto[];

  @IsArray()
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  @IsOptional()
  components?: string[];

  @IsBoolean()
  @IsOptional()
  requiresFasting?: boolean;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  specialInstructions?: string;
}

export class UpdateLabTestDto {
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @IsEnum(LabTestCategory)
  @IsOptional()
  category?: LabTestCategory;

  @IsEnum(LabTestStatus)
  @IsOptional()
  status?: LabTestStatus;

  @IsNumber(FINITE)
  @Min(0)
  @Max(1_000_000)
  @IsOptional()
  price?: number;

  @IsNumber(FINITE)
  @Min(0)
  @Max(43_200)
  @IsOptional()
  turnaroundTimeMinutes?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceRangeDto)
  @IsOptional()
  referenceRanges?: ReferenceRangeDto[];
}

// Sample DTOs
export class CollectSampleDto {
  @IsUUID()
  orderId: string;

  @IsUUID()
  patientId: string;

  @IsUUID()
  @IsOptional()
  labTestId?: string;

  @IsString()
  @MaxLength(64)
  @IsOptional()
  labTestCode?: string;

  @IsUUID()
  facilityId: string;

  @IsEnum(SampleType)
  sampleType: SampleType;

  @IsEnum(SamplePriority)
  @IsOptional()
  priority?: SamplePriority;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  collectionNotes?: string;
}

export class ReceiveSampleDto {
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;
}

export class RejectSampleDto {
  @IsString()
  @MaxLength(1000)
  rejectionReason: string;
}

export class SampleQueryDto {
  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @IsEnum(SampleStatus)
  @IsOptional()
  status?: SampleStatus;

  @IsString()
  @MaxLength(512)
  @IsOptional()
  statuses?: string;

  @IsUUID()
  @IsOptional()
  orderId?: string;

  @IsEnum(SamplePriority)
  @IsOptional()
  priority?: SamplePriority;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;
}

// Result DTOs
export class EnterResultDto {
  @IsString()
  @MaxLength(128)
  parameter: string;

  @IsString()
  @MaxLength(1000)
  value: string;

  @IsNumber(FINITE)
  @Min(-1_000_000_000)
  @Max(1_000_000_000)
  @IsOptional()
  numericValue?: number;

  @IsString()
  @MaxLength(32)
  @IsOptional()
  unit?: string;

  @IsNumber(FINITE)
  @Min(-1_000_000_000)
  @Max(1_000_000_000)
  @IsOptional()
  referenceMin?: number;

  @IsNumber(FINITE)
  @Min(-1_000_000_000)
  @Max(1_000_000_000)
  @IsOptional()
  referenceMax?: number;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  referenceRange?: string;

  @IsEnum(AbnormalFlag)
  @IsOptional()
  abnormalFlag?: AbnormalFlag;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  interpretation?: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  comments?: string;
}

export class ValidateResultDto {
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  comments?: string;
}

export class AmendResultDto {
  @IsString()
  @MaxLength(1000)
  newValue: string;

  @IsNumber(FINITE)
  @Min(-1_000_000_000)
  @Max(1_000_000_000)
  @IsOptional()
  numericValue?: number;

  @IsString()
  @MaxLength(1000)
  amendmentReason: string;
}

export class LabTestQueryDto {
  @IsEnum(LabTestCategory)
  @IsOptional()
  category?: LabTestCategory;

  @IsEnum(LabTestStatus)
  @IsOptional()
  status?: LabTestStatus;

  @IsString()
  @MaxLength(128)
  @IsOptional()
  search?: string;
}
